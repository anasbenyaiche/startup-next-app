"use client";

import { useEffect, useState } from "react";

// Heure affichée dans le fuseau du visiteur. Le serveur ne le connaît pas : le premier
// rendu, identique côté serveur et navigateur, est en UTC (indiqué), puis le navigateur
// le remplace par l'heure locale. Sans cela, les deux rendus diffèrent et React lève
// une erreur d'hydratation (#418).
export default function LocalTime({
  iso,
  locale,
  options = { hour: "2-digit", minute: "2-digit" },
}: {
  iso: string;
  locale: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const date = new Date(iso);
  const [text, setText] = useState(() => `${date.toLocaleString(locale, { ...options, timeZone: "UTC" })} UTC`);

  useEffect(() => {
    setText(new Date(iso).toLocaleString(locale, options));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options est un objet littéral, recréé à chaque rendu
  }, [iso, locale]);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
