"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SosAlert } from "@/lib/community/alerts";
import { heroCountries, heroPlaces, type HeroFocus, type HeroPlace } from "@/lib/news/hero";
import { countryName, countryPath, dir, getDictionary, localePath, plural, type Locale } from "@/lib/i18n";
import type { HeroScene } from "./scene";
import { usePolling } from "../hooks/usePolling";

// Accueil en 3D : un écran collant de trois hauteurs d'écran. En faisant défiler,
// la caméra passe du monde au pays du visiteur, puis à une alerte SOS ; les textes
// de chaque acte apparaissent par-dessus la scène.

const ALERTS_REFRESH_MS = 30_000;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export default function Hero3D({
  locale,
  initialPlaces,
  initialCountries,
  initialIndex,
  visitorFips,
}: {
  locale: Locale;
  initialPlaces: HeroPlace[] | null;
  // Pays avec des manifestations, les plus actifs d'abord. Noms calculés côté serveur :
  // Node et le navigateur ne nomment pas toujours les pays pareil.
  initialCountries: (HeroFocus & { name: string })[] | null;
  // Pays montré en premier : celui du visiteur s'il en a, sinon le plus actif.
  initialIndex: number;
  visitorFips: string | null;
}) {
  const dict = getDictionary(locale);
  const t = dict.hero;
  const router = useRouter();
  const outer = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<HeroScene | null>(null);
  const [places, setPlaces] = useState(initialPlaces);
  const [countries, setCountries] = useState(initialCountries ?? []);
  const [startIndex, setStartIndex] = useState(initialIndex);
  const [index, setIndex] = useState(initialIndex);
  const focus = countries[index] ?? null;
  const name = focus?.name ?? null;
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [progress, setProgress] = useState(0);
  const [hover, setHover] = useState<{ place: HeroPlace; x: number; y: number } | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Sans données en cache côté serveur : lieux des 24 dernières heures demandés ici.
  useEffect(() => {
    if (initialPlaces) return;
    fetch("/api/manifestations?hours=24")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.places) return;
        setPlaces(heroPlaces(json));
        const { countries: list, start } = heroCountries(json, visitorFips);
        setCountries(list.map((c) => ({ ...c, name: countryName(locale, c.fips, c.fips) })));
        setStartIndex(start);
        setIndex(start);
      })
      .catch(() => undefined);
  }, [initialPlaces, visitorFips, locale]);

  usePolling<{ alerts: SosAlert[] }>("/api/alerts", ALERTS_REFRESH_MS, (json) => setAlerts(json.alerts));

  // Création de la scène (three.js chargé à la demande), animation seulement à l'écran.
  useEffect(() => {
    const el = canvas.current;
    const section = outer.current;
    if (!el || !section) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduceMotion(reduce);
    let disposed = false;
    let cleanup = () => {};
    import("./scene").then(async ({ createHeroScene }) => {
      const s = await createHeroScene({ canvas: el, reduceMotion: reduce, landUrl: "/geo/land-dots.bin" });
      if (!s) return;
      if (disposed) return s.dispose();
      scene.current = s;
      const resize = () => s.resize(el.clientWidth, el.clientHeight);
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? s.start() : s.stop()));
      io.observe(section);
      cleanup = () => {
        io.disconnect();
        ro.disconnect();
        s.dispose();
        scene.current = null;
      };
      // Les données arrivées avant la scène lui sont transmises maintenant.
      setPlaces((p) => p && [...p]);
      setAlerts((a) => [...a]);
      setCountries((c) => [...c]);
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (places) scene.current?.setPlaces(places);
  }, [places]);
  useEffect(() => {
    scene.current?.setAlerts(alerts);
  }, [alerts]);
  useEffect(() => {
    scene.current?.setFocus(focus ? { lat: focus.lat, lng: focus.lng } : null);
  }, [focus]);

  // Flèches : pays précédent ou suivant, en boucle ; le globe tourne vers lui.
  const step = (delta: number) => setIndex((i) => (countries.length ? (i + delta + countries.length) % countries.length : 0));

  // Flèches du clavier, quand le passage sur les pays est à l'écran.
  const act2Visible = useRef(false);
  const count = countries.length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!act2Visible.current || count < 2 || e.altKey || e.ctrlKey || e.metaKey) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setIndex((i) => (i + (e.key === "ArrowRight" ? 1 : -1) + count) % count);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  // Progression du défilement dans la section (0 en haut, 1 à la fin).
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const section = outer.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height - window.innerHeight)));
      scene.current?.setProgress(p);
      setProgress(Math.round(p * 200) / 200);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Glisser pour tourner le globe ; un simple clic sur une colonne ouvre le lieu.
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  const local = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (d) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.moved += Math.abs(dx) + Math.abs(dy);
      d.x = e.clientX;
      d.y = e.clientY;
      scene.current?.drag(dx, e.pointerType === "mouse" ? dy : 0);
      return;
    }
    if (e.pointerType !== "mouse") return;
    const { x, y } = local(e);
    const place = scene.current?.pick(x, y) ?? null;
    setHover(place ? { place, x, y } : null);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved > 6) return;
    const { x, y } = local(e);
    const place = scene.current?.pick(x, y);
    if (place) router.push(`${localePath(locale, "/manifestations")}?pays=${place.country}&lieu=${encodeURIComponent(place.key)}`);
  };

  // Opacité de chaque acte selon la progression.
  const o1 = 1 - smooth(0.1, 0.24, progress);
  const o2 = smooth(0.26, 0.38, progress) * (1 - smooth(0.56, 0.66, progress));
  const o3 = smooth(0.7, 0.82, progress);
  const act = (o: number) => ({ opacity: o, visibility: o < 0.02 ? ("hidden" as const) : ("visible" as const) });
  act2Visible.current = o2 > 0.5;
  const placeCount = places?.length ?? 0;
  const arrow =
    "flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-papier/70 bg-encre/40 text-papier backdrop-blur-sm transition-colors hover:border-rose hover:bg-rose hover:text-encre focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose";
  const pf = (n: number, p: { one: string; other: string }) => `${n.toLocaleString(locale)} ${plural(locale, n, p)}`;

  return (
    <section ref={outer} aria-labelledby="titre" className="relative h-[300svh] bg-[#12142b] text-papier">
      <div
        className="sticky top-0 h-[100svh] overflow-hidden"
        style={{ background: "radial-gradient(120% 90% at 60% 55%, #262b62 0%, #171a3c 45%, #0f1128 100%)" }}
      >
        <canvas
          ref={canvas}
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHover(null)}
          className={`absolute inset-0 h-full w-full touch-pan-y ${hover ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
        />

        {/* Acte 1 : la banderole et le nombre de lieux. */}
        <div className="pointer-events-none absolute inset-x-0 top-[12svh] transition-opacity duration-300" style={act(o1)}>
          <div className="-mx-4 -rotate-2 border-y-[3px] border-encre bg-rose px-8 py-5 shadow-[0_18px_60px_rgba(255,79,163,0.35)] sm:py-7">
            <h1 id="titre" className="display text-center text-balance text-encre text-[clamp(2.4rem,8.5vw,7.5rem)]">
              {dict.home.banner}
            </h1>
          </div>
          <p className="mx-auto mt-8 max-w-5xl px-6 text-lg sm:text-xl [text-shadow:0_2px_14px_rgba(15,17,40,0.95)]">
            <strong className="display text-[clamp(2rem,5vw,3.2rem)] tabular-nums text-rose">{placeCount.toLocaleString(locale)}</strong>{" "}
            {plural(locale, placeCount, t.places)} {t.window}
          </p>
        </div>

        {/* Acte 2 : le pays du visiteur (ou le plus actif). Les textes sont placés à gauche ou à
            droite selon la scène 3D, qui ne s'inverse pas en arabe. */}
        {focus && name && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-[8svh] px-6 transition-opacity duration-300 md:inset-x-auto md:bottom-auto md:right-[6vw] md:top-1/2 md:max-w-md md:-translate-y-1/2 [text-shadow:0_2px_14px_rgba(15,17,40,0.95)]"
            style={act(o2)}
          >
            {index === startIndex && !focus.isVisitor && <p className="mb-2 text-papier/75">{t.topNote}</p>}
            <h2 className="display text-[clamp(2.6rem,7vw,5rem)] leading-[0.95]" aria-live="polite">
              {name}
            </h2>
            <p className="mt-3 text-lg text-papier/85">
              {t.countryLine(pf(focus.incidents, dict.map.protests), pf(focus.places, dict.map.places))}
            </p>
            <Link
              href={countryPath(locale, focus.fips)}
              className="pointer-events-auto mt-6 inline-block rounded-[3px] border-[1.5px] border-papier bg-papier px-5 py-3 font-semibold text-encre hover:bg-rose hover:border-rose"
            >
              {t.seeCountry(name)}
            </Link>
            {countries.length > 1 && (
              // La scène ne s'inverse pas en arabe : ‹ fait toujours tourner vers le pays précédent.
              <div dir="ltr" className="pointer-events-auto mt-6 flex items-center gap-3">
                <button onClick={() => step(-1)} aria-label={t.prevCountry} className={arrow}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
                    <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span dir={dir(locale)} className="min-w-[4.5rem] text-center text-sm tabular-nums text-papier/75">
                  {t.countryOf(index + 1, countries.length)}
                </span>
                <button onClick={() => step(1)} aria-label={t.nextCountry} className={arrow}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
                    <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Acte 3 : l'alerte SOS. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[8svh] px-6 transition-opacity duration-300 md:inset-x-auto md:bottom-auto md:left-[6vw] md:top-1/2 md:max-w-md md:-translate-y-1/2 [text-shadow:0_2px_14px_rgba(15,17,40,0.95)]"
          style={act(o3)}
        >
          <div className="flex items-center gap-4">
            <span className="sos-dot sos-dot-lg" aria-hidden="true">
              <span className="text-base font-black text-white">{dict.sos.button}</span>
            </span>
            <h2 className="display text-[clamp(2.2rem,5.5vw,3.8rem)] leading-[0.95]">{t.sosTitle}</h2>
          </div>
          <p className="mt-4 text-lg text-papier/85">{t.sosText}</p>
          <p className="mt-3 font-semibold text-[#ff6b73]" role="status">
            {alerts.length > 0 ? pf(alerts.length, dict.sos.active) : dict.sos.homeNone}
          </p>
          <Link
            href={localePath(locale, "/manifestations")}
            className="pointer-events-auto mt-6 inline-block rounded-[4px] border-[2px] border-papier bg-[#c0262d] px-5 py-3 text-lg font-bold text-white hover:bg-[#d8313a]"
          >
            {t.sosCta}
          </Link>
        </div>

        {/* Indications du bas : défiler, et survoler (souris seulement). */}
        <div className="pointer-events-none absolute inset-x-0 bottom-5 flex flex-col items-center gap-2 text-sm text-papier/70" style={act(o1)}>
          <span className="hidden [@media(pointer:fine)]:inline">{t.hint}</span>
          <span className="flex flex-col items-center gap-1">
            {t.scroll}
            <span className={`block h-7 w-px bg-papier/60 ${reduceMotion ? "" : "animate-pulse"}`} aria-hidden="true" />
          </span>
        </div>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-[3px] border-[1.5px] border-encre bg-papier px-3 py-2 text-encre shadow-[3px_3px_0_rgb(var(--rose))]"
            style={{ left: hover.x + 16, top: hover.y + 16 }}
          >
            <p className="font-bold leading-tight">{hover.place.name}</p>
            <p className="text-xs text-gris">{t.open}</p>
          </div>
        )}
      </div>
    </section>
  );
}
