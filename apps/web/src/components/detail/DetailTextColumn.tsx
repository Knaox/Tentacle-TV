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
 * L'assise suit donc le TEXTE, quelle que soit la fenêtre : un rectangle
 * sombre aux bords fondus (`.detail-text-scrim`, theme/scrims.css), juste ce
 * qu'il faut pour que le texte de la colonne tienne 4,5:1 même sur un blanc
 * pur, de 1024 × 640 à 2560 × 1440 — sur une image sombre, il ne se voit
 * presque pas. Il paraît avec le texte
 * (fondu d'opacité, premier temps de la cascade) : le calque d'ouverture,
 * qui rejoue les voiles de la scène, s'efface sans qu'une zone ne s'assombrisse
 * d'un coup. Peint une fois, jamais animé autrement que par son opacité.
 */
export function DetailTextColumn({ children }: { children: ReactNode }) {
  return (
    <div className="detail-text-column relative min-w-0 max-w-4xl flex-1">
      {/* Les rampes de l'assise tombent HORS du texte : 96 px au-dessus et
          au-dessous, 120 px de chaque côté. Pas plus large que le texte le plus
          large (le titre, 48 rem) : sur une fenêtre large, la colonne s'étire,
          l'assise non. */}
      <motion.div
        aria-hidden
        variants={fadeIn}
        className="detail-text-scrim pointer-events-none absolute -inset-y-24 -left-[7.5rem] -z-10 w-[calc(100%+15rem)] max-w-[63rem]"
      />
      {children}
    </div>
  );
}
