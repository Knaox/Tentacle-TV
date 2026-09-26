/**
 * La projection de l'ARBITRE, version téléviseur LG — le pendant du
 * `PlaybackOverlay` web, avec ce qui change à trois mètres : l'ancrage
 * d'overscan (classes `.saut-tv`, `.carte-next-tv`, `.affiche-fin-tv`), la
 * prise de focus, et le refus en SECOND BOUTON plutôt qu'en croix (une cible
 * de trente-deux pixels ne se vise pas à la télécommande). Aucune décision ici
 * non plus : qui s'affiche, quand et avec quel décompte vient de la coquille
 * partagée, comme partout.
 *
 * # Le focus va au bouton UTILE
 *
 * Même règle que sur Android TV et Apple TV : le geste que l'utilisateur
 * aurait à faire. Le passage part tout seul → le focus va au refus ; il faut
 * le demander → au saut. Et il ne se prend plus seulement quand l'habillage
 * est éteint : un bouton paru pendant que les commandes sont à l'écran restait
 * sinon à côté de la télécommande. Ce qui revient PAR l'habillage, lui, a déjà
 * été refusé une fois : il se montre sans rien voler (`dismissible`).
 *
 * L'affiche de fin garde la règle historique : la refuser, c'est en avoir
 * fini — l'épisode est terminé, la masquer laisserait un écran noir sans
 * commande. On quitte donc le lecteur.
 */

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { PlayerOverlay } from "@tentacle-tv/shared";
import { UpNextCard } from "@/components/player/UpNextCard";
import { NextEpisodeFullscreen } from "@/components/player/NextEpisodeFullscreen";
import { giveFocus } from "../focus/active";
import { zoneEntryDestination } from "../focus/zones";
import { readState, useTvPlayerState } from "@tentacle-tv/tv-core";
import { setOsdFocus } from "./focusOsd";
import { exitPlayer } from "./playerExitTv";
import { OVERLAY_ATTRIBUTE } from "./okOverlay";

interface TvProps {
  overlay: PlayerOverlay;
  countdownTotals: { skipMs: number; nextMs: number };
  onSkip: () => void;
  onDismiss: () => void;
  onPlayNow: () => void;
  nextEpisodeTitle?: string;
  nextEpisodeDescription?: string;
  nextEpisodeImageUrl?: string;
  nextSeriesBackdropUrl?: string;
  nextEpisodeThumbUrl?: string;
}

/**
 * L'appel à l'action de l'affiche, et non sa croix de fermeture : la croix est
 * posée en absolu sur la racine, les boutons du panneau sont plus profonds.
 */
function mainAction(root: HTMLElement): HTMLElement | null {
  for (const button of root.querySelectorAll<HTMLElement>("button")) {
    if (button.parentElement !== root) return button;
  }
  return null;
}

/** Prend le focus si personne d'autre ne s'en sert, le rend à l'habillage après. */
function useOverlayFocus(
  ref: { current: HTMLElement | null },
  active: boolean,
  target: (root: HTMLElement) => HTMLElement | null,
  force = false,
) {
  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    if (!force && readState().mode !== "idle") return;
    const element = target(root);
    if (element) giveFocus(element);
    return () => {
      // Le nettoyage passe APRÈS le retrait du nœud : un bouton démonté avec
      // le focus l'a laissé au corps du document. C'est « la surcouche avait
      // le focus » — le rendre à l'habillage tout de suite, au lieu d'attendre
      // le chien de garde du moteur (jusqu'à 500 ms sans anneau).
      const focal = document.activeElement;
      const orphaned = !focal || focal === document.body;
      if (!orphaned && !root.contains(focal)) return;
      if (!orphaned && focal instanceof HTMLElement) focal.blur();
      setOsdFocus(document.querySelector<HTMLElement>(".osd-tv"));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, force]);
}

export function PlaybackOverlayTv({
  overlay, countdownTotals, onSkip, onDismiss, onPlayNow,
  nextEpisodeTitle, nextEpisodeDescription, nextEpisodeImageUrl,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
}: TvProps) {
  const { t } = useTranslation("player");
  const state = useTvPlayerState();
  const skipRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  const isCard = overlay.kind === "nextCard" && !overlay.final;
  const isPoster = overlay.kind === "nextCard" && overlay.final;

  // Rien pendant le déplacement — l'écran du curseur fantôme est un mode, on y
  // cherche une position. L'affiche de fin, elle, a raison même là : il n'y a
  // plus de position à chercher.
  const hidden = state.mode === "scrub" && !isPoster;

  // Le passage part-il tout seul ? Alors le geste utile est de l'en empêcher,
  // et le focus va au refus. Sinon il va au saut. La question ne se pose pas à
  // l'affichage des secondes : un saut automatique dont le décompte est masqué
  // reste un saut automatique (`auto`, tranché par l'arbitre).
  const autoSkip = overlay.kind === "skip" && overlay.auto;
  // Ce qui n'a PAS été refusé s'impose, habillage allumé ou non : la prise de
  // focus attendait l'habillage éteint, si bien qu'un bouton paru pendant que
  // les commandes étaient à l'écran restait à côté de la télécommande. Ce qui
  // revient PAR l'habillage, lui, a déjà été écarté une fois — il se montre,
  // reste atteignable à la navigation, et ne vole rien.
  const grabs =
    !hidden &&
    (overlay.kind === "skip" || overlay.kind === "nextButton") &&
    overlay.dismissible;

  useOverlayFocus(
    skipRef,
    grabs,
    (r) => r.querySelector(autoSkip ? ".saut-tv--refus" : "button"),
    true,
  );
  useOverlayFocus(cardRef, isCard && !hidden, zoneEntryDestination);
  // L'affiche recouvre tout, l'habillage compris : le focus s'impose, sur
  // « Lire maintenant » plutôt que sur la croix qui la précède dans le document.
  useOverlayFocus(
    posterRef,
    isPoster,
    (r) => mainAction(r) ?? zoneEntryDestination(r),
    true,
  );

  if (hidden || overlay.kind === "none") return null;

  if (overlay.kind === "skip") {
    const armed = overlay.countdownSeconds !== null;
    const label = armed
      ? t(`player:${overlay.labelKey}In`, { seconds: overlay.countdownSeconds })
      : t(`player:${overlay.labelKey}`);
    const skip = (
      <button
        type="button"
        className="saut-tv"
        {...{ [OVERLAY_ATTRIBUTE]: "" }}
        onClick={(e) => { e.stopPropagation(); onSkip(); }}
      >
        {label}
      </button>
    );
    // Le refus suit le caractère AUTOMATIQUE du passage, et non l'affichage
    // des secondes : un saut qui part tout seul avec le décompte masqué
    // n'offrait aucun bouton pour l'empêcher. Un passage qu'il faut demander,
    // lui, n'a rien à refuser — le bouton reste seul, à sa place.
    if (!overlay.auto) return <div ref={skipRef}>{skip}</div>;
    return (
      <div ref={skipRef} className="saut-tv-ilot">
        {skip}
        <button
          type="button"
          className="saut-tv saut-tv--refus"
          {...{ [OVERLAY_ATTRIBUTE]: "" }}
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        >
          {t("player:dismiss")}
        </button>
      </div>
    );
  }

  // La pilule « aller à l'épisode suivant » : même bouton que les sauts, à la
  // même place. Elle prend le relais quand la fiche ne parle pas — éteinte,
  // refusée, ou retirée le temps d'une scène post-générique.
  if (overlay.kind === "nextButton") {
    return (
      <div ref={skipRef}>
        <button
          type="button"
          className="saut-tv"
          {...{ [OVERLAY_ATTRIBUTE]: "" }}
          onClick={(e) => { e.stopPropagation(); onPlayNow(); }}
        >
          {t("player:goToNextEpisode")}
        </button>
      </div>
    );
  }

  if (isCard) {
    return (
      <div className="carte-suivant-tv" ref={cardRef} {...{ [OVERLAY_ATTRIBUTE]: "" }}>
        <UpNextCard
          countdown={overlay.countdownSeconds}
          totalSeconds={countdownTotals.nextMs / 1000}
          episodeTitle={nextEpisodeTitle}
          episodeDescription={nextEpisodeDescription}
          episodeImageUrl={nextEpisodeImageUrl}
          onPlay={onPlayNow}
          onDismiss={onDismiss}
        />
      </div>
    );
  }

  return (
    <div className="affiche-fin-tv" ref={posterRef} {...{ [OVERLAY_ATTRIBUTE]: "" }}>
      <NextEpisodeFullscreen
        countdown={overlay.countdownSeconds}
        totalSeconds={countdownTotals.nextMs / 1000}
        episodeTitle={nextEpisodeTitle}
        episodeDescription={nextEpisodeDescription}
        seriesBackdropUrl={nextSeriesBackdropUrl ?? nextEpisodeImageUrl}
        episodeThumbUrl={nextEpisodeThumbUrl ?? nextEpisodeImageUrl}
        onPlayNow={onPlayNow}
        onDismiss={() => {
          onDismiss();
          exitPlayer();
        }}
      />
    </div>
  );
}
