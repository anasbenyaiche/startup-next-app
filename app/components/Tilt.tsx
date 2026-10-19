"use client";

import { useRef } from "react";

// Relief au survol : la carte s'incline vers le pointeur, comme une pancarte qu'on tourne.
// Rien sur écran tactile ni quand les animations sont réduites.
export default function Tilt({
  children,
  className = "",
  max = 7,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const el = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const node = el.current;
    if (!node || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = node.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    node.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateZ(0)`;
  };
  const leave = () => {
    if (el.current) el.current.style.transform = "";
  };

  return (
    <div
      ref={el}
      onPointerMove={move}
      onPointerLeave={leave}
      className={`transition-transform duration-200 ease-out will-change-transform [transform-style:preserve-3d] ${className}`}
    >
      {children}
    </div>
  );
}
