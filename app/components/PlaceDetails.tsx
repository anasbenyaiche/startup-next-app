"use client";

import { useEffect, useState } from "react";
import type { ArticlePreview } from "@/lib/news/article-preview";
import { countryName, getDictionary, plural, type Locale } from "@/lib/i18n";
import type { ActorStat, PlaceDetails as Details } from "@/lib/news/manifestations";
import { FAMILY_COLORS, TYPE_FAMILY } from "./map-colors";
import { LoadingRegion, SKELETON_WIDTHS, Skeleton } from "./Skeleton";
import VideoCarousel from "./VideoCarousel";

// Les premiers articles sont les plus sûrs (triés par confiance) ; le reste sur demande.
const ARTICLES_SHOWN = 8;

// Hauteurs fixes de l'histogramme fantôme (même nombre de barres que le vrai pour 24 h).
const GHOST_BARS = [30, 45, 38, 52, 60, 44, 70, 55, 48, 62, 80, 66, 58, 72, 50, 64, 76, 54, 42, 58, 68, 46, 36, 50];

function DetailsSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label} className="space-y-6">
      <header className="space-y-2.5">
        <Skeleton className="h-9 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-3/4" />
      </header>
      <div className="grid grid-cols-3 gap-3 border-y-[1.5px] border-encre/20 py-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-3.5 w-52" />
        <Skeleton className="h-3.5 w-48" />
      </div>
      <div>
        <Skeleton className="h-5 w-48 mb-3" />
        <div className="flex h-16 items-end gap-[2px]" aria-hidden="true">
          {GHOST_BARS.map((h, i) => (
            <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        {SKELETON_WIDTHS.slice(0, 3).map((w, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5" style={{ width: w }} />
            <Skeleton className="h-2 rounded-full" style={{ width: `${90 - i * 25}%` }} />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-36" />
        <div className="flex flex-wrap gap-1.5">
          {["w-16", "w-28", "w-20", "w-24"].map((w) => (
            <Skeleton key={w} className={`h-7 rounded-full ${w}`} />
          ))}
        </div>
      </div>
      <ArticlesSkeleton count={3} />
    </LoadingRegion>
  );
}

function ArticlesSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {SKELETON_WIDTHS.slice(0, count).map((w, i) => (
        <div key={i} className="border-s-[3px] border-encre/10 ps-3 space-y-1.5">
          <Skeleton className="h-4" style={{ width: w }} />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

type State = { status: "loading" } | { status: "error"; notFound: boolean } | { status: "ready"; details: Details };

function toneKey(tone: number) {
  if (tone < -5) return "veryNegative";
  if (tone < -2) return "negative";
  if (tone <= 2) return "neutral";
  return "positive";
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
}

// Histogramme des signalements par tranche de temps : une seule série, donc une
// seule teinte et pas de légende ; le survol donne la valeur exacte de chaque barre.
function Timeline({ timeline, locale, tip }: { timeline: Details["timeline"]; locale: Locale; tip: (n: number, a: string, b: string) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const { counts, bucketMinutes } = timeline;
  const start = Date.parse(timeline.start);
  const max = Math.max(1, ...counts);
  const width = 300;
  const height = 64;
  const gap = 2;
  const barW = (width - gap * (counts.length - 1)) / counts.length;
  const fmt = (ms: number) =>
    new Date(ms).toLocaleString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  const bucketMs = bucketMinutes * 60_000;

  return (
    <figure>
      <div className="h-5 text-sm text-gris tabular-nums" aria-live="polite">
        {hover !== null
          ? tip(counts[hover], fmt(start + hover * bucketMs), fmt(start + (hover + 1) * bucketMs))
          : `max ${max.toLocaleString(locale)}`}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 overflow-visible" role="img" onMouseLeave={() => setHover(null)}>
        <line x1="0" x2={width} y1={height} y2={height} stroke="rgb(var(--encre))" strokeOpacity="0.25" />
        {counts.map((n, i) => {
          const x = i * (barW + gap);
          const h = n === 0 ? 0 : Math.max(2, (n / max) * (height - 4));
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              {/* Zone de survol plus grande que la barre. */}
              <rect x={x} y={0} width={barW + gap} height={height} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${height} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                  fill="rgb(var(--encre))"
                  fillOpacity={hover === null || hover === i ? 0.85 : 0.35}
                />
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-gris">
        <span>{fmt(start)}</span>
        <span>{fmt(start + counts.length * bucketMs)}</span>
      </figcaption>
    </figure>
  );
}

function ActorList({ actors, labels, empty }: { actors: ActorStat[]; labels: Record<string, string>; empty: string }) {
  // Catégories d'abord (traduites), puis les noms cités par la presse.
  const types = actors.filter((a) => a.kind === "type");
  const names = actors.filter((a) => a.kind === "name");
  if (actors.length === 0) return <p className="text-gris">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {[...types, ...names].map((a) => (
        <li
          key={`${a.kind}:${a.value}`}
          className={`rounded-full border-[1.5px] px-2.5 py-0.5 text-sm ${a.kind === "type" ? "border-encre" : "border-encre/25"}`}
        >
          {a.kind === "type" ? (labels[a.value] ?? a.value) : titleCase(a.value)}
          <span className="ms-1.5 text-gris tabular-nums">{a.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PlaceDetails({
  placeKey,
  hours,
  locale,
  onBack,
  renderFollow,
}: {
  placeKey: string;
  hours: number;
  locale: Locale;
  onBack: () => void;
  // Bouton « Suivre ce lieu », fourni par la carte qui connaît le profil.
  renderFollow?: (details: Details) => React.ReactNode;
}) {
  const t = getDictionary(locale);
  const d = t.details;
  const [state, setState] = useState<State>({ status: "loading" });
  const [previews, setPreviews] = useState<Record<string, ArticlePreview>>({});
  const [allArticles, setAllArticles] = useState(false);
  const [previewsLoading, setPreviewsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    setPreviews({});
    setAllArticles(false);
    setPreviewsLoading(true);
    const q = `hours=${hours}&key=${encodeURIComponent(placeKey)}`;
    fetch(`/api/manifestations/place?${q}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) return setState({ status: "error", notFound: res.status === 404 });
        setState({ status: "ready", details: await res.json() });
        // Les aperçus d'articles arrivent ensuite : ils demandent de lire chaque page.
        const p = await fetch(`/api/manifestations/articles?${q}`).then((r) => (r.ok ? r.json() : { previews: [] }));
        if (cancelled) return;
        setPreviews(Object.fromEntries((p.previews as ArticlePreview[]).map((a) => [a.url, a])));
        setPreviewsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Un échec des aperçus seuls laisse les articles affichés par leur domaine.
        setState((prev) => (prev.status === "ready" ? prev : { status: "error", notFound: false }));
        setPreviewsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [placeKey, hours]);

  const back = (
    <button onClick={onBack} className="text-sm font-semibold text-bleu hover:underline underline-offset-4">
      {d.back}
    </button>
  );

  if (state.status === "loading") {
    return (
      <div className="space-y-6">
        {back}
        <DetailsSkeleton label={d.loading} />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="space-y-4">
        {back}
        <p className={state.notFound ? "text-gris" : "text-[#c0262d]"}>{state.notFound ? d.notFound : d.failed}</p>
      </div>
    );
  }

  const x = state.details;
  const n = (v: number) => v.toLocaleString(locale);
  const time = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  const maxType = Math.max(1, ...x.types.map((ty) => ty.incidents));
  const levelColor = { high: "bg-encre", medium: "bg-gris", low: "bg-transparent" }[x.reliability.level];

  return (
    <article className="space-y-6">
      {back}

      <header>
        <div className="flex items-start justify-between gap-3">
          <h1 className="display text-[2.2rem]">{x.location.split(",")[0]}</h1>
          {renderFollow?.(x)}
        </div>
        <p className="mt-1 text-gris">{[...x.location.split(",").slice(1, -1).map((s) => s.trim()), countryName(locale, x.country, x.countryName)].join(", ")}</p>
        <p className="mt-2 text-sm flex items-start gap-2">
          <span
            className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full border-[1.5px] border-encre ${x.precision === "region" ? "border-dashed" : "bg-encre"}`}
            aria-hidden="true"
          />
          {x.precision === "city" ? d.precisionCity : d.precisionRegion}
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3 border-y-[1.5px] border-encre py-3">
        <div>
          <p className="text-2xl font-bold tabular-nums">{n(x.incidents)}</p>
          <p className="text-sm text-gris leading-tight">
            {plural(locale, x.incidents, t.map.protests)} {d.estimated}
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{n(x.reports)}</p>
          <p className="text-sm text-gris leading-tight">{plural(locale, x.reports, d.reports)}</p>
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums">{n(x.mentions)}</p>
          <p className="text-sm text-gris leading-tight">{plural(locale, x.mentions, t.map.mentions)}</p>
        </div>
      </section>

      <section>
        <h2 className="font-bold mb-2 flex items-center gap-2">
          {d.reliability}
          <span className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-full border-[1.5px] border-encre ${levelColor}`} aria-hidden="true" />
            {d.levels[x.reliability.level]}
          </span>
          <span className="text-gris font-normal tabular-nums">{x.reliability.score}/100</span>
        </h2>
        <ul className="text-sm space-y-0.5 text-encre/80">
          <li>
            {n(x.reliability.domains)} {plural(locale, x.reliability.domains, d.media)}
          </li>
          {x.reliability.avgConfidence !== null && <li>{d.confidence(x.reliability.avgConfidence)}</li>}
          <li>{d.rootShare(Math.round(x.reliability.rootShare * 100))}</li>
        </ul>
      </section>

      <section>
        <h2 className="font-bold">{d.timeline}</h2>
        <Timeline timeline={x.timeline} locale={locale} tip={d.timelineTip} />
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-xs text-gris">
          <dt>{d.firstSeen}</dt>
          <dd>{time(x.firstSeen)}</dd>
          <dt>{d.lastSeen}</dt>
          <dd>{time(x.lastSeen)}</dd>
        </dl>
      </section>

      <section>
        <h2 className="font-bold mb-2">{d.types}</h2>
        <ul className="space-y-2">
          {x.types.map((ty) => (
            <li key={ty.type}>
              <div className="flex justify-between text-sm">
                <span>{t.types[ty.type]}</span>
                <span className="text-gris tabular-nums">{n(ty.incidents)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-encre/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(ty.incidents / maxType) * 100}%`, background: FAMILY_COLORS[TYPE_FAMILY[ty.type]] }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-bold mb-2">{d.protesters}</h2>
        <ActorList actors={x.protesters} labels={t.actorTypes} empty={d.unknownActors} />
      </section>
      <section>
        <h2 className="font-bold mb-2">{d.targets}</h2>
        <ActorList actors={x.targets} labels={t.actorTypes} empty={d.unknownActors} />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div>
          <h2 className="font-bold">{d.tone}</h2>
          <p>
            {d.toneLabels[toneKey(x.tone)]} <span className="text-gris tabular-nums">({x.tone.toLocaleString(locale)})</span>
          </p>
        </div>
        <div>
          <h2 className="font-bold">{d.conflict}</h2>
          <p className="tabular-nums">{x.goldstein.toLocaleString(locale)}</p>
          <p className="text-xs text-gris">{d.conflictHint}</p>
        </div>
      </section>

      <section>
        <h2 className="font-bold mb-2">{d.articles}</h2>
        {x.articles.length === 0 ? (
          <p className="text-gris">{d.noArticles}</p>
        ) : (
          <ol className="space-y-3">
            {x.articles.slice(0, allArticles ? undefined : ARTICLES_SHOWN).map((a, i) => {
              const p = previews[a.url];
              if (!p && previewsLoading && i < ARTICLES_SHOWN) {
                return (
                  <li key={a.url} className="border-s-[3px] ps-3 space-y-1.5" style={{ borderColor: FAMILY_COLORS[TYPE_FAMILY[a.type]] }}>
                    <Skeleton className="h-4" style={{ width: SKELETON_WIDTHS[i] }} />
                    <Skeleton className="h-3 w-full" />
                    <p className="text-xs text-gris">
                      {a.domain}, {time(a.addedAt)}
                    </p>
                  </li>
                );
              }
              return (
                <li key={a.url} className="border-s-[3px] ps-3" style={{ borderColor: FAMILY_COLORS[TYPE_FAMILY[a.type]] }}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    lang={p?.lang ?? undefined}
                    className="font-semibold leading-snug hover:text-bleu hover:underline underline-offset-4"
                  >
                    {p?.title ?? a.domain}
                  </a>
                  {p?.description && (
                    <p lang={p.lang ?? undefined} className="mt-0.5 text-sm text-encre/80 line-clamp-3">
                      {p.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-gris">
                    {p?.siteName ?? a.domain}, {time(a.addedAt)}
                    {a.confidence !== null && <>, {d.confidenceShort(a.confidence)}</>}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
        {!allArticles && x.articles.length > ARTICLES_SHOWN && (
          <button
            onClick={() => setAllArticles(true)}
            className="mt-3 text-sm font-semibold text-bleu hover:underline underline-offset-4"
          >
            {d.showAllArticles(x.articles.length)}
          </button>
        )}
      </section>

      <VideoCarousel placeKey={placeKey} hours={hours} locale={locale} />

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">{d.method}</summary>
        <p className="mt-2 text-encre/80 leading-relaxed">{d.methodText}</p>
      </details>
    </article>
  );
}
