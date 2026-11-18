// Paramètres acceptés par les routes : seules les périodes affichées sont calculées
// (chacune a son cache), et les clés de lieu doivent avoir la forme produite par l'analyse.
export const PERIODS = [6, 24, 72] as const;

export function parseHours(value: string | null): number {
  const n = Number(value);
  return (PERIODS as readonly number[]).includes(n) ? n : 24;
}

const PLACE_KEY = /^(?:[A-Z0-9]{1,4}:[\w-]{1,40}|-?\d{1,3}\.\d{4},-?\d{1,3}\.\d{4})$/;

export function parsePlaceKey(value: string | null): string | null {
  return value && PLACE_KEY.test(value) ? value : null;
}
