import { getManifestations } from "@/lib/manifestations";

export const revalidate = 900;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hours = Math.min(72, Math.max(1, Number(url.searchParams.get("hours")) || 24));

  try {
    const data = await getManifestations(hours);
    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return Response.json({ error: message }, { status: 502 });
  }
}
