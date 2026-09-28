interface CardEpisodeCaptionProps {
  /** « S04E17 » — absent pour un film. */
  code: string | null;
  /** Le titre de l'épisode (ou du film). */
  title: string | null;
  /**
   * La marge droite, au repos puis au survol : le coin bas-droit appartient
   * au groupe du survol (étoiles et plateau), le texte se resserre à sa
   * gauche au lieu de passer dessous. Elle dépend de la taille du plateau.
   */
  inset: string;
}

/**
 * Le code et le titre d'un épisode, posés en bas à gauche d'une vignette
 * 16:9 — la même légende pour la carte en ligne (`EpisodeCard`) et celle d'un
 * épisode gardé (`OfflineEpisodeCard`).
 *
 * AU-DESSUS du voile du survol (`z-30`, le survol est en `z-20`) : sans cela,
 * le noir à 90 % du bas de la coque la recouvre et le titre devient
 * illisible — c'est ce qui était arrivé à la carte hors ligne, qui avait sa
 * propre copie de cette légende. Transparente au pointeur pour ne rien voler
 * au plateau. Blanc constant dans les deux thèmes : elle est posée sur média.
 */
export function CardEpisodeCaption({ code, title, inset }: CardEpisodeCaptionProps) {
  if (!code && !title) return null;
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-1.5 z-30 pl-3 text-on-media-primary ${inset}`}>
      {code && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-media-secondary">{code}</p>}
      {title && <p className="line-clamp-1 text-xs font-semibold">{title}</p>}
    </div>
  );
}
