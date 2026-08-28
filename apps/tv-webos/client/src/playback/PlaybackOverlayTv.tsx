/**
 * La projection de l'ARBITRE, version téléviseur LG — le pendant du
 * `PlaybackOverlay` web, avec ce qui change à trois mètres : l'ancrage
 * d'overscan (classes `.saut-tv`, `.carte-suivant-tv`, `.affiche-fin-tv`),
 * la prise de focus quand l'habillage s'est éteint, et le refus en SECOND
 * BOUTON plutôt qu'en croix (une cible de trente-deux pixels ne se vise pas
 * à la télécommande). Aucune décision ici non plus : qui s'affiche, quand et
 * avec quel décompte vient de la coquille partagée, comme partout.
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
import { donnerFocus } from "../focus/active";
import { destinationEntreeDeZone } from "../focus/zones";
import { lireEtat, useEtatLecteurTv } from "@tentacle-tv/tv-core";
import { poserFocusOsd } from "./focusOsd";
import { quitterLecteur } from "./playerExitTv";
import { ATTRIBUT_SURCOUCHE } from "./okOverlay";

interface ProprietesTv {
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
function actionPrincipale(racine: HTMLElement): HTMLElement | null {
  for (const bouton of racine.querySelectorAll<HTMLElement>("button")) {
    if (bouton.parentElement !== racine) return bouton;
  }
  return null;
}

/** Prend le focus si personne d'autre ne s'en sert, le rend à l'habillage après. */
function useFocusSurcouche(
  ref: { current: HTMLElement | null },
  actif: boolean,
  cible: (racine: HTMLElement) => HTMLElement | null,
  imposer = false,
) {
  useEffect(() => {
    const racine = ref.current;
    if (!actif || !racine) return;
    if (!imposer && lireEtat().mode !== "repos") return;
    const element = cible(racine);
    if (element) donnerFocus(element);
    return () => {
      if (!racine.contains(document.activeElement)) return;
      const focal = document.activeElement;
      if (focal instanceof HTMLElement) focal.blur();
      poserFocusOsd(document.querySelector<HTMLElement>(".osd-tv"));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, imposer]);
}

export function PlaybackOverlayTv({
  overlay, countdownTotals, onSkip, onDismiss, onPlayNow,
  nextEpisodeTitle, nextEpisodeDescription, nextEpisodeImageUrl,
  nextSeriesBackdropUrl, nextEpisodeThumbUrl,
}: ProprietesTv) {
  const { t } = useTranslation("player");
  const etat = useEtatLecteurTv();
  const refSaut = useRef<HTMLDivElement>(null);
  const refCarte = useRef<HTMLDivElement>(null);
  const refAffiche = useRef<HTMLDivElement>(null);

  const estSaut = overlay.kind === "skip";
  const estCarte = overlay.kind === "nextCard" && !overlay.final;
  const estAffiche = overlay.kind === "nextCard" && overlay.final;

  // Rien pendant le déplacement — l'écran du curseur fantôme est un mode, on y
  // cherche une position. L'affiche de fin, elle, a raison même là : il n'y a
  // plus de position à chercher.
  const efface = etat.mode === "scrub" && !estAffiche;

  useFocusSurcouche(refSaut, estSaut && !efface, (r) => r.querySelector("button"));
  useFocusSurcouche(refCarte, estCarte && !efface, destinationEntreeDeZone);
  // L'affiche recouvre tout, l'habillage compris : le focus s'impose, sur
  // « Lire maintenant » plutôt que sur la croix qui la précède dans le document.
  useFocusSurcouche(
    refAffiche,
    estAffiche,
    (r) => actionPrincipale(r) ?? destinationEntreeDeZone(r),
    true,
  );

  if (efface || overlay.kind === "none") return null;

  if (overlay.kind === "skip") {
    const arme = overlay.countdownSeconds !== null;
    const libelle = arme
      ? t(`player:${overlay.labelKey}In`, { seconds: overlay.countdownSeconds })
      : t(`player:${overlay.labelKey}`);
    const sauter = (
      <button
        type="button"
        className="saut-tv"
        {...{ [ATTRIBUT_SURCOUCHE]: "" }}
        onClick={(e) => { e.stopPropagation(); onSkip(); }}
      >
        {libelle}
      </button>
    );
    // Hors décompte, le bouton reste seul, à sa place. L'îlot n'apparaît que
    // le temps du décompte, avec le refus en second bouton.
    if (!arme) return <div ref={refSaut}>{sauter}</div>;
    return (
      <div ref={refSaut} className="saut-tv-ilot">
        {sauter}
        <button
          type="button"
          className="saut-tv saut-tv--refus"
          {...{ [ATTRIBUT_SURCOUCHE]: "" }}
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        >
          {t("player:dismiss")}
        </button>
      </div>
    );
  }

  if (estCarte) {
    return (
      <div className="carte-suivant-tv" ref={refCarte} {...{ [ATTRIBUT_SURCOUCHE]: "" }}>
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
    <div className="affiche-fin-tv" ref={refAffiche} {...{ [ATTRIBUT_SURCOUCHE]: "" }}>
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
          quitterLecteur();
        }}
      />
    </div>
  );
}
