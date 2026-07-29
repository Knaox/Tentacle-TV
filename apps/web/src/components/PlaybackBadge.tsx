import type { PlaybackFlash } from "../hooks/usePlaybackFlash";

/**
 * L'icône de pause (ou de lecture) qui s'affiche au centre à chaque bascule.
 *
 * Même famille que `SkipBadge`, et les mêmes contraintes s'y appliquent :
 *
 *  - couleurs EN DUR (`bg-black`, `text-white`) : le badge est posé sur la
 *    vidéo, pas sur une surface du thème, et doit rester lisible en clair
 *    comme en sombre ;
 *  - **pas de `backdrop-filter`.** Sur les trois bureaux, mpv ne dessine pas
 *    dans le moteur web : celui-ci ne voit jamais l'image du film et ne peut
 *    donc pas l'échantillonner. Un flou posé ici ne flouterait rien et
 *    coûterait quand même une couche composée par image ;
 *  - l'animation ne touche QUE `opacity` et `transform` — tout le reste
 *    déclenche une peinture par image, et sur un élément centré plein écran
 *    c'est le viewport entier qui serait repeint.
 *
 * Le composant n'est monté que le temps du flash (`usePlaybackFlash` le remet à
 * `null`) : rien ne subsiste dans la composition entre deux bascules.
 */
export function PlaybackBadge({ flash }: { flash: PlaybackFlash | null }) {
  if (!flash) return null;

  return (
    <div
      key={flash.id}
      className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="flex h-[88px] w-[88px] animate-[playbackFlash_0.7s_ease-out_forwards] items-center justify-center rounded-full border border-white/15 bg-black/65">
        {flash.paused ? (
          <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
          </svg>
        ) : (
          <svg className="ml-1 h-10 w-10 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </div>
    </div>
  );
}
