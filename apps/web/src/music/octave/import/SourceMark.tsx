/**
 * Octave — la marque d'une source d'import, dessinée simple (pas le logo
 * officiel) : une pastille à la couleur du service et un pictogramme qui le
 * rappelle. Toujours accompagnée de son nom en texte (jamais la couleur seule).
 */

import { FileText } from "lucide-react";
import type { MusicImportSource } from "@tentacle-tv/shared/music";

const TINT: Record<MusicImportSource, string> = {
  spotify: "#1ED760",
  apple: "#FA2D48",
  deezer: "#A238FF",
  youtube: "#FF0033",
  text: "currentColor",
};

function Glyph({ source }: { source: MusicImportSource }) {
  switch (source) {
    case "spotify":
      return (
        <g fill="none" stroke="#0b0a10" strokeWidth="1.6" strokeLinecap="round">
          <path d="M6.5 9.6c3.6-1.1 7.6-.8 11 1" />
          <path d="M7.2 12.6c3-.8 6.1-.5 8.8.9" />
          <path d="M7.8 15.4c2.3-.6 4.6-.4 6.6.7" />
        </g>
      );
    case "apple":
      return <path d="M14.5 6.5v8.2a2.3 2.3 0 1 1-1.4-2.1V8.7l-4 .9v6.3a2.3 2.3 0 1 1-1.4-2.1V8.4z" fill="#fff" />;
    case "deezer":
      return (
        <g fill="#fff">
          <rect x="6" y="14" width="2.6" height="3" rx=".5" />
          <rect x="10.7" y="11" width="2.6" height="6" rx=".5" />
          <rect x="15.4" y="7.5" width="2.6" height="9.5" rx=".5" />
        </g>
      );
    case "youtube":
      return <path d="M10 8.6v6.8l5.6-3.4z" fill="#fff" />;
    default:
      return null;
  }
}

export function SourceMark({ source, className = "h-6 w-6" }: { source: MusicImportSource; className?: string }) {
  if (source === "text") return <FileText className={`${className} text-content-tertiary`} aria-hidden />;
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} aria-hidden>
      <circle cx="12" cy="12" r="11" fill={TINT[source]} />
      <Glyph source={source} />
    </svg>
  );
}

/** La rangée des sources reconnues, pour dire d'un coup d'œil ce qu'on peut coller. */
export function SourceRow({ sources }: { sources: readonly MusicImportSource[] }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {sources.map((s) => (
        <SourceMark key={s} source={s} className="h-5 w-5" />
      ))}
    </div>
  );
}
