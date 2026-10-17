import { getArticlePreview } from "@/lib/article-preview";
import { parseHours, parsePlaceKey } from "@/lib/api-params";
import { getPlaceDetails } from "@/lib/manifestations";

const MAX_PREVIEWS = 8;
const CONCURRENCY = 4;

// Aperçus (titre, résumé) des articles d'un lieu. Seules les URL présentes dans
// les données du lieu sont lues : la route ne sert pas à récupérer n'importe quelle page.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const hours = parseHours(params.get("hours"));
  const key = parsePlaceKey(params.get("key"));
  if (!key) return Response.json({ error: "Clé de lieu invalide" }, { status: 400 });

  const details = await getPlaceDetails(hours, key).catch(() => null);
  if (!details) return Response.json({ previews: [] });

  const urls = details.articles.slice(0, MAX_PREVIEWS).map((a) => a.url);
  const previews = [];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    previews.push(...(await Promise.all(urls.slice(i, i + CONCURRENCY).map(getArticlePreview))));
  }
  return Response.json(
    { previews: previews.filter(Boolean) },
    { headers: { "Cache-Control": "public, s-maxage=3600" } },
  );
}
