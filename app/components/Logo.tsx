// Le symbole : un cortège vu du ciel, une file de manifestants menée par
// un point rose (la tête du cortège, et le signal « en direct »).
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="6" cy="31" r="3.2" fill="var(--encre)" />
      <circle cx="13" cy="25.5" r="3.2" fill="var(--encre)" />
      <circle cx="20.5" cy="22.5" r="3.2" fill="var(--encre)" />
      <circle cx="27.5" cy="17" r="3.2" fill="var(--encre)" />
      <circle cx="33.5" cy="9" r="4.6" fill="var(--rose)" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="flex items-center gap-1.5">
      <LogoMark className="h-8 w-8" />
      <span className="display text-[1.7rem] leading-none pb-0.5">cortège</span>
    </span>
  );
}
