import type { FlashKind, PlaybackFlash } from "../hooks/usePlaybackFlash";

/**
 * L'icône qui s'affiche au centre à chaque bascule du lecteur — lecture/pause
 * et son coupé/rétabli.
 *
 * # Les tracés viennent de `PlayerIcons`
 *
 * ⚠️ Et pas d'ailleurs. Le premier jet mélangeait des tracés pleins improvisés
 * pour la pause avec le haut-parleur au trait des contrôles : deux styles dans
 * le même cercle, et le résultat jurait. Tout est donc au TRAIT, comme la barre
 * de contrôles (`PlayerIcons.tsx`) — même géométrie, mêmes extrémités
 * arrondies, seule l'épaisseur est réduite pour tenir à cette taille.
 *
 * # Ce que ce badge ne fait pas
 *
 * Même famille que `SkipBadge`, et les mêmes contraintes :
 *
 *  - couleurs EN DUR (`bg-black`, `text-white`) : posé sur la vidéo, pas sur une
 *    surface du thème, il doit rester lisible en clair comme en sombre ;
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
      <div className="flex h-[92px] w-[92px] animate-[playbackFlash_0.7s_ease-out_forwards] items-center justify-center rounded-full border border-white/15 bg-black/65">
        <Trace kind={flash.kind} />
      </div>
    </div>
  );
}

/** Les quatre tracés, au trait, dans le `viewBox` 24x24 de `PlayerIcons`. */
function Trace({ kind }: { kind: FlashKind }) {
  const commun = {
    className: "h-11 w-11 text-white",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (kind === "pause") {
    return (
      <svg {...commun}>
        <path d="M9 5v14M15 5v14" strokeWidth={2.4} />
      </svg>
    );
  }
  if (kind === "play") {
    // Décalé d'un point : un triangle centré géométriquement paraît trop à gauche.
    return (
      <svg {...commun} className="ml-1 h-11 w-11 text-white">
        <path d="M8 5.5l11 6.5-11 6.5z" strokeWidth={2} />
      </svg>
    );
  }
  // Haut-parleur des contrôles, aux ondes près : trois arcs quand le son est là,
  // la croix à leur place quand il est coupé.
  return (
    <svg {...commun}>
      <path d="M12 6l-4 4H4v4h4l4 4V6z" strokeWidth={2} />
      {kind === "mute" ? (
        <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" strokeWidth={2} />
      ) : (
        <>
          <path d="M15.4 9.4a3.6 3.6 0 010 5.2" />
          <path d="M18 7a7 7 0 010 10" />
          <path d="M20.6 4.6a10.5 10.5 0 010 14.8" />
        </>
      )}
    </svg>
  );
}
