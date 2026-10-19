import { listPublished } from "@/lib/announcements";

// Manifestations annoncées et publiées, pour la carte.
export async function GET() {
  return Response.json(
    { updatedAt: new Date().toISOString(), announcements: await listPublished() },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}
