import "server-only";
import { createHash } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { cacheGet, cacheSet } from "@/lib/core/cache";

// Titre et résumé d'un article de presse, lus dans ses balises <title>, Open Graph
// et meta. Les URL viennent de GDELT, donc de l'extérieur : on refuse tout ce qui
// pointe vers le réseau interne, on limite la taille lue et la durée.

export type ArticlePreview = {
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  publishedAt: string | null;
  lang: string | null;
};

const MAX_BYTES = 400_000;
const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 3;
const PREVIEW_TTL = 7 * 24 * 3600;
const FAILED_TTL = 3600;

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocole refusé");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("port refusé");
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) throw new Error("adresse refusée");
  return url;
}

async function readLimited(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  const out = new Uint8Array(Math.min(size, MAX_BYTES));
  let offset = 0;
  for (const c of chunks) {
    const part = c.subarray(0, out.length - offset);
    out.set(part, offset);
    offset += part.length;
    if (offset >= out.length) break;
  }
  return out;
}

function decode(bytes: Uint8Array, contentType: string | null): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  const charset =
    contentType?.match(/charset=([\w-]+)/i)?.[1] ?? head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function clean(value: string | undefined, max: number): string | null {
  if (!value) return null;
  const text = value
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function meta(html: string, names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${name}["']`,
      "i",
    );
    const m = html.match(re);
    if (m) return m[1] ?? m[2];
  }
  return undefined;
}

export function parsePreview(url: string, html: string): ArticlePreview {
  const head = html.slice(0, 200_000);
  return {
    url,
    title: clean(meta(head, ["og:title", "twitter:title"]) ?? head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 200),
    description: clean(meta(head, ["og:description", "twitter:description", "description"]), 320),
    siteName: clean(meta(head, ["og:site_name", "application-name"]), 80),
    publishedAt: clean(meta(head, ["article:published_time", "datePublished", "pubdate", "date"]), 40),
    lang: clean(head.match(/<html[^>]+lang=["']([\w-]+)["']/i)?.[1], 10),
  };
}

async function fetchPreview(rawUrl: string): Promise<ArticlePreview> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // Vérifié à chaque saut. Limite connue : la résolution DNS est refaite par fetch.
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CortegeBot/1.0; +https://github.com/anasbenyaiche/startup-next-app)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      // Chaque redirection est revérifiée : elle pourrait viser le réseau interne.
      current = new URL(res.headers.get("location")!, url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!/html/i.test(res.headers.get("content-type") ?? "")) throw new Error("pas une page HTML");
    return parsePreview(rawUrl, decode(await readLimited(res), res.headers.get("content-type")));
  }
  throw new Error("trop de redirections");
}

export async function getArticlePreview(url: string): Promise<ArticlePreview | null> {
  const key = `preview:${createHash("sha1").update(url).digest("hex")}`;
  const cached = await cacheGet<ArticlePreview | { failed: true }>(key);
  if (cached) return "failed" in cached ? null : cached;
  try {
    const preview = await fetchPreview(url);
    await cacheSet(key, preview, PREVIEW_TTL);
    return preview;
  } catch {
    await cacheSet(key, { failed: true }, FAILED_TTL);
    return null;
  }
}
