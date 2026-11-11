import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { fadeIn } from "../../theme/motion";

/**
 * La colonne de texte de la scène d'une fiche — titre, notes, méta, synopsis,
 * actions —, posée sur SON assise sombre.
 *
 * Les voiles de la scène (`DETAIL_STAGE_LAYERS`) sont dimensionnés sur la
 * fenêtre ; la colonne, elle, a sa hauteur en pixels, ancrée en bas, et
 * commence après l'affiche : le surtitre, le titre original et le lien vers la
 * série tombaient à mi-hauteur de l'image, là où les voiles ne valent plus
 * que 0,3 — et la fin des lignes du synopsis au-delà du voile diagonal. Sur un
 * décor clair, le texte blanc y descendait à 1,5:1 (mesuré au banc).
 *
 * L'assise couvre donc le TEXTE, quelle que soit la fenêtre : un dégradé sombre qui court sur toute la
 * largeur de la scène, du bas jusqu'au-dessus du surtitre (`.detail-text-scrim`, theme/scrims.css) — juste ce
 * qu'il faut pour que le texte de la colonne tienne 4,5:1 même sur un blanc pur. Ce fut un rectangle aux bords
 * fondus, calé sur la colonne : sur un décor clair, il se lisait comme une plaque posée sur l'image.
 * La colonne n'est PAS positionnée : l'assise se mesure sur le bloc de la scène. Elle paraît avec le texte
 * (fondu d'opacité, premier temps de la cascade) : le calque d'ouverture, qui rejoue les voiles de la scène,
 * s'efface sans qu'une zone ne s'assombrisse d'un coup. Peinte une fois, jamais animée autrement que par son
 * opacité.
 */
export function DetailTextColumn({ children }: { children: ReactNode }) {
  return (
    <div className="detail-text-column min-w-0 max-w-4xl flex-1">
      <motion.div aria-hidden variants={fadeIn} className="detail-text-scrim pointer-events-none absolute -z-10" />
      {children}
    </div>
  );
}
