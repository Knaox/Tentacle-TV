/**
 * Le glyphe des boutons de téléchargement — fiche, ligne d'épisode, carte.
 *
 * ⚠️ « Terminé » ne se dessine PAS par une coche dans un cercle : c'est déjà, au
 * caractère près, le tracé de `CheckCircleIcon`, le marqueur « vu ». Les deux
 * voisinent dans la rangée d'actions d'une fiche ET dans une ligne d'épisode —
 * un titre téléchargé y paraissait donc marqué comme vu.
 *
 * On garde la métaphore du téléchargement — le plateau du glyphe « à
 * télécharger », inchangé — et l'on remplace la seule flèche par une coche.
 * L'état se lit sans ambiguïté, et les deux glyphes restent de la même famille.
 */

interface DownloadGlyphProps {
  done: boolean;
  className?: string;
  strokeWidth?: number;
}

export function DownloadGlyph({ done, className = "h-5 w-5", strokeWidth = 2 }: DownloadGlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5"
      />
      {done ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 8.75L11 11.75 16.5 5.5" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      )}
    </svg>
  );
}
