"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE_NS from "three";
import type { SosAlert } from "@/lib/alerts";
import { getDictionary, plural, type Locale } from "@/lib/i18n";

// Globe 3D de l'accueil : un globe en points, une aiguille rose par lieu de
// manifestation (hauteur selon le nombre de mentions) et une pastille rouge
// qui pulse pour chaque alerte SOS active. Three.js n'est chargé que dans le
// navigateur, après l'affichage de la page ; sans WebGL, le globe ne s'affiche pas.

export type GlobePoint = { lat: number; lng: number; w: number };

const INK = 0x1e2140;
const ROSE = 0xff4fa3;
const SOS_RED = 0xc0262d;
const PAPER_DARK = 0xe4e6de;
const DOTS = 2200;
const ALERTS_REFRESH_MS = 30_000;

function toVector(THREE: typeof THREE_NS, lat: number, lng: number, radius = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export default function Globe3D({ locale, initialPoints }: { locale: Locale; initialPoints: GlobePoint[] | null }) {
  const dict = getDictionary(locale);
  const host = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<GlobePoint[] | null>(initialPoints);
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [ready, setReady] = useState(false);
  // Fonctions posées par la scène pour mettre à jour les marqueurs sans la reconstruire.
  const scene = useRef<{ setPoints: (p: GlobePoint[]) => void; setAlerts: (a: SosAlert[]) => void } | null>(null);

  // Sans données en cache côté serveur, les lieux des 6 dernières heures sont demandés ici.
  useEffect(() => {
    if (initialPoints) return;
    fetch("/api/manifestations?hours=6")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.places) return;
        setPoints(
          (json.places as { lat: number; lng: number; byType: Record<string, { mentions: number }> }[]).map((p) => ({
            lat: p.lat,
            lng: p.lng,
            w: Object.values(p.byType).reduce((n, s) => n + s.mentions, 0),
          })),
        );
      })
      .catch(() => undefined);
  }, [initialPoints]);

  useEffect(() => {
    const load = () =>
      fetch("/api/alerts")
        .then((r) => (r.ok ? r.json() : null))
        .then((json: { alerts: SosAlert[] } | null) => json && setAlerts(json.alerts))
        .catch(() => undefined);
    load();
    const timer = setInterval(load, ALERTS_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};

    import("three").then((THREE) => {
      if (disposed) return;
      let renderer: THREE_NS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        return; // pas de WebGL : la légende sous le globe reste seule
      }
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.touchAction = "pan-y";
      el.appendChild(renderer.domElement);

      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
      // Assez loin pour que les aiguilles les plus hautes (rayon 1,24) restent dans le cadre.
      camera.position.set(0, 0, 4.9);
      const world = new THREE.Scene();

      // tilt (inclinaison, glisser vertical) → spin (rotation, glisser horizontal) → globe.
      const tilt = new THREE.Group();
      const spin = new THREE.Group();
      tilt.add(spin);
      world.add(tilt);

      // Sphère opaque : cache les points de l'autre face.
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.995, 48, 32), new THREE.MeshBasicMaterial({ color: PAPER_DARK }));
      spin.add(core);

      // Halo rose autour du globe : une sphère un peu plus grande, vue de l'intérieur.
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(1.08, 48, 32),
        new THREE.MeshBasicMaterial({ color: ROSE, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false }),
      );
      tilt.add(halo);

      // Points répartis uniformément (spirale de Fibonacci).
      const dotPositions = new Float32Array(DOTS * 3);
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < DOTS; i++) {
        const y = 1 - (i / (DOTS - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        dotPositions.set([Math.cos(golden * i) * r, y, Math.sin(golden * i) * r], i * 3);
      }
      const dotGeometry = new THREE.BufferGeometry();
      dotGeometry.setAttribute("position", new THREE.BufferAttribute(dotPositions, 3));
      const dots = new THREE.Points(
        dotGeometry,
        new THREE.PointsMaterial({ color: INK, size: 0.016, transparent: true, opacity: 0.6 }),
      );
      spin.add(dots);

      // Équateur et deux parallèles, très discrets.
      const rings: THREE_NS.LineLoop[] = [];
      for (const lat of [0, 35, -35]) {
        const pts = Array.from({ length: 97 }, (_, i) => toVector(THREE, lat, (i / 96) * 360 - 180, 1.001));
        const ring = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: lat === 0 ? 0.25 : 0.12 }),
        );
        spin.add(ring);
        rings.push(ring);
      }

      // Lieux de manifestation : aiguilles (segments) et têtes (sphères instanciées).
      const markers = new THREE.Group();
      spin.add(markers);
      const headGeometry = new THREE.SphereGeometry(0.014, 10, 8);
      const headMaterial = new THREE.MeshBasicMaterial({ color: ROSE });
      const spikeMaterial = new THREE.LineBasicMaterial({ color: ROSE, transparent: true, opacity: 0.85 });

      const clearGroup = (g: THREE_NS.Group) => {
        for (const child of [...g.children]) {
          g.remove(child);
          const mesh = child as THREE_NS.Mesh;
          if (mesh.geometry && mesh.geometry !== headGeometry && mesh.geometry !== alertGeometry && mesh.geometry !== ringGeometry) {
            mesh.geometry.dispose();
          }
          if ((child as THREE_NS.Object3D & { dispose?: () => void }).dispose) (child as THREE_NS.InstancedMesh).dispose?.();
        }
      };

      const setPointsInScene = (list: GlobePoint[]) => {
        clearGroup(markers);
        const top = [...list].sort((a, b) => b.w - a.w).slice(0, 400);
        if (top.length === 0) return;
        const max = Math.max(1, ...top.map((p) => p.w));
        const spikes = new Float32Array(top.length * 6);
        const heads = new THREE.InstancedMesh(headGeometry, headMaterial, top.length);
        const m = new THREE.Matrix4();
        top.forEach((p, i) => {
          const base = toVector(THREE, p.lat, p.lng, 1);
          const tip = base.clone().multiplyScalar(1.02 + 0.22 * Math.sqrt(p.w / max));
          spikes.set([base.x, base.y, base.z, tip.x, tip.y, tip.z], i * 6);
          heads.setMatrixAt(i, m.makeTranslation(tip.x, tip.y, tip.z));
        });
        heads.computeBoundingSphere();
        const spikeGeometry = new THREE.BufferGeometry();
        spikeGeometry.setAttribute("position", new THREE.BufferAttribute(spikes, 3));
        markers.add(new THREE.LineSegments(spikeGeometry, spikeMaterial), heads);
      };

      // Alertes SOS : pastille rouge et onde qui s'agrandit, orientée vers l'extérieur.
      const alertGroup = new THREE.Group();
      spin.add(alertGroup);
      const alertGeometry = new THREE.SphereGeometry(0.03, 16, 12);
      const alertMaterial = new THREE.MeshBasicMaterial({ color: SOS_RED });
      const ringGeometry = new THREE.RingGeometry(0.035, 0.05, 32);
      const waves: { mesh: THREE_NS.Mesh; phase: number }[] = [];

      const setAlertsInScene = (list: SosAlert[]) => {
        clearGroup(alertGroup);
        for (const w of waves) (w.mesh.material as THREE_NS.Material).dispose();
        waves.length = 0;
        list.forEach((a, i) => {
          const pos = toVector(THREE, a.lat, a.lng, 1.012);
          const dot = new THREE.Mesh(alertGeometry, alertMaterial);
          dot.position.copy(pos);
          const wave = new THREE.Mesh(
            ringGeometry,
            new THREE.MeshBasicMaterial({ color: SOS_RED, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
          );
          wave.position.copy(pos);
          wave.lookAt(pos.clone().multiplyScalar(2));
          alertGroup.add(dot, wave);
          waves.push({ mesh: wave, phase: (i * 0.37) % 1 });
        });
      };

      scene.current = { setPoints: setPointsInScene, setAlerts: setAlertsInScene };

      // Vue de départ : l'Europe et l'Afrique du Nord face à la caméra, légèrement vue du dessus.
      const start = toVector(THREE, 0, 12);
      spin.rotation.y = Math.atan2(-start.x, start.z);
      tilt.rotation.x = 0.45;

      // Glisser pour tourner le globe.
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      const onDown = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        renderer.domElement.setPointerCapture(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        spin.rotation.y += (e.clientX - lastX) * 0.008;
        tilt.rotation.x = THREE.MathUtils.clamp(tilt.rotation.x + (e.clientY - lastY) * 0.006, -1.1, 1.1);
        lastX = e.clientX;
        lastY = e.clientY;
        if (reduceMotion) renderer.render(world, camera);
      };
      const onUp = () => (dragging = false);
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerup", onUp);
      renderer.domElement.addEventListener("pointercancel", onUp);

      const resize = () => {
        const size = el.clientWidth;
        renderer.setSize(size, size);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
        renderer.render(world, camera);
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(el);

      const timer = new THREE.Timer();
      timer.connect(document);
      const frame = () => {
        timer.update();
        const delta = timer.getDelta();
        const t = timer.getElapsed();
        if (!dragging && !reduceMotion) spin.rotation.y += delta * 0.07;
        for (const w of waves) {
          const k = reduceMotion ? 0.5 : (t * 0.7 + w.phase) % 1;
          w.mesh.scale.setScalar(1 + k * 2.2);
          (w.mesh.material as THREE_NS.MeshBasicMaterial).opacity = 0.9 * (1 - k);
        }
        renderer.render(world, camera);
      };

      // Animation seulement quand le globe est à l'écran ; image fixe si les animations sont réduites.
      const visibility = new IntersectionObserver(([entry]) => {
        renderer.setAnimationLoop(entry.isIntersecting && !reduceMotion ? frame : null);
        if (reduceMotion) frame();
      });
      visibility.observe(el);
      setReady(true);

      cleanup = () => {
        visibility.disconnect();
        resizeObserver.disconnect();
        renderer.setAnimationLoop(null);
        timer.dispose();
        clearGroup(markers);
        clearGroup(alertGroup);
        for (const w of waves) (w.mesh.material as THREE_NS.Material).dispose();
        for (const ring of rings) {
          ring.geometry.dispose();
          (ring.material as THREE_NS.Material).dispose();
        }
        core.geometry.dispose();
        (core.material as THREE_NS.Material).dispose();
        halo.geometry.dispose();
        (halo.material as THREE_NS.Material).dispose();
        dotGeometry.dispose();
        (dots.material as THREE_NS.Material).dispose();
        for (const disposable of [headGeometry, headMaterial, spikeMaterial, alertGeometry, alertMaterial, ringGeometry]) {
          disposable.dispose();
        }
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        scene.current = null;
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (ready && points) scene.current?.setPoints(points);
  }, [ready, points]);

  useEffect(() => {
    if (ready) scene.current?.setAlerts(alerts);
  }, [ready, alerts]);

  const placeCount = points?.length ?? 0;
  return (
    <figure className="select-none">
      <div
        ref={host}
        role="img"
        aria-label={dict.globe.label}
        className="relative mx-auto aspect-square w-full max-w-[26rem] cursor-grab active:cursor-grabbing [&>canvas]:!h-full [&>canvas]:!w-full"
      />
      <figcaption className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose" aria-hidden="true" />
          {placeCount.toLocaleString(locale)} {plural(locale, placeCount, dict.globe.places)}
        </span>
        <span className="flex items-center gap-1.5 text-[#c0262d] font-semibold">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#c0262d]" aria-hidden="true" />
          {alerts.length.toLocaleString(locale)} {plural(locale, alerts.length, dict.sos.active)}
        </span>
        <span className="text-gris">{dict.globe.drag}</span>
      </figcaption>
    </figure>
  );
}
