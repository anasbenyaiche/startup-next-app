"use client";

import { useEffect, useRef, useState } from "react";
import { getDictionary, type Locale } from "@/lib/i18n";
import type { VideoItem, VideosResult } from "@/lib/videos";
import { relativeTime } from "./relativeTime";
import { Skeleton } from "./Skeleton";

const REFRESH_MS = 2 * 60 * 1000;

const PLATFORM_NAMES: Record<VideoItem["platform"], string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  mastodon: "Mastodon",
  link: "",
};

function platformName(v: VideoItem): string {
  if (v.platform !== "link") return PLATFORM_NAMES[v.platform];
  try {
    return new URL(v.url).hostname.replace(/^www\./, "");
  } catch {
    return v.url;
  }
}

// Une vignette tant qu'on n'a pas cliqué : le lecteur de la plateforme (lourd, et qui
// peut déposer ses cookies) ne se charge que si la personne lance la vidéo.
function VideoCard({ video, locale }: { video: VideoItem; locale: Locale }) {
  const t = getDictionary(locale).videos;
  const [playing, setPlaying] = useState(false);
  const canPlay = Boolean(video.embedUrl || video.fileUrl);
  const vertical = video.platform === "tiktok";
  const name = platformName(video);

  let media: React.ReactNode;
  if (playing && video.fileUrl) {
    media = <video src={video.fileUrl} controls autoPlay playsInline className="h-full w-full object-contain" />;
  } else if (playing && video.embedUrl) {
    media = (
      <iframe
        src={video.embedUrl}
        title={video.title ?? name}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="h-full w-full border-0"
      />
    );
  } else {
    media = (
      <>
        {video.thumbnail ? (
          // Vignettes hébergées par chaque plateforme : pas d'optimisation d'image possible.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-papier/80">
            {name}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-encre/75 text-papier text-xl ps-1">
            ▶
          </span>
        </span>
      </>
    );
  }

  return (
    <li className="snap-start shrink-0 w-[13.5rem]">
      <div
        className={`relative overflow-hidden rounded-[3px] border-[1.5px] border-encre bg-encre ${
          playing && !vertical ? "aspect-video" : "aspect-[9/14]"
        }`}
      >
        {!playing && canPlay ? (
          <button
            onClick={() => setPlaying(true)}
            className="absolute inset-0 h-full w-full"
            aria-label={`${t.play} (${name})`}
          >
            {media}
          </button>
        ) : !playing ? (
          <a href={video.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 block">
            {media}
          </a>
        ) : (
          media
        )}
        <span className="pointer-events-none absolute top-1.5 start-1.5 flex gap-1">
          {video.live && (
            <span className="rounded-[3px] bg-[#c0262d] px-1.5 py-0.5 text-[0.7rem] font-bold text-white">
              ● {t.live}
            </span>
          )}
          {video.source === "report" && (
            <span className="rounded-[3px] bg-papier px-1.5 py-0.5 text-[0.7rem] font-semibold text-encre">
              {t.fromReport}
            </span>
          )}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-snug line-clamp-2">{video.title ?? name}</p>
      <p className="text-xs text-gris">
        {[name, video.author, relativeTime(locale, video.publishedAt)].filter(Boolean).join(" · ")}
        {" · "}
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-bleu hover:underline underline-offset-4"
        >
          {t.open}
        </a>
      </p>
    </li>
  );
}

export default function VideoCarousel({
  placeKey,
  hours,
  locale,
}: {
  placeKey: string;
  hours: number;
  locale: Locale;
}) {
  const t = getDictionary(locale).videos;
  const [data, setData] = useState<VideosResult | null>(null);
  const [failed, setFailed] = useState(false);
  const track = useRef<HTMLOListElement>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    const load = () =>
      fetch(`/api/videos?hours=${hours}&key=${encodeURIComponent(placeKey)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((json: VideosResult) => {
          if (cancelled) return;
          // Une vidéo en cours de lecture ne doit pas disparaître : on ne fait qu'ajouter.
          setData((prev) => {
            if (!prev) return json;
            const known = new Set(prev.videos.map((v) => v.id));
            const added = json.videos.filter((v) => !known.has(v.id));
            return added.length ? { ...json, videos: [...added, ...prev.videos] } : prev;
          });
        })
        .catch(() => !cancelled && setFailed(true));
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [placeKey, hours]);

  const scroll = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    // En arabe la piste défile de droite à gauche : « suivant » va vers la gauche.
    const sign = getComputedStyle(el).direction === "rtl" ? -1 : 1;
    el.scrollBy({
      left: direction * sign * el.clientWidth * 0.8,
      behavior: "smooth",
    });
  };

  const arrow = "h-8 w-8 rounded-full border-[1.5px] border-encre font-bold hover:bg-papier-fonce disabled:opacity-30";

  return (
    <section aria-label={t.title}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-bold">{t.title}</h2>
        {data && data.videos.length > 1 && (
          <div className="flex gap-1.5">
            <button onClick={() => scroll(-1)} className={arrow} aria-label={t.previous}>
              <span className="inline-block rtl:rotate-180">‹</span>
            </button>
            <button onClick={() => scroll(1)} className={arrow} aria-label={t.next}>
              <span className="inline-block rtl:rotate-180">›</span>
            </button>
          </div>
        )}
      </div>

      {!data && !failed ? (
        <div className="flex gap-3 overflow-hidden" role="status" aria-label={t.loading}>
          {[0, 1].map((i) => (
            <div key={i} className="shrink-0 w-[13.5rem] space-y-1.5">
              <Skeleton className="aspect-[9/14] w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
        </div>
      ) : !data || data.videos.length === 0 ? (
        <div className="text-sm">
          <p className="text-gris">{t.empty}</p>
          <p className="text-gris">{t.emptyHint}</p>
        </div>
      ) : (
        <>
          <ol
            ref={track}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 items-start [scrollbar-width:thin]"
          >
            {data.videos.map((v) => (
              <VideoCard key={v.id} video={v} locale={locale} />
            ))}
          </ol>
          <p className="mt-1 text-xs text-gris">{t.playerNotice}</p>
        </>
      )}
    </section>
  );
}
