// « il y a 5 minutes », « dans 2 heures »… dans la langue de la page.
// À n'utiliser que pour des données chargées dans le navigateur (l'heure du
// serveur et celle du navigateur diffèrent pendant l'hydratation).
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

export function relativeTime(locale: string, iso: string, now = Date.now()): string {
  const diff = Date.parse(iso) - now;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return format.format(Math.round(diff / ms), unit);
  }
  return format.format(0, "minute");
}
