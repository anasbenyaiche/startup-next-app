import { listPublished } from "@/lib/community/announcements";
import { ANNOUNCEMENTS_ENABLED } from "@/lib/core/features";

// Manifestations annoncées et publiées, pour la carte.
export async function GET() {
  return Response.json(
    { updatedAt: new Date().toISOString(), announcements: ANNOUNCEMENTS_ENABLED ? await listPublished() : [] },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}
