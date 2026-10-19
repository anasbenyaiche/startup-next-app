import { cacheGet, cacheSet } from "./cache";
import { distanceKm, listReports } from "./reports";

// Vidéos et lives d'un lieu, réunis depuis plusieurs sources :
// - YouTube (API officielle, lives compris), si YOUTUBE_API_KEY est défini ;
// - TikTok, trouvé par une recherche web (Brave Search), si BRAVE_SEARCH_API_KEY est défini.
//   TikTok n'ouvre pas sa propre recherche : on retrouve les liens par un moteur de recherche,
//   puis on affiche chaque vidéo avec le lecteur officiel ;
// - Mastodon (fils de hashtags publics), filtré sur le nom du lieu ;
// - les liens vidéo joints aux signalements des utilisateurs à proximité.
// Rien n'est hébergé ici : le navigateur charge le lecteur de la plateforme.

export type VideoPlatform = "youtube" | "tiktok" | "mastodon" | "link";

export type VideoItem = {
  id: string;
  platform: VideoPlatform;
  // Page de la vidéo sur la plateforme.
  url: string;
  // Lecteur intégré (iframe) ou fichier vidéo direct (Mastodon).
  embedUrl: string | null;
  fileUrl: string | null;
  thumbnail: string | null;
  title: string | null;
  author: string | null;
  publishedAt: string;
  live: boolean;
  source: "youtube" | "web" | "mastodon" | "report";
};

export type VideosResult = {
  updatedAt: string;
  videos: VideoItem[];
  // Sources interrogées (une clé absente désactive la source).
  sources: { youtube: boolean; web: boolean; mastodon: boolean };
};

type Place = {
  key: string;
  location: string;
  lat: number;
  lng: number;
  hours: number;
};

const CACHE_VERSION = "v1";
// Les recherches coûtent du quota (YouTube : 100 unités par recherche) : 10 minutes de cache par lieu.
const SEARCH_TTL = 10 * 60;
const MASTODON_TTL = 5 * 60;
const OEMBED_TTL = 24 * 3600;
const FETCH_TIMEOUT_MS = 6000;
const MAX_VIDEOS = 24;
const REPORT_RADIUS_KM = 20;
const MAX_TIKTOK = 10;

// Mots de la manifestation dans les langues du site, pour les recherches.
const KEYWORDS = [
  "manifestation",
  "manif",
  "grève",
  "protest",
  "strike",
  "manifestación",
  "protesta",
  "protesto",
  "Demo",
  "مظاهرة",
];
const MASTODON_TAGS = ["manif", "manifestation", "greve", "protest", "demo"];

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[videos] ${new URL(url).hostname} : HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[videos] ${new URL(url).hostname} : ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function cached<T>(key: string, ttl: number, load: () => Promise<T | null>): Promise<T | null> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await load();
  if (value !== null) await cacheSet(key, value, ttl);
  return value;
}

// Comparaison sans accents ni casse : « Besançon » trouve « besancon ».
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const cityOf = (location: string) => location.split(",")[0].trim();

export function parseVideoUrl(raw: string): {
  platform: VideoPlatform;
  id: string;
  embedUrl: string | null;
} {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { platform: "link", id: raw, embedUrl: null };
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  let yt: string | null = null;
  if (host === "youtu.be") yt = url.pathname.slice(1);
  else if (host === "youtube.com") {
    yt = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)/)?.[1] ?? null;
  }
  if (yt && /^[\w-]{6,20}$/.test(yt)) {
    return {
      platform: "youtube",
      id: yt,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1`,
    };
  }
  const tiktok = host.endsWith("tiktok.com") ? url.pathname.match(/\/video\/(\d{8,25})/)?.[1] : undefined;
  if (tiktok)
    return {
      platform: "tiktok",
      id: tiktok,
      embedUrl: `https://www.tiktok.com/embed/v2/${tiktok}`,
    };
  return { platform: "link", id: url.toString(), embedUrl: null };
}

// Les identifiants TikTok contiennent leur date de création (les 32 bits de poids fort, en secondes).
export function tiktokDate(id: string): string | null {
  try {
    const seconds = Number(BigInt(id) >> BigInt(32));
    return seconds > 1_400_000_000 && seconds < Date.now() / 1000 + 86400
      ? new Date(seconds * 1000).toISOString()
      : null;
  } catch {
    return null;
  }
}

type OEmbed = { title?: string; author_name?: string; thumbnail_url?: string };

async function tiktokOEmbed(url: string): Promise<OEmbed> {
  const base = process.env.TIKTOK_OEMBED_URL ?? "https://www.tiktok.com/oembed";
  return (
    (await cached(`videos:${CACHE_VERSION}:oembed:${url}`, OEMBED_TTL, () =>
      getJson<OEmbed>(`${base}?url=${encodeURIComponent(url)}`),
    )) ?? {}
  );
}

async function tiktokItem(url: string, source: VideoItem["source"], fallbackDate: string): Promise<VideoItem | null> {
  const parsed = parseVideoUrl(url);
  if (parsed.platform !== "tiktok") return null;
  const meta = await tiktokOEmbed(url);
  return {
    id: `tiktok:${parsed.id}`,
    platform: "tiktok",
    url,
    embedUrl: parsed.embedUrl,
    fileUrl: null,
    thumbnail: meta.thumbnail_url ?? null,
    title: meta.title || null,
    author: meta.author_name ? `@${meta.author_name}` : null,
    publishedAt: tiktokDate(parsed.id) ?? fallbackDate,
    live: false,
    source,
  };
}

type YouTubeSearch = {
  items?: {
    id: { videoId?: string };
    snippet: {
      title: string;
      channelTitle: string;
      publishedAt: string;
      liveBroadcastContent: "live" | "upcoming" | "none";
      thumbnails: Record<string, { url: string }>;
    };
  }[];
};

const decodeEntities = (s: string) =>
  s.replace(/&(amp|quot|#39|lt|gt);/g, (_, e) => ({ amp: "&", quot: '"', "#39": "'", lt: "<", gt: ">" })[e as string]!);

async function fromYouTube(place: Place): Promise<VideoItem[] | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  const base = process.env.YOUTUBE_API_URL ?? "https://www.googleapis.com/youtube/v3";
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    order: "date",
    maxResults: "15",
    q: `${cityOf(place.location)} ${KEYWORDS.join("|")}`,
    publishedAfter: new Date(Date.now() - Math.max(place.hours, 24) * 3600_000).toISOString(),
    key,
  });
  const json = await getJson<YouTubeSearch>(`${base}/search?${params}`);
  if (!json) return null;
  return (json.items ?? [])
    .filter((it) => it.id.videoId && it.snippet.liveBroadcastContent !== "upcoming")
    .map((it) => {
      const id = it.id.videoId!;
      const s = it.snippet;
      return {
        id: `youtube:${id}`,
        platform: "youtube" as const,
        url: `https://www.youtube.com/watch?v=${id}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
        fileUrl: null,
        thumbnail: (s.thumbnails.high ?? s.thumbnails.medium ?? s.thumbnails.default)?.url ?? null,
        title: decodeEntities(s.title),
        author: decodeEntities(s.channelTitle),
        publishedAt: s.publishedAt,
        live: s.liveBroadcastContent === "live",
        source: "youtube" as const,
      };
    });
}

type BraveSearch = { web?: { results?: { url: string }[] } };

async function fromWebSearch(place: Place): Promise<VideoItem[] | null> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return null;
  const base = process.env.BRAVE_SEARCH_URL ?? "https://api.search.brave.com/res/v1/web/search";
  const words = KEYWORDS.slice(0, 5).join(" OR ");
  const params = new URLSearchParams({
    q: `site:tiktok.com "${cityOf(place.location)}" (${words})`,
    freshness: place.hours <= 24 ? "pd" : "pw",
    count: "20",
  });
  const json = await getJson<BraveSearch>(`${base}?${params}`, {
    headers: { Accept: "application/json", "X-Subscription-Token": key },
  });
  if (!json) return null;
  const urls = [
    ...new Set((json.web?.results ?? []).map((r) => r.url).filter((u) => parseVideoUrl(u).platform === "tiktok")),
  ];
  const now = new Date().toISOString();
  const items = await Promise.all(urls.slice(0, MAX_TIKTOK).map((u) => tiktokItem(u, "web", now)));
  return items.filter((v): v is VideoItem => v !== null);
}

type MastodonStatus = {
  url: string | null;
  uri: string;
  created_at: string;
  content: string;
  account: { acct: string };
  media_attachments: {
    id: string;
    type: string;
    url: string;
    preview_url: string | null;
    description: string | null;
  }[];
};

// Les fils de hashtags sont partagés entre tous les lieux : un seul appel par hashtag toutes les 5 minutes.
async function fromMastodon(place: Place): Promise<VideoItem[] | null> {
  const instance = process.env.MASTODON_INSTANCE || "mastodon.social";
  if (instance === "off") return null;
  const base = instance.startsWith("http") ? instance : `https://${instance}`;
  const headers: Record<string, string> = process.env.MASTODON_TOKEN
    ? { Authorization: `Bearer ${process.env.MASTODON_TOKEN}` }
    : {};
  const timelines = await Promise.all(
    MASTODON_TAGS.map((tag) =>
      cached(`videos:${CACHE_VERSION}:mastodon:${base}:${tag}`, MASTODON_TTL, () =>
        getJson<MastodonStatus[]>(`${base}/api/v1/timelines/tag/${tag}?only_media=true&limit=40`, { headers }),
      ),
    ),
  );
  if (timelines.every((t) => t === null)) return null;
  const city = fold(cityOf(place.location));
  const since = Date.now() - Math.max(place.hours, 24) * 3600_000;
  const items: VideoItem[] = [];
  for (const status of timelines.flat()) {
    if (!status || Date.parse(status.created_at) < since) continue;
    const text = fold(status.content.replace(/<[^>]+>/g, " "));
    if (!new RegExp(`(^|[^\\p{L}])${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(text))
      continue;
    for (const m of status.media_attachments) {
      if (m.type !== "video" && m.type !== "gifv") continue;
      items.push({
        id: `mastodon:${m.url}`,
        platform: "mastodon",
        url: status.url ?? status.uri,
        embedUrl: null,
        fileUrl: m.url,
        thumbnail: m.preview_url,
        title:
          m.description ||
          status.content
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 140) ||
          null,
        author: `@${status.account.acct}`,
        publishedAt: status.created_at,
        live: false,
        source: "mastodon",
      });
    }
  }
  return items;
}

// Liens joints aux signalements proches : pas de cache, ils changent à chaque minute.
async function fromReports(place: Place): Promise<VideoItem[]> {
  const reports = (await listReports()).filter((r) => r.videoUrl && distanceKm(r, place) <= REPORT_RADIUS_KM);
  const items = await Promise.all(
    reports.map(async (r): Promise<VideoItem | null> => {
      const parsed = parseVideoUrl(r.videoUrl!);
      if (parsed.platform === "tiktok") return tiktokItem(r.videoUrl!, "report", r.createdAt);
      return {
        id: `${parsed.platform}:${parsed.id}`,
        platform: parsed.platform,
        url: r.videoUrl!,
        embedUrl: parsed.embedUrl,
        fileUrl: null,
        thumbnail: parsed.platform === "youtube" ? `https://i.ytimg.com/vi/${parsed.id}/hqdefault.jpg` : null,
        title: null,
        author: null,
        publishedAt: r.createdAt,
        live: false,
        source: "report",
      };
    }),
  );
  return items.filter((v): v is VideoItem => v !== null);
}

export async function getPlaceVideos(place: Place): Promise<VideosResult> {
  const searchKey = `videos:${CACHE_VERSION}:place:${place.key}:${place.hours}`;
  const [searched, fromUsers] = await Promise.all([
    cached(searchKey, SEARCH_TTL, async () => {
      const [youtube, web, mastodon] = await Promise.all([
        fromYouTube(place),
        fromWebSearch(place),
        fromMastodon(place),
      ]);
      return { youtube, web, mastodon };
    }),
    fromReports(place),
  ]);
  const all = [...fromUsers, ...(searched?.youtube ?? []), ...(searched?.web ?? []), ...(searched?.mastodon ?? [])];

  // Une même vidéo peut venir de plusieurs sources : on garde la première (signalement d'abord).
  const seen = new Set<string>();
  const videos = all
    .filter((v) => !seen.has(v.id) && seen.add(v.id))
    // Les lives d'abord, puis les plus récentes.
    .sort((a, b) => Number(b.live) - Number(a.live) || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_VIDEOS);

  return {
    updatedAt: new Date().toISOString(),
    videos,
    sources: {
      youtube: Boolean(process.env.YOUTUBE_API_KEY),
      web: Boolean(process.env.BRAVE_SEARCH_API_KEY),
      mastodon: process.env.MASTODON_INSTANCE !== "off",
    },
  };
}
