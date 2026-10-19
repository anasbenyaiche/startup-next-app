import type { ManifestationsResult } from "@/lib/news/manifestations";

// Données de la scène 3D de l'accueil, préparées côté serveur quand les données sont
// en cache (sinon dans le navigateur) : lieux allégés et pays mis en avant.

export type HeroPlace = { key: string; name: string; country: string; lat: number; lng: number; w: number };
export type HeroFocus = { fips: string; incidents: number; places: number; lat: number; lng: number; isVisitor: boolean };

export function heroPlaces(data: ManifestationsResult): HeroPlace[] {
  return data.places.map((p) => ({
    key: p.key,
    name: p.location.split(",")[0],
    country: p.country,
    lat: p.lat,
    lng: p.lng,
    w: Object.values(p.byType).reduce((n, s) => n + s.mentions, 0),
  }));
}

// Tous les pays avec des manifestations, les plus actifs d'abord, et celui à montrer en
// premier : le pays du visiteur s'il en a, sinon le plus actif. La position d'un pays est le
// centre de ses lieux pondérés par leur couverture (moyenne sur la sphère, pas en degrés).
export function heroCountries(
  data: ManifestationsResult,
  visitorFips: string | null,
): { countries: HeroFocus[]; start: number } {
  const byCountry = new Map<string, { incidents: number; places: number; x: number; y: number; z: number }>();
  for (const p of data.places) {
    const c = byCountry.get(p.country) ?? { incidents: 0, places: 0, x: 0, y: 0, z: 0 };
    const w = Object.values(p.byType).reduce((n, s) => n + s.mentions, 0) || 1;
    const lat = (p.lat * Math.PI) / 180;
    const lng = (p.lng * Math.PI) / 180;
    c.x += Math.cos(lat) * Math.cos(lng) * w;
    c.y += Math.cos(lat) * Math.sin(lng) * w;
    c.z += Math.sin(lat) * w;
    c.incidents += Object.values(p.byType).reduce((n, s) => n + s.incidents, 0);
    c.places++;
    byCountry.set(p.country, c);
  }
  const countries = [...byCountry.entries()]
    .sort((a, b) => b[1].incidents - a[1].incidents)
    .map(([fips, c]) => ({
      fips,
      incidents: c.incidents,
      places: c.places,
      lat: (Math.atan2(c.z, Math.hypot(c.x, c.y)) * 180) / Math.PI,
      lng: (Math.atan2(c.y, c.x) * 180) / Math.PI,
      isVisitor: fips === visitorFips,
    }));
  return { countries, start: Math.max(0, countries.findIndex((c) => c.isVisitor)) };
}
