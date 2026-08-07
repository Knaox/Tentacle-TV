import type { FocusEvent } from "react";
import { useTranslation } from "react-i18next";
import { retenirBoutonOsd } from "./focusOsd";
import {
  PlayIcon,
  PauseIcon,
  PrevEpIcon,
  NextEpIcon,
  GearIcon,
  EpisodesIcon,
} from "@/components/PlayerIcons";

/**
 * La rangée de transport — la seule zone focusable du lecteur.
 *
 * Ce qui n'y est pas, et pourquoi. **Le plein écran** : une application webOS
 * occupe déjà la dalle entière, il n'existe pas d'état fenêtré dont on sortirait,
 * et un bouton qui ne fait rien est pire qu'un bouton absent — on le vise, on
 * appuie, et on conclut que la télécommande ne répond pas. **L'incrustation
 * d'image** : `document.pictureInPictureEnabled` n'existe pas sur le socle, et
 * l'idée même n'a pas de sens sur un appareil dont l'écran est le seul plan de
 * travail. **Le volume** : il appartient à la télécommande, et une seconde
 * atténuation dans l'application rend inexplicable le « je suis à vingt sur la
 * télé et c'est encore trop bas » ; le curseur du web n'était de toute façon
 * révélé qu'au survol. **La vitesse de lecture** : personne ne regarde un film
 * en 1,25× dans un salon, et le décodeur d'une dalle rend soit un son
 * transposé, soit rien. **Le bouton Retour** : la télécommande en a un, et
 * doubler une touche physique dédiée n'allonge que la rangée à traverser.
 *
 * Le bouton lecture/pause porte `data-osd-defaut` : c'est le centre de gravité,
 * avec un saut de part et d'autre à une pression. Poser le focus initial sur le
 * premier bouton à gauche imposerait deux pressions pour l'action la plus
 * fréquente.
 */

interface ProprietesTransport {
  playing: boolean;
  aPrecedent: boolean;
  aSuivant: boolean;
  aEpisodes: boolean;
  aPistes: boolean;
  onBasculer: () => void;
  onSauter: (delta: number) => void;
  onPrecedent: () => void;
  onSuivant: () => void;
  onEpisodes: () => void;
  onPistes: () => void;
}

export function RangeeTransportTv({
  playing,
  aPrecedent,
  aSuivant,
  aEpisodes,
  aPistes,
  onBasculer,
  onSauter,
  onPrecedent,
  onSuivant,
  onEpisodes,
  onPistes,
}: ProprietesTransport) {
  const { t } = useTranslation("player");

  // Le focus est retenu ici plutôt que par un écouteur global : `onFocus`
  // remonte en React, la rangée voit donc passer chacun de ses boutons, et rien
  // ne subsiste quand elle se démonte.
  const retenir = (evenement: FocusEvent<HTMLDivElement>): void => {
    const cible = evenement.target as HTMLElement;
    retenirBoutonOsd(cible.getAttribute("data-osd-bouton"));
  };

  return (
    <div className="osd-tv-transport" onFocus={retenir}>
      {aPrecedent && (
        <button
          type="button"
          className="osd-tv-bouton"
          data-osd-bouton="precedent"
          onClick={onPrecedent}
          aria-label={t("player:previousEpisode")}
        >
          <PrevEpIcon />
        </button>
      )}

      <button
        type="button"
        className="osd-tv-bouton"
        data-osd-bouton="recul"
        onClick={() => onSauter(-10)}
        aria-label={t("player:skipBack")}
      >
        <span className="osd-tv-saut">-10</span>
      </button>

      <button
        type="button"
        className="osd-tv-bouton osd-tv-bouton-principal"
        data-osd-bouton="lecture"
        data-osd-defaut
        onClick={onBasculer}
        aria-label={playing ? t("player:pause") : t("player:play")}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <button
        type="button"
        className="osd-tv-bouton"
        data-osd-bouton="avance"
        onClick={() => onSauter(30)}
        aria-label={t("player:skipForward")}
      >
        <span className="osd-tv-saut">+30</span>
      </button>

      {aSuivant && (
        <button
          type="button"
          className="osd-tv-bouton"
          data-osd-bouton="suivant"
          onClick={onSuivant}
          aria-label={t("player:nextEpisode")}
        >
          <NextEpIcon />
        </button>
      )}

      {aEpisodes && (
        <button
          type="button"
          className="osd-tv-bouton"
          data-osd-bouton="episodes"
          onClick={onEpisodes}
          aria-label={t("player:episodes")}
        >
          <EpisodesIcon />
        </button>
      )}

      {aPistes && (
        <button
          type="button"
          className="osd-tv-bouton"
          data-osd-bouton="pistes"
          onClick={onPistes}
          aria-label={t("player:tracks")}
        >
          <GearIcon />
        </button>
      )}
    </div>
  );
}
