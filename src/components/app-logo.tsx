import { useId } from "react";

/**
 * Logo de Startdeck : une pile de cartes dont la première est une flèche.
 * Même dessin que l'icône de l'application (`src-tauri/icons/app-icon.svg`),
 * recadré sur le carré arrondi.
 */
export function AppLogo({ className }: { className?: string }) {
  // Identifiant unique : deux logos sur la même page ne partagent pas leur dégradé.
  const gradientId = `app-logo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="64 64 896 896" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b6bff" />
          <stop offset="1" stopColor="#1447e6" />
        </linearGradient>
      </defs>
      <rect x="64" y="64" width="896" height="896" rx="200" fill={`url(#${gradientId})`} />
      <g fill="#ffffff" stroke="#ffffff" strokeWidth="44" strokeLinejoin="round">
        <path d="M249.0 256.9 L425.0 239.3 L425.0 255.1 L269.0 270.7 L269.0 610.7 L249.0 612.7 Z" />
        <path d="M349.0 342.9 L525.0 325.3 L525.0 341.1 L369.0 356.7 L369.0 696.7 L349.0 698.7 Z" />
        <path d="M449.0 428.9 L637.4 410.1 L769.5 573.0 L634.7 766.1 L449.0 784.7 Z" />
      </g>
    </svg>
  );
}
