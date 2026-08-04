import { useCallback, useState } from "react";
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

  /**
   * La clé est l'IMAGE, pas l'item.
   *
   * Elle valait `item.Id`, donc passer d'un épisode au suivant remontait le
   * calque et rejouait le fondu — alors que les deux empruntent le Backdrop de
   * la MÊME série et affichent donc exactement la même image. On voyait le fond
   * disparaître puis revenir identique à lui-même, à chaque déplacement dans
   * une rangée d'épisodes.
   *
   * Sur l'URL, React reconnaît le même élément et ne le remonte pas : l'image
   * reste à l'écran, sans clignotement ni animation inutile. Deux titres
   * différents ont des URL différentes et retrouvent, eux, le fondu normal.
   */
  return (
    <div className="fond-focus" key={url} aria-hidden>
      <ImageDeFond url={url} />
      <span className="fond-focus-voile" />
    </div>
  );
}

/**
 * L'image n'apparaît qu'une fois CHARGÉE.
 *
 * Poser le fondu sur le conteneur le faisait courir pendant que l'image était
 * encore en vol : quand elle arrivait, l'animation était finie et elle
 * surgissait d'un coup. `apps/tv` traite exactement ce point — son commentaire
 * dit que sans cela « le fond paraît en retard sur la sélection » — en ne
 * déclenchant le fondu croisé que sur `onLoad`. On fait pareil.
 *
 * La référence de rappel, plutôt qu'un `useEffect`, pour le cas de l'image
 * DÉJÀ en cache : elle est alors `complete` avant que React n'ait posé son
 * gestionnaire, `onLoad` ne part jamais, et le fond resterait invisible. C'est
 * le mode de panne classique de ce motif.
 */
function ImageDeFond({ url }: { url: string }) {
  const [charge, setCharge] = useState(false);

  const rattacher = useCallback((element: HTMLImageElement | null) => {
    if (element?.complete && element.naturalWidth > 0) setCharge(true);
  }, []);

  return (
    <img
      ref={rattacher}
      className="fond-focus-image"
      data-charge={charge}
      src={url}
      alt=""
      onLoad={() => setCharge(true)}
    />
  );
}
