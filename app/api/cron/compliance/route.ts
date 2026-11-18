import { recheckAll } from "@/lib/community/announcements";

// Nouvelle vérification de conformité de toutes les annonces, une fois par jour
// (vercel.json). Vercel envoie « Authorization: Bearer <CRON_SECRET> ».
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  const result = await recheckAll();
  console.info("[compliance] nouvelle vérification", result);
  return Response.json(result);
}
