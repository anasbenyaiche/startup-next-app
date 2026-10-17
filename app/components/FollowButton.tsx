"use client";

// Bouton « Suivre » : plein quand l'élément est suivi, contour sinon.
// Sans connexion, il propose de se connecter (puis de revenir sur la même vue).
export default function FollowButton({
  following,
  pending,
  signedIn,
  labels,
  onClick,
}: {
  following: boolean;
  pending: boolean;
  signedIn: boolean;
  labels: { on: string; off: string; signIn: string };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-pressed={signedIn ? following : undefined}
      className={`mt-1.5 shrink-0 whitespace-nowrap rounded-full border-[1.5px] border-encre px-3 py-1 text-sm font-semibold disabled:opacity-60 ${
        following ? "bg-encre text-papier" : "hover:bg-papier-fonce"
      }`}
    >
      {!signedIn ? labels.signIn : following ? labels.on : labels.off}
    </button>
  );
}
