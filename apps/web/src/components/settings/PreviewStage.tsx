/**
 * LE cadre d'aperçu : une image de film, et ce qu'on y pose.
 *
 * Partagé par tous les aperçus des réglages de lecture — la pilule de saut, la
 * fiche « à suivre » — pour qu'ils soient le même objet à l'œil.
 *
 * # `inert`, et pas `aria-hidden`
 *
 * ⚠️ Le cadre porte de VRAIS boutons du lecteur, donc focalisables. Un
 * `aria-hidden` posé par-dessus est refusé par le navigateur dès que le focus y
 * entre (« Blocked aria-hidden on an element because its descendant retained
 * focus ») : on cacherait à un lecteur d'écran un élément qu'un clavier peut
 * atteindre. `inert` fait les deux à la fois — hors de l'arbre d'accessibilité
 * ET hors du parcours de tabulation. C'est ce que la spécification recommande,
 * et React 19 le passe tel quel.
 *
 * L'information ne se perd pas pour autant : la phrase sous le cadre dit ce que
 * le réglage fait, et elle, elle est lue.
 *
 * # Le fond est sombre dans les DEUX thèmes
 *
 * Il ne représente pas une surface de l'application mais une IMAGE DE FILM.
 * Mesuré en thème clair : un cadre en `tentacle-surface` y devient presque
 * blanc, et la pilule — blanche des deux côtés — s'y efface.
 */

import type { ReactNode } from "react";

interface PreviewStageProps {
  /** Ce qu'on pose sur l'image : un vrai composant du lecteur. */
  children?: ReactNode;
  /** La phrase qui dit ce qui va se passer. Seule si le cadre est vide. */
  caption: string;
  /** Largeur du cadre. La fiche « à suivre » en demande plus que la pilule. */
  width?: "pill" | "card";
  /** Posé par l'appelant qui veut suspendre son minuteur hors écran. */
  stageRef?: React.RefObject<HTMLDivElement | null>;
}

const WIDTH = {
  // 360 px : la pilule la plus longue du lecteur (« Aller à la scène
  // post-générique ») y tient à sa TAILLE RÉELLE, sans transformée d'échelle.
  pill: "w-[360px] max-w-full",
  card: "w-[460px] max-w-full",
} as const;

export function PreviewStage({ children, caption, width = "pill", stageRef }: PreviewStageProps) {
  return (
    <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-2">
      <div
        ref={stageRef}
        inert
        className={`relative aspect-video ${WIDTH[width]} shrink-0 overflow-hidden rounded-xl border border-line-subtle`}
        style={{ background: "linear-gradient(135deg, #2b2436 0%, #16131c 55%, #0a0a0d 100%)" }}
      >
        {/* Le décor : deux traits qui suggèrent une barre de lecture. Ni image
            ni vidéo — l'aperçu ne doit rien télécharger. */}
        <div className="absolute inset-x-6 bottom-4 h-[3px] rounded-full bg-white/15">
          <div className="h-full w-2/3 rounded-full bg-white/50" />
        </div>
        {children}
      </div>
      <p className="min-w-[11rem] flex-1 text-xs leading-relaxed text-content-tertiary">{caption}</p>
    </div>
  );
}
