// Activité médiatique agrégée, sans stockage des préférences côté navigateur.
import type { ManifestationsResult, ManifestationPlace } from "@/lib/news/manifestations";

export type WatchTarget = { id: string; label: string; country: string; placeKey?: string };
export type WatchActivity = WatchTarget & { sixHours: number; twentyFourHours: number };

export function countReports(place: ManifestationPlace): number {
  return Object.values(place.byType).reduce((sum, stat) => sum + stat.incidents, 0);
}

export function activityForTargets(
  targets: WatchTarget[],
  sixHours: Pick<ManifestationsResult, "places">,
  twentyFourHours: Pick<ManifestationsResult, "places">,
): WatchActivity[] {
  const countFor = (places: ManifestationPlace[], target: WatchTarget) =>
    places.reduce((sum, place) => {
      if (target.placeKey ? place.key !== target.placeKey : place.country !== target.country) return sum;
      return sum + countReports(place);
    }, 0);

  return targets.map((target) => ({
    ...target,
    sixHours: countFor(sixHours.places, target),
    twentyFourHours: countFor(twentyFourHours.places, target),
  })).sort((a, b) => b.sixHours - a.sixHours || b.twentyFourHours - a.twentyFourHours);
}
