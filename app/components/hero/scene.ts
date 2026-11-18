import * as THREE from "three";
import type { HeroPlace } from "@/lib/news/hero";

// Scène 3D de l'accueil : la Terre de nuit, continents en points lumineux, une colonne
// de lumière rose par lieu de manifestation et un faisceau rouge par alerte SOS.
// Le défilement de la page pilote la caméra en trois actes :
//   0 → le monde qui tourne ; 1 → plongée vers le pays du visiteur ; 2 → une alerte SOS.
// Ce module (et three.js) n'est chargé qu'à la demande, dans le navigateur.

export type HeroAlert = { id: string; lat: number; lng: number };

export type HeroScene = {
  setProgress: (p: number) => void;
  setPlaces: (places: HeroPlace[]) => void;
  setAlerts: (alerts: HeroAlert[]) => void;
  setFocus: (focus: { lat: number; lng: number } | null) => void;
  // Lieu sous le pointeur (coordonnées dans le canvas, en pixels CSS), s'il est sur la face visible.
  pick: (x: number, y: number) => HeroPlace | null;
  drag: (dx: number, dy: number) => void;
  resize: (width: number, height: number) => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
};

const COLORS = {
  ocean: new THREE.Color("#171a3c"),
  rim: new THREE.Color("#2f55d4"),
  land: new THREE.Color("#c9d3ff"),
  rose: new THREE.Color("#ff4fa3"),
  sos: new THREE.Color("#ff3b47"),
  star: new THREE.Color("#f2f3ee"),
};

const MAX_PLACES = 320;
const INTRO_S = 3.2;

export function latLngToVector(lat: number, lng: number, radius = 1): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

// Orientation (inclinaison x, rotation y) qui place un point du globe face à la caméra.
function facing(lat: number, lng: number) {
  const v = latLngToVector(lat, lng);
  return { x: THREE.MathUtils.degToRad(lat), y: Math.atan2(-v.x, v.z) };
}

const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
const easeOut = (x: number) => 1 - Math.pow(1 - THREE.MathUtils.clamp(x, 0, 1), 3);
// Différence d'angle la plus courte, pour ne jamais faire le grand tour.
const shortest = (from: number, to: number) => from + ((((to - from) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;

// Disque flou pour les halos (dessiné une fois sur un canvas).
function glowTexture(): THREE.Texture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function createHeroScene(opts: {
  canvas: HTMLCanvasElement;
  reduceMotion: boolean;
  landUrl: string;
}): Promise<HeroScene | null> {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const { reduceMotion } = opts;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  const globe = new THREE.Group();
  scene.add(globe);
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);
  const glow = keep(glowTexture());

  // Océan : sphère sombre dont le bord s'éclaire (effet de Fresnel).
  const oceanMat = keep(
    new THREE.ShaderMaterial({
      uniforms: { uOcean: { value: COLORS.ocean }, uRim: { value: COLORS.rim } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uOcean; uniform vec3 uRim; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0); gl_FragColor = vec4(mix(uOcean, uRim, f*0.9), 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  globe.add(new THREE.Mesh(keep(new THREE.SphereGeometry(1, 64, 48)), oceanMat));

  // Atmosphère : halo rose-bleu autour du globe, vu de l'intérieur, en mélange additif.
  const atmoMat = keep(
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color("#ff7cc0") }, uColor2: { value: COLORS.rim } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform vec3 uColor2; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(max(dot(vN, vV), 0.0), 2.4); gl_FragColor = vec4(mix(uColor2, uColor, f), f*0.55);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(new THREE.Mesh(keep(new THREE.SphereGeometry(1.16, 64, 48)), atmoMat));

  // Étoiles lointaines.
  const starCount = window.innerWidth < 640 ? 700 : 1400;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 40);
    starPos.set([v.x, v.y, v.z], i * 3);
  }
  const starGeo = keep(new THREE.BufferGeometry());
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    keep(new THREE.PointsMaterial({ color: COLORS.star, size: 0.12, transparent: true, opacity: 0.55, depthWrite: false })),
  );
  scene.add(stars);

  // Continents : points de la grille des terres émergées, allumés d'ouest en est au chargement.
  const landMat = keep(
    new THREE.ShaderMaterial({
      uniforms: {
        uReveal: { value: reduceMotion ? 1.5 : 0 },
        uColor: { value: COLORS.land },
        uSize: { value: 2.6 * renderer.getPixelRatio() },
      },
      vertexShader: `attribute float aDelay; uniform float uReveal; uniform float uSize; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);
          vA = clamp((uReveal - aDelay) * 3.0, 0.0, 1.0);
          gl_PointSize = uSize * (2.4 / -mv.z) * (0.6 + 0.4*vA);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; if (dot(c,c) > 0.25) discard; gl_FragColor = vec4(uColor, 0.85*vA);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
    }),
  );
  const landGeo = keep(new THREE.BufferGeometry());
  const landPoints = new THREE.Points(landGeo, landMat);
  // Les points arrivent après la création : sans ça, three.js calculerait une sphère
  // englobante vide et masquerait les continents dès que la caméra s'approche.
  landPoints.frustumCulled = false;
  globe.add(landPoints);
  fetch(opts.landUrl)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
    .then((buf) => {
      const raw = new Int16Array(buf);
      const n = raw.length / 2;
      const pos = new Float32Array(n * 3);
      const delay = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const lat = raw[i * 2] / 100;
        const lng = raw[i * 2 + 1] / 100;
        const v = latLngToVector(lat, lng, 1.002);
        pos.set([v.x, v.y, v.z], i * 3);
        delay[i] = (lng + 180) / 360 + Math.random() * 0.08;
      }
      landGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      landGeo.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
      landGeo.computeBoundingSphere();
    })
    .catch(() => undefined);

  // Colonnes de lumière : une par lieu, hauteur selon la couverture de presse.
  const columnGeo = keep(new THREE.CylinderGeometry(0.0035, 0.0055, 1, 6, 1, true).translate(0, 0.5, 0));
  const columnMat = keep(
    new THREE.MeshBasicMaterial({ color: COLORS.rose, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  let columns: THREE.InstancedMesh | null = null;
  const tipGeo = keep(new THREE.BufferGeometry());
  const tipMat = keep(
    new THREE.PointsMaterial({
      color: COLORS.rose,
      map: glow,
      size: 0.09,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const tipPoints = new THREE.Points(tipGeo, tipMat);
  tipPoints.frustumCulled = false; // positions réécrites à chaque image pendant l'arrivée
  globe.add(tipPoints);

  type Col = { place: HeroPlace; base: THREE.Vector3; normal: THREE.Vector3; height: number; delay: number };
  let cols: Col[] = [];

  // Ondes au sol autour des lieux les plus actifs.
  const ringGeo = keep(new THREE.RingGeometry(0.9, 1, 48));
  const rings: { mesh: THREE.Mesh; phase: number; scale: number }[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();

  function setPlaces(list: HeroPlace[]) {
    if (columns) {
      globe.remove(columns);
      columns.dispose();
    }
    for (const r of rings) {
      globe.remove(r.mesh);
      (r.mesh.material as THREE.Material).dispose();
    }
    rings.length = 0;
    const top = [...list].sort((a, b) => b.w - a.w).slice(0, MAX_PLACES);
    const max = Math.max(1, ...top.map((p) => p.w));
    cols = top.map((place, i) => {
      const normal = latLngToVector(place.lat, place.lng).normalize();
      return {
        place,
        normal,
        base: normal.clone().multiplyScalar(1.0),
        height: 0.04 + 0.42 * Math.sqrt(place.w / max),
        delay: 0.9 + (i / Math.max(1, top.length)) * 1.4,
      };
    });
    columns = new THREE.InstancedMesh(columnGeo, columnMat, Math.max(1, cols.length));
    columns.count = cols.length;
    columns.frustumCulled = false;
    globe.add(columns);
    tipGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cols.length * 3), 3));
    for (const c of cols.slice(0, 14)) {
      const mesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: COLORS.rose, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      mesh.position.copy(c.normal.clone().multiplyScalar(1.003));
      mesh.lookAt(c.normal.clone().multiplyScalar(2));
      globe.add(mesh);
      rings.push({ mesh, phase: Math.random(), scale: 0.03 + c.height * 0.12 });
    }
    layoutColumns(introDone ? 99 : elapsed);
  }

  function layoutColumns(t: number) {
    if (!columns) return;
    const tips = tipGeo.getAttribute("position") as THREE.BufferAttribute;
    cols.forEach((c, i) => {
      const grow = reduceMotion ? 1 : easeOut((t - c.delay) / 0.9);
      const h = Math.max(0.0001, c.height * grow);
      q.setFromUnitVectors(up, c.normal);
      columns!.setMatrixAt(i, m4.compose(c.base, q, s.set(1, h, 1)));
      const tip = c.normal.clone().multiplyScalar(1 + h);
      tips.setXYZ(i, tip.x, tip.y, tip.z);
    });
    columns.instanceMatrix.needsUpdate = true;
    tips.needsUpdate = true;
  }

  // Alertes SOS : faisceau rouge, halo qui clignote et onde au sol.
  // Faisceau rouge franc (mélange normal, pas additif : il doit rester rouge, pas virer au rose).
  const beamGeo = keep(new THREE.CylinderGeometry(0.003, 0.007, 0.3, 8, 1, true).translate(0, 0.15, 0));
  const beamMat = keep(new THREE.MeshBasicMaterial({ color: COLORS.sos, transparent: true, opacity: 0.95, depthWrite: false }));
  const sosGroup = new THREE.Group();
  globe.add(sosGroup);
  const sosParts: { glow: THREE.Sprite; ring: THREE.Mesh; phase: number }[] = [];
  let alertList: HeroAlert[] = [];

  function setAlerts(list: HeroAlert[]) {
    alertList = list;
    for (const p of sosParts) {
      (p.glow.material as THREE.Material).dispose();
      (p.ring.material as THREE.Material).dispose();
    }
    sosParts.length = 0;
    sosGroup.clear();
    list.forEach((a, i) => {
      const normal = latLngToVector(a.lat, a.lng).normalize();
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.copy(normal);
      beam.quaternion.setFromUnitVectors(up, normal);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glow, color: COLORS.sos, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
      );
      sprite.position.copy(normal.clone().multiplyScalar(1.02));
      sprite.scale.setScalar(0.12);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: COLORS.sos, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      ring.position.copy(normal.clone().multiplyScalar(1.004));
      ring.lookAt(normal.clone().multiplyScalar(2));
      sosGroup.add(beam, sprite, ring);
      sosParts.push({ glow: sprite, ring, phase: (i * 0.29) % 1 });
    });
  }

  // Caméra : trois cibles, mélangées selon le défilement, puis amorties.
  let progress = 0;
  let focus: { lat: number; lng: number } | null = null;
  let spin = facing(0, 12).y;
  let dragYaw = 0;
  let dragPitch = 0;
  const current = { x: 0.35, y: spin, dist: reduceMotion ? 3.4 : 10 };
  let elapsed = 0;
  let introDone = reduceMotion;

  function targets() {
    const world = { x: 0.35 + dragPitch, y: spin + dragYaw, dist: 3.4 };
    const f = focus ? facing(focus.lat, focus.lng) : { x: 0.6, y: facing(45, 5).y };
    const country = { x: f.x * 0.85 + 0.12 + dragPitch, y: f.y + dragYaw, dist: 2.05 };
    // L'alerte la plus proche du pays, sinon le pays lui-même, vu de plus près et de biais.
    let sos = country;
    if (alertList.length) {
      const ref = latLngToVector(focus?.lat ?? 46, focus?.lng ?? 2);
      const a = [...alertList].sort((p, q2) => latLngToVector(p.lat, p.lng).distanceTo(ref) - latLngToVector(q2.lat, q2.lng).distanceTo(ref))[0];
      const fa = facing(a.lat, a.lng);
      sos = { x: fa.x * 0.8 + 0.25 + dragPitch, y: fa.y + 0.28 + dragYaw, dist: 1.9 };
    } else {
      sos = { ...country, dist: 1.9 };
    }
    const k1 = reduceMotion ? 0 : smooth(0.14, 0.42, progress);
    const k2 = reduceMotion ? 0 : smooth(0.58, 0.86, progress);
    const mix = (a: number, b: number, k: number) => a + (b - a) * k;
    const y1 = shortest(world.y, country.y);
    const y2 = shortest(y1, sos.y);
    return {
      x: mix(mix(world.x, country.x, k1), sos.x, k2),
      y: mix(mix(world.y, y1, k1), y2, k2),
      dist: mix(mix(world.dist, country.dist, k1), sos.dist, k2),
    };
  }

  let running = false;
  const timer = new THREE.Timer();
  timer.connect(document);

  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.05);
    elapsed += dt;
    const t = elapsed;

    if (!introDone) {
      landMat.uniforms.uReveal.value = Math.min(1.5, t / 2.2);
      layoutColumns(t);
      if (t > INTRO_S + 1.5) {
        introDone = true;
        layoutColumns(99);
      }
    }
    if (!reduceMotion && progress < 0.2) spin += dt * 0.05;

    const target = targets();
    // Arrivée depuis l'espace au chargement, puis suivi amorti du défilement.
    const introDist = introDone || reduceMotion ? target.dist : THREE.MathUtils.lerp(10, target.dist, easeOut(t / INTRO_S));
    const k = reduceMotion ? 1 : 1 - Math.pow(0.0015, dt);
    current.x += (target.x - current.x) * k;
    current.y += (target.y - current.y) * k;
    current.dist += ((introDone ? target.dist : introDist) - current.dist) * (introDone ? k : 1);
    globe.rotation.set(current.x, current.y, 0, "XYZ");
    camera.position.set(0, 0, current.dist);
    camera.lookAt(0, 0, 0);
    stars.rotation.y = current.y * 0.15;

    if (!reduceMotion) {
      for (const r of rings) {
        const p = (t * 0.45 + r.phase) % 1;
        r.mesh.scale.setScalar(r.scale * (0.3 + p * 1.7));
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - p);
      }
      for (const p of sosParts) {
        const ph = (t * 0.9 + p.phase) % 1;
        p.ring.scale.setScalar(0.02 + ph * 0.09);
        (p.ring.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - ph);
        // Clignotement franc, une fois par seconde.
        p.glow.material.opacity = (t + p.phase) % 1 < 0.5 ? 1 : 0.35;
      }
    } else {
      for (const r of rings) {
        r.mesh.scale.setScalar(r.scale);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.4;
      }
      for (const p of sosParts) {
        p.ring.scale.setScalar(0.06);
        (p.ring.material as THREE.MeshBasicMaterial).opacity = 0.6;
      }
    }
    renderer.render(scene, camera);
  }

  const v = new THREE.Vector3();
  const worldNormal = new THREE.Vector3();
  function pick(x: number, y: number): HeroPlace | null {
    if (!cols.length) return null;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    globe.updateMatrixWorld();
    let best: HeroPlace | null = null;
    let bestD = 18 * 18;
    for (const c of cols) {
      worldNormal.copy(c.normal).applyQuaternion(globe.quaternion);
      // Face cachée du globe : ignorée.
      if (worldNormal.z < 0.2) continue;
      v.copy(c.normal).multiplyScalar(1 + c.height * 0.6).applyMatrix4(globe.matrixWorld).project(camera);
      const sx = ((v.x + 1) / 2) * w;
      const sy = ((1 - v.y) / 2) * h;
      const d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c.place;
      }
    }
    return best;
  }

  return {
    setProgress: (p) => (progress = THREE.MathUtils.clamp(p, 0, 1)),
    setPlaces,
    setAlerts,
    setFocus: (f) => (focus = f),
    pick,
    drag: (dx, dy) => {
      dragYaw += dx * 0.006;
      dragPitch = THREE.MathUtils.clamp(dragPitch + dy * 0.004, -0.6, 0.6);
    },
    resize: (width, height) => {
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      // Sur un écran étroit, on recule un peu pour garder le globe entier.
      camera.fov = camera.aspect < 0.8 ? 52 : 38;
      camera.updateProjectionMatrix();
      if (!running) frame();
    },
    start: () => {
      running = true;
      renderer.setAnimationLoop(frame);
    },
    stop: () => {
      running = false;
      renderer.setAnimationLoop(null);
    },
    dispose: () => {
      renderer.setAnimationLoop(null);
      timer.dispose();
      if (columns) columns.dispose();
      for (const r of rings) (r.mesh.material as THREE.Material).dispose();
      for (const p of sosParts) {
        (p.glow.material as THREE.Material).dispose();
        (p.ring.material as THREE.Material).dispose();
      }
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
