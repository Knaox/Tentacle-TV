/**
 * Les pictos du PiP — même trait que ceux du lecteur (`PlayerIcons.tsx`) :
 * contour de 2, `currentColor`, blancs sur la vidéo dans les deux thèmes.
 */

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** Réduire la lecture : un écran, et la petite fenêtre dans son coin. */
export function ReduceIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="15" rx="2" />
      <rect x="11.5" y="11" width="7.5" height="5.5" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Revenir au lecteur : la flèche qui sort du PiP vers le grand écran. */
export function ExpandIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M20 4l-7.5 7.5" />
      <path d="M19 14v4.5A1.5 1.5 0 0 1 17.5 20h-12A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5H10" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Ranger dans l'application : le PiP rejoint le coin de la fenêtre. */
export function DockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 9l5 5M13 9.5V14H8.5" />
    </svg>
  );
}

/** Détacher sur le bureau : le PiP quitte la fenêtre. */
export function UndockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M13 14L8 9M8 13.5V9h4.5" />
    </svg>
  );
}
