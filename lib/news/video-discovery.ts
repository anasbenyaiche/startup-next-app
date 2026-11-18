// Recherche ciblée, testable sans appeler les plateformes.
// Un lieu GDELT peut être "Paris, France" : on recherche d'abord la ville.
export const VIDEO_SEARCH_TERMS = [
  "manifestation", "protest", "grève", "strike", "manifestación", "protesta", "احتجاج",
] as const;

export function videoCity(location: string): string {
  return location.split(",")[0]?.trim().slice(0, 100) ?? "";
}

export function youtubeVideoQuery(location: string): string {
  const city = videoCity(location).replace(/["\\]/g, " ").trim();
  return `"${city}" (manifestation OR protest OR strike OR grève)`;
}

export function braveVideoQueries(location: string): string[] {
  const city = videoCity(location).replace(/["\\]/g, " ").trim();
  return [
    `site:tiktok.com "${city}" (manifestation OR protest OR grève)`,
    `site:tiktok.com "${city}" (manifestación OR protesta OR strike)`,
  ];
}

export function withinVideoWindow(publishedAt: string, hours: number, now = Date.now()): boolean {
  const timestamp = Date.parse(publishedAt);
  return Number.isFinite(timestamp) && timestamp <= now + 5 * 60_000
    && timestamp >= now - Math.max(hours, 24) * 3_600_000;
}
