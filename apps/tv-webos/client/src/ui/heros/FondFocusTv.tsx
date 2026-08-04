import { useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { useItemFocalise } from "../cartes/itemFocalise";
import { useCalquesFond } from "./calquesFond";

/**
 * Le fond d'écran de la carte focalisée.
 *
 * **Aucun flou.** C'est le modèle d'Android TV et d'Apple TV, dont
 * `TVAmbientBackdrop` est la référence : le Backdrop de l'item, en pleine
 * résolution, cadré en `cover` sur tout l'écran, ramené à un tiers d'opacité et
 * atténué par un dégradé vertical. On reconnaît le film, et le contenu posé
 * dessus reste lisible.
 *
 * Pour un épisode, on demande le Backdrop de la SÉRIE — mêmes raisons que sur
 * `apps/tv` : la vignette d'un épisode est un plan quelconque, celle de la
 * série est une affiche composée.
 *
 * **Deux calques, et c'est ce qui change tout.** La version précédente n'en
 * tenait qu'un, keyé sur l'URL : changer de cible le démontait pour en monter
 * un autre, et l'écran restait noir le temps de télécharger l'image suivante.
 * Ici l'ancien tient l'écran jusqu'à ce que le nouveau soit chargé, puis le
 * nouveau monte en opacité par-dessus lui. `calquesFond.ts` porte cette
 * mécanique, qui n'a rien de spécifique à ce composant.
 *
 * L'opacité d'ensemble est posée sur la COUCHE, pas sur chaque image : deux
 * images à 0,55 superposées composent à 0,80, et le fondu croisé se verrait
 * comme un éclat au milieu du passage. La couche compose ses images entre
 * elles, puis s'atténue d'un bloc. Le voile, lui, reste dehors — c'est lui qui
 * rend le texte lisible, et il n'a pas à s'atténuer avec l'image.
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

  const visible = item !== null && surUnEcranDeParcours(pathname);
  const idImage = item && item.Type === "Episode" && item.SeriesId ? item.SeriesId : item?.Id;
  const url =
    visible && idImage ? client.getImageUrl(idImage, "Backdrop", { width: 1280, quality: 70 }) : null;

  const { calques, signalerEntre, signalerSorti } = useCalquesFond(url);

  if (calques.length === 0) return null;

  return (
    <div className="fond-focus" aria-hidden>
      <span className="fond-focus-couche">
        {calques.map((calque) => (
          <ImageDeFond
            key={calque.url}
            url={calque.url}
            sortant={calque.sortant}
            onEntre={signalerEntre}
            onSorti={signalerSorti}
          />
        ))}
      </span>
      <span className="fond-focus-voile" />
    </div>
  );
}

/**
 * L'image n'apparaît qu'une fois CHARGÉE — et son entrée est une ANIMATION.
 *
 * Deux défauts distincts sont refermés ici, et ils tenaient au même choix.
 *
 * Le fondu posé sur le conteneur courait pendant que l'image était encore en
 * vol : quand elle arrivait, l'animation était finie et elle surgissait d'un
 * coup. `apps/tv` traite ce point en ne déclenchant le fondu croisé que sur
 * `onLoad` — on fait pareil, d'où `data-charge`.
 *
 * Mais avec une TRANSITION, le cas de l'image déjà en cache retombait dans le
 * même défaut par l'autre bout : `complete` étant vrai dès la première ref,
 * `data-charge` passait à vrai au premier rendu, l'état initial et l'état final
 * se confondaient, et la transition n'avait rien à interpoler. Revenir sur une
 * carte déjà visitée faisait donc apparaître son décor d'un bloc.
 *
 * Une ANIMATION n'a pas ce problème : elle joue au montage de l'élément qui la
 * porte, que l'attribut soit posé tout de suite ou une demi-seconde plus tard.
 * C'est le même raisonnement que le fondu de bannière (`banniere-tv.css`).
 *
 * La référence de rappel plutôt qu'un `useEffect`, toujours pour le cas du
 * cache : l'image est `complete` avant que React n'ait posé son gestionnaire,
 * `onLoad` ne part jamais, et le fond resterait invisible. C'est le mode de
 * panne classique de ce motif.
 */
function ImageDeFond({
  url,
  sortant,
  onEntre,
  onSorti,
}: {
  url: string;
  sortant: boolean;
  onEntre: (url: string) => void;
  onSorti: (url: string) => void;
}) {
  const [charge, setCharge] = useState(false);

  const rattacher = useCallback((element: HTMLImageElement | null) => {
    if (element?.complete && element.naturalWidth > 0) setCharge(true);
  }, []);

  // Une seule fin d'animation à traiter par calque : celle de son entrée le
  // rend seul à l'écran, celle de sa sortie le démonte.
  const surFinAnimation = useCallback(() => {
    if (sortant) onSorti(url);
    else onEntre(url);
  }, [sortant, url, onEntre, onSorti]);

  return (
    <img
      ref={rattacher}
      className="fond-focus-image"
      data-charge={charge}
      data-sortant={sortant}
      src={url}
      alt=""
      onLoad={() => setCharge(true)}
      onAnimationEnd={surFinAnimation}
    />
  );
}
