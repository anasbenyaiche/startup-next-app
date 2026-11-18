// Activité médiatique agrégée, sans stockage des préférences côté navigateur.
import type { ManifestationsResult, ManifestationPlace } from "@/lib/news/manifestations";

export type WatchTarget = { id: string; label: string; country: string; placeKey?: string };
export type WatchTrend = "rising" | "falling" | "stable" | "insufficient";
export type WatchActivity = WatchTarget & { sixHours: number; twentyFourHours: number; trend: WatchTrend };

// Compare le rythme horaire récent au rythme des 18 heures précédentes.
// Les fenêtres 6 h et 24 h se chevauchent : il ne faut pas comparer leurs
// nombres bruts. Les faibles volumes restent indéterminés.
export function activityTrend(recentSix: number, lastTwentyFour: number): WatchTrend {
  if (!Number.isFinite(recentSix) || !Number.isFinite(lastTwentyFour)) return "insufficient";
  if (recentSix < 0 || lastTwentyFour < recentSix || lastTwentyFour < 0) return "insufficient";
  if (lastTwentyFour < 5) return "insufficient";
  const previousEighteen = lastTwentyFour - recentSix;
  const recentRate = recentSix / 6;
  const previousRate = previousEighteen / 18;
  if (previousEighteen === 0) return recentSix > 0 ? "rising" : "insufficient";
  if (recentRate > previousRate * 1.5) return "rising";
  if (recentRate < previousRate * 0.67) return "falling";
  return "stable";
}

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

  return targets.map((target) => {
    const sixHoursCount = countFor(sixHours.places, target);
    const twentyFourHoursCount = countFor(twentyFourHours.places, target);
    return {
      ...target,
      sixHours: sixHoursCount,
      twentyFourHours: twentyFourHoursCount,
      trend: activityTrend(sixHoursCount, twentyFourHoursCount),
    };
  }).sort((a, b) => b.sixHours - a.sixHours || b.twentyFourHours - a.twentyFourHours);
}
