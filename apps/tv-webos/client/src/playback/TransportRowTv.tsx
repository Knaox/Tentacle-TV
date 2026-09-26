import type { FocusEvent } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_ATTRIBUTE } from "../focus/default";
import { osdEntryButton, rememberOsdButton } from "./focusOsd";
import {
  PlayIcon,
  PauseIcon,
  PrevEpIcon,
  NextEpIcon,
  GearIcon,
  EpisodesIcon,
} from "@/components/PlayerIcons";
import { MoveIcon } from "./IconsTv";

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
 * transposé, soit rien.
 *
 * **Le bouton Retour n'est pas ici non plus** — mais il existe désormais, en
 * tête d'habillage, à gauche du titre. C'est la place qu'il occupe sur l'Apple
 * TV comme sur le client web. L'argument qui le retirait (« la télécommande en
 * a un ») valait pour la RANGÉE, qu'il aurait allongée sans rien apprendre ;
 * il ne valait pas pour le lecteur, où quitter l'épisode n'était signalé nulle
 * part. Une touche physique se devine d'autant moins que rien à l'écran ne la
 * nomme.
 *
 * On entre par le bouton lecture/pause : c'est le centre de gravité, avec un
 * saut de part et d'autre à une pression. Poser le focus initial sur le premier
 * bouton à gauche imposerait deux pressions pour l'action la plus fréquente.
 * Seule exception, le dernier bouton de la rangée qu'on a visé
 * (`osdEntryButton`).
 */

interface TransportProps {
  playing: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  hasEpisodes: boolean;
  hasTracks: boolean;
  onToggle: () => void;
  onSkip: (delta: number) => void;
  onMove: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onEpisodes: () => void;
  onTracks: () => void;
}

export function TransportRowTv({
  playing,
  hasPrevious,
  hasNext,
  hasEpisodes,
  hasTracks,
  onToggle,
  onSkip,
  onMove,
  onPrevious,
  onNext,
  onEpisodes,
  onTracks,
}: TransportProps) {
  const { t } = useTranslation("player");

  // Le focus est retenu ici plutôt que par un écouteur global : `onFocus`
  // remonte en React, la rangée voit donc passer chacun de ses boutons, et rien
  // ne subsiste quand elle se démonte.
  const remember = (event: FocusEvent<HTMLDivElement>): void => {
    const target = event.target as HTMLElement;
    rememberOsdButton(target.getAttribute("data-osd-button"));
  };

  // L'entrée est DÉCLARÉE, sur un seul bouton : `DEFAULT_ATTRIBUTE` est ce que
  // le moteur lit quand il repose l'anneau, et `setOsdFocus` vise la même
  // marque. Tant que chacun avait sa réponse, le moteur arrivait le premier
  // avec la sienne — le premier focusable en ordre de lecture, c'est-à-dire le
  // bouton « quitter » : démarrer un épisode posait l'anneau sur la sortie.
  const rendered = ["recul", "lecture", "avance", "deplacement"];
  if (hasPrevious) rendered.push("precedent");
  if (hasNext) rendered.push("suivant");
  if (hasEpisodes) rendered.push("episodes");
  if (hasTracks) rendered.push("pistes");
  const entry = osdEntryButton(rendered);

  /** La clé d'un bouton, et la marque d'entrée s'il est l'entrée. */
  const osdButton = (key: string) =>
    key === entry
      ? { "data-osd-button": key, [DEFAULT_ATTRIBUTE]: "" }
      : { "data-osd-button": key };

  return (
    <div className="osd-tv-transport" onFocus={remember}>
      {hasPrevious && (
        <button
          type="button"
          className="osd-tv-bouton"
          {...osdButton("precedent")}
          onClick={onPrevious}
          aria-label={t("player:previousEpisode")}
        >
          <PrevEpIcon />
        </button>
      )}

      <button
        type="button"
        className="osd-tv-bouton"
        {...osdButton("recul")}
        onClick={() => onSkip(-10)}
        aria-label={t("player:skipBack")}
      >
        <span className="osd-tv-saut">-10</span>
      </button>

      <button
        type="button"
        className="osd-tv-bouton osd-tv-bouton-principal"
        {...osdButton("lecture")}
        onClick={onToggle}
        aria-label={playing ? t("player:pause") : t("player:play")}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <button
        type="button"
        className="osd-tv-bouton"
        {...osdButton("avance")}
        onClick={() => onSkip(30)}
        aria-label={t("player:skipForward")}
      >
        <span className="osd-tv-saut">+30</span>
      </button>

      {/* Entre en déplacement. Cinquième position, celle qu'il occupe sur
          l'Apple TV : après les sauts fixes, avant les changements d'épisode —
          on va du plus fin au plus grossier, de gauche à droite. */}
      <button
        type="button"
        className="osd-tv-bouton"
        {...osdButton("deplacement")}
        onClick={onMove}
        aria-label={t("player:seekMode")}
      >
        <MoveIcon />
      </button>

      {hasNext && (
        <button
          type="button"
          className="osd-tv-bouton"
          {...osdButton("suivant")}
          onClick={onNext}
          aria-label={t("player:nextEpisode")}
        >
          <NextEpIcon />
        </button>
      )}

      {hasEpisodes && (
        <button
          type="button"
          className="osd-tv-bouton"
          {...osdButton("episodes")}
          onClick={onEpisodes}
          aria-label={t("player:episodes")}
        >
          <EpisodesIcon />
        </button>
      )}

      {hasTracks && (
        <button
          type="button"
          className="osd-tv-bouton"
          {...osdButton("pistes")}
          onClick={onTracks}
          aria-label={t("player:tracks")}
        >
          <GearIcon />
        </button>
      )}
    </div>
  );
}
