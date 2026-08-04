import { useLocation } from "react-router-dom";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { useItemFocalise } from "../cartes/itemFocalise";

/**
 * Le fond d'écran de la carte focalisée.
 *
 * **Aucun flou.** C'est le modèle d'Android TV et d'Apple TV, dont
 * `TVAmbientBackdrop` est la référence : le Backdrop de l'item, en pleine
 * résolution, cadré en `cover` sur tout l'écran, ramené à un tiers d'opacité et
 * atténué par un dégradé vertical. On reconnaît le film, et le contenu posé
 * dessus reste lisible.
 *
 * La version précédente reprenait `HeroAmbilight`, qui floute son image à 48 px
 * après l'avoir réduite à 128 px de large. C'est le bon traitement pour une
 * LUEUR autour d'une carte ; c'en est un très mauvais pour un fond qui doit
 * dire ce qu'on est en train de viser. Baisser le rayon ne réglait rien non
 * plus : ça donnait une tache moins floue, pas une image.
 *
 * Pour un épisode, on demande le Backdrop de la SÉRIE — mêmes raisons que sur
 * `apps/tv` : la vignette d'un épisode est un plan quelconque, celle de la
 * série est une affiche composée.
 *
 * Le fondu est une animation CSS et non une transition de composant : le shim
 * de framer-motion ne diffère aucun démontage, `AnimatePresence` y est un
 * fragment. Changer d'item remonte un nouvel élément par sa `key`, et une
 * animation posée sur lui rejoue par construction — sans qu'on ait à tenir deux
 * calques en même temps, ce qu'un processeur de dalle paie cher.
 *
 * Monté sur l'accueil et les bibliothèques seulement. Sur une fiche, la
 * bannière porte déjà son propre halo et les deux se disputeraient l'écran ;
 * pendant la lecture, rien ne doit être composé derrière l'image.
 */

const CHEMINS = ["/", "/library", "/watchlist", "/favorites"];

function surUnEcranDeParcours(chemin: string): boolean {
  if (chemin === "/") return true;
  for (const prefixe of CHEMINS) {
    if (prefixe !== "/" && chemin.startsWith(prefixe)) return true;
  }
  return false;
}

export function FondFocusTv() {
  const { pathname } = useLocation();
  const item = useItemFocalise();
  const client = useJellyfinClient();

  if (!item || !surUnEcranDeParcours(pathname)) return null;

  const idImage = item.Type === "Episode" && item.SeriesId ? item.SeriesId : item.Id;
  const url = client.getImageUrl(idImage, "Backdrop", { width: 1280, quality: 70 });

  return (
    <div className="fond-focus" key={item.Id} aria-hidden>
      <img className="fond-focus-image" src={url} alt="" />
      <span className="fond-focus-voile" />
    </div>
  );
}
