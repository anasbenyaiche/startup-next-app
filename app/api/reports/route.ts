import { listReports } from "@/lib/community/reports";

// Signalements actifs des utilisateurs. Très court cache partagé : la carte les
// redemande toutes les minutes et ils doivent rester frais.
export async function GET() {
  const reports = await listReports();
  return Response.json(
    { updatedAt: new Date().toISOString(), reports },
    {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20",
      },
    },
  );
}
