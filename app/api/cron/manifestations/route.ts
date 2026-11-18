import { parseHours } from "@/lib/news/api-params";
import { getManifestations } from "@/lib/news/manifestations";

// Préchauffage authentifié, une période par appel, borné pour Vercel.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  const hours = parseHours(new URL(request.url).searchParams.get("hours"));
  try {
    const data = await getManifestations(hours, 35_000);
    return Response.json(
      {
        hours, updatedAt: data.updatedAt, partial: data.partial, stale: data.stale === true,
        slotsLoaded: data.slotsLoaded, slotsTotal: data.slotsTotal, filesFailed: data.filesFailed,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[cron/manifestations] échec de préchauffage", error);
    return Response.json({ error: "Source temporairement indisponible" }, { status: 503 });
  }
}
