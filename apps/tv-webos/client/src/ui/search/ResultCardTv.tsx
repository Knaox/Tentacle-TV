import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { captureDetailOrigin } from "@/components/detail/detailTransition";

/**
 * Un résultat de recherche, atteignable à la télécommande.
 *
 * C'est un vrai `<button>` et non une carte enveloppée : les cartes des rangées
 * portent un survol, des actions rapides et une transition d'entrée dont rien
 * n'a de sens dans une grille de résultats, et `FocusableCard` existe
 * précisément pour rendre focusable ce qui ne l'est pas — ici il n'y a rien à
 * envelopper, la carte est écrite pour cet écran.
 *
 * `captureDetailOrigin` est en revanche partagé : sans lui la fiche s'ouvre par
 * un saut sec, alors que tous les autres chemins vers une fiche l'animent
 * depuis l'affiche qu'on vient de viser.
 */

interface ProprietesCarteResultat {
  item: MediaItem;
  onOuvrir: (item: MediaItem) => void;
}

export function CarteResultatTv({ item, onOuvrir }: ProprietesCarteResultat) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  const visuel = useRef<HTMLDivElement>(null);

  const estEpisode = item.Type === "Episode";
  const identifiantImage = estEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const urlImage = client.getImageUrl(identifiantImage, "Primary", { height: 360, quality: 85 });

  const ouvrir = useCallback(() => {
    captureDetailOrigin(visuel.current, item.Id, urlImage, 6, true);
    onOuvrir(item);
  }, [item, onOuvrir, urlImage]);

  const type =
    item.Type === "Movie" ? t("common:movie") : item.Type === "Series" ? t("common:series") : item.Type;

  return (
    <li className="recherche-tv-cellule">
      <button type="button" onClick={ouvrir} className="recherche-tv-carte">
        <div ref={visuel} className="recherche-tv-visuel">
          <img
            src={urlImage}
            alt={item.Name}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full object-cover"
            onError={(evenement) => {
              (evenement.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
        <p className="recherche-tv-titre">{item.Name}</p>
        <p className="recherche-tv-type">
          {type}
          {item.ProductionYear ? ` · ${item.ProductionYear}` : ""}
        </p>
      </button>
    </li>
  );
}
