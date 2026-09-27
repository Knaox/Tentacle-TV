/**
 * Les glyphes des cartes — marqueurs d'état au repos, bascules au survol.
 *
 * UNE famille (trait 1,8, coins arrondis, grille 24) pour les deux usages : la
 * pastille d'états et le plateau d'actions montrent les mêmes formes, pleines
 * quand l'état est vrai, au trait sinon. Un signet reconnu au repos se retrouve
 * donc tel quel sous le curseur — c'est ce qui dit « c'est ici qu'on l'enlève ».
 */

interface GlyphProps {
  className?: string;
  filled?: boolean;
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function BookmarkGlyph({ className = "h-3.5 w-3.5", filled = false }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden {...STROKE} fill={filled ? "currentColor" : "none"}>
      <path d="M6.5 3.75h11a.75.75 0 0 1 .75.75v15.44a.5.5 0 0 1-.79.41L12 16.5l-5.46 3.85a.5.5 0 0 1-.79-.41V4.5a.75.75 0 0 1 .75-.75z" />
    </svg>
  );
}

export function HeartGlyph({ className = "h-3.5 w-3.5", filled = false }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden {...STROKE} fill={filled ? "currentColor" : "none"}>
      <path d="M21 8.25c0-2.49-2.1-4.5-4.69-4.5-1.93 0-3.6 1.13-4.31 2.73-.72-1.6-2.38-2.73-4.31-2.73C5.1 3.75 3 5.76 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
}

/** Coche « vu ». Pleine : disque plein, coche évidée — lisible à 12 px. */
export function WatchedGlyph({ className = "h-3.5 w-3.5", filled = false }: GlyphProps) {
  if (filled) {
    return (
      <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
        <path
          fillRule="evenodd"
          d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5zm4.28 7.53a.75.75 0 0 0-1.06-1.06l-4.47 4.47-1.97-1.97a.75.75 0 1 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l5-5z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.25 12.25l2.5 2.5 5-5" />
    </svg>
  );
}

export function StarGlyph({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden fill="currentColor">
      <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 0 0 .95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 0 0-.36 1.12l1.07 3.29c.3.92-.76 1.69-1.54 1.12l-2.8-2.03a1 1 0 0 0-1.18 0l-2.8 2.03c-.78.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 0 0-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 0 0 .95-.69l1.07-3.29z" />
    </svg>
  );
}

export function PlayGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.9-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}
