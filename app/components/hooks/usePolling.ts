"use client";

import { useCallback, useEffect, useRef } from "react";

// Interroge une route JSON à intervalle régulier et renvoie une fonction pour
// relancer la lecture tout de suite (après une publication, par exemple).
// Onglet caché : pas de requête ; on relit dès que l'onglet redevient visible.
// Une erreur réseau est ignorée : la lecture suivante réessaiera.
export function usePolling<T>(url: string | null, intervalMs: number, onData: (json: T) => void): () => void {
  const handler = useRef(onData);
  handler.current = onData;

  const load = useCallback(() => {
    if (!url) return;
    fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .then((json) => json && handler.current(json))
      .catch(() => undefined);
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const tick = () => !document.hidden && load();
    load();
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [url, intervalMs, load]);

  return load;
}
