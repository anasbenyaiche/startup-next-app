// Bloc de remplacement pendant un chargement. Il reprend la forme du contenu
// attendu pour que rien ne saute à l'arrivée des données ; la pulsation est
// coupée si le système demande moins d'animations.
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span aria-hidden="true" style={style} className={`block rounded-[3px] bg-encre/10 motion-safe:animate-pulse ${className}`} />
  );
}

// Annonce le chargement aux lecteurs d'écran, une seule fois, sans le répéter
// pour chaque bloc décoratif.
export function LoadingRegion({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

// Largeurs variées mais stables d'un rendu à l'autre (pas de Math.random,
// qui différerait entre serveur et navigateur).
export const SKELETON_WIDTHS = ["72%", "58%", "84%", "46%", "66%", "52%", "78%", "40%", "61%", "70%"];
