import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PlayerControlsProps } from "@/components/PlayerControls";
import { inscrireRetour } from "../focus/retour";
import { entrerDansPanneau, oublierBoutonOsd, quitterPanneau } from "./focusOsd";
import { creerMachineScrub, type MachineScrub } from "./machineScrub";
import { installerTouchesLecteurTv, type ActionsLecteurTv } from "./touchesLecteurTv";
import {
  entrerScrub,
  lireEtat,
  majScrub,
  montrerOsd,
  poserMonte,
  poserPanneau,
  sortirScrub,
  useEtatLecteurTv,
} from "./etatLecteurTv";
import { BarreProgressionTv } from "./BarreProgressionTv";
import { RangeeTransportTv } from "./RangeeTransportTv";
import { SurcoucheScrubTv } from "./SurcoucheScrubTv";
import { PanneauPistesTv, PanneauEpisodesTv } from "./PanneauxTv";

/**
 * Les commandes du lecteur, dessinées pour trois mètres.
 *
 * Substitué à `apps/web/src/components/PlayerControls.tsx`, dont le contrat est
 * repris **à l'identique et annoté explicitement** : la substitution est un
 * greffon Vite, `tsc` ne la connaît pas, et sans cette annotation une propriété
 * renommée dans `apps/web` casserait le lecteur du téléviseur à l'exécution,
 * en silence, sur une dalle. C'est la leçon de la jauge de bannière.
 *
 * Ce qui est remplacé est du DESSIN, pas de la logique. Le seek reste celui de
 * `useSmartSeek`, câblé sur `onSeek` — le seul chemin qui sache suivre un
 * transcodage HLS plutôt que de le couper. Les pistes, les épisodes, la
 * lecture, l'enchaînement : tout arrive déjà par les propriétés.
 *
 * Trois rendus exclusifs selon le mode. Au repos, rien — et le masquage
 * automatique, qui lit le même magasin, met l'enveloppe à `opacity-0` en même
 * temps. En déplacement, la surcouche du curseur fantôme, VISIBLE parce que
 * cette même enveloppe reste opaque tant que le mode n'est pas `repos` : c'est
 * ce qui permet de dessiner le déplacement sans portail et sans substituer
 * `VideoPlayer`.
 */

export function PlayerControls(props: PlayerControlsProps) {
  const {
    playing, currentTime, duration, buffered,
    item, itemId, mediaSourceId, title, subtitle,
    audioTracks, subtitleTracks, currentAudio, currentSubtitle,
    currentQuality, sourceQuality, qualityPresets,
    hasNextEpisode, hasPreviousEpisode,
    onTogglePlay, onSeek, onSkip, onBack,
    onAudioChange, onSubtitleChange, onQualityChange,
    onNextEpisode, onPreviousEpisode, applyToSeries,
  } = props;

  const etat = useEtatLecteurTv();

  // Les valeurs vivantes passent par des refs : la machine à scrub est créée
  // une fois pour toutes et lit l'état au moment où elle en a besoin, plutôt
  // que de se reconstruire à chaque image du compteur de temps.
  const position = useRef(currentTime);
  const total = useRef(duration);
  const lecture = useRef(playing);
  position.current = currentTime;
  total.current = duration;
  lecture.current = playing;

  const scrub = useMemo<MachineScrub>(
    () =>
      creerMachineScrub({
        lirePosition: () => position.current,
        lireDuree: () => total.current,
        surEntree: (pos, palier) => entrerScrub(pos, palier),
        surChangement: (pos, palier) => majScrub(pos, palier),
        surPause: (pause) => {
          // La bascule du lecteur est la seule qu'on connaisse : on ne s'en
          // sert que si l'état courant ne correspond pas à ce qu'on veut.
          if (pause === !lecture.current) return;
          onTogglePlay();
        },
        surSeek: (secondes) => onSeek(secondes),
        surSortie: () => sortirScrub(),
      }),
    [onSeek, onTogglePlay],
  );

  useEffect(() => () => scrub.detruire(), [scrub]);

  const quitter = useCallback(() => onBack(), [onBack]);

  const actions = useRef<ActionsLecteurTv>({
    basculerLecture: onTogglePlay,
    quitter,
    scrub,
  });
  actions.current = { basculerLecture: onTogglePlay, quitter, scrub };

  // Monté et démonté avec le lecteur : c'est cet indicateur que lisent le
  // moteur de focus et les touches de transport globales pour se retirer.
  useEffect(() => {
    poserMonte(true);
    return () => {
      poserMonte(false);
      document.documentElement.removeAttribute("data-tv-lecteur");
      // La mémoire du focus ne survit pas au lecteur : rouvrir un film repart
      // de Lecture, comme une première fois.
      oublierBoutonOsd();
    };
  }, []);

  useEffect(() => installerTouchesLecteurTv(() => actions.current), []);

  /**
   * Le mode, publié sur la racine du document.
   *
   * Deux choses en dépendent, et aucune n'est un enfant de l'habillage : le
   * retrait d'overscan de `#root`, qu'il faut annuler tant que le lecteur est
   * là, et les surcouches — bouton « passer », carte « à suivre » —, qui vivent
   * dans l'autre arbre et doivent s'écarter quand les commandes paraissent.
   * Un attribut est la seule prise que le CSS ait sur un état qui n'est nulle
   * part dans son sous-arbre.
   */
  useEffect(() => {
    document.documentElement.setAttribute("data-tv-lecteur", etat.mode);
  }, [etat.mode]);

  /**
   * Le retour, en cascade : un panneau ouvert se ferme, un déplacement en cours
   * s'annule SANS déplacer, et sinon on laisse la pile faire son travail — elle
   * signale la sortie du lecteur avant de reculer, ce dont dépend la transition
   * de retour vers la fiche.
   */
  useEffect(
    () =>
      inscrireRetour(() => {
        const courant = lireEtat();
        if (courant.panneau !== "aucun") {
          poserPanneau("aucun");
          return true;
        }
        if (courant.mode === "scrub") {
          scrub.annuler();
          return true;
        }
        return false;
      }),
    [scrub],
  );

  const osd = useRef<HTMLDivElement>(null);

  /** Ce qui a ouvert le panneau, pour lui rendre le focus en le refermant. */
  const declencheurPanneau = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (etat.mode !== "osd") return;

    if (etat.panneau !== "aucun") {
      // Un panneau s'ouvre. On note d'où l'on vient, puis on entre dedans : le
      // focus restait sinon sur le bouton qui l'a ouvert, hors du panneau, et
      // le confinement calculait ses déplacements depuis un point extérieur.
      const actif = document.activeElement;
      if (actif instanceof HTMLElement && !actif.closest(".panneau-tv")) {
        declencheurPanneau.current = actif;
      }
      entrerDansPanneau();
      return;
    }

    // Aucun panneau : soit on vient d'en refermer un — le focus revient alors à
    // ce qui l'a ouvert, et non au centre de l'habillage —, soit l'habillage
    // vient de paraître.
    const declencheur = declencheurPanneau.current;
    declencheurPanneau.current = null;
    quitterPanneau(declencheur, osd.current);
  }, [etat.mode, etat.panneau]);

  const sauter = useCallback(
    (delta: number) => {
      montrerOsd();
      if (onSkip) onSkip(delta);
      else onSeek(Math.max(0, currentTime + delta));
    },
    [currentTime, onSeek, onSkip],
  );

  if (etat.mode === "repos") return null;

  if (etat.mode === "scrub" && etat.scrub) {
    return (
      <SurcoucheScrubTv
        titre={title}
        position={etat.scrub.position}
        palier={etat.scrub.palier}
        currentTime={currentTime}
        duration={duration}
        buffered={buffered}
        item={item}
        mediaSourceId={mediaSourceId}
      />
    );
  }

  const aPistes = audioTracks.length > 0 || subtitleTracks.length > 0;
  const aEpisodes = item?.Type === "Episode" && !!item.SeriesId;

  return (
    /**
     * Le clic s'arrête ici, et c'est vital.
     *
     * Le conteneur du `VideoPlayer` bascule la lecture à tout clic qui lui
     * parvient (`VideoPlayer.tsx`, `onClick={togglePlay}`) — un geste de souris
     * qui a du sens sur un écran d'ordinateur, aucun ici. Or `preventDefault`
     * ayant tué l'activation native d'Entrée, `activerElementFocalise()` rejoue
     * un VRAI `.click()`, qui remonte comme tel.
     *
     * Sans cette barrière, chaque appui sur OK agissait deux fois : le bouton
     * faisait son travail, puis le conteneur basculait la lecture par-dessus.
     * Sur Lecture/Pause les deux bascules s'annulaient — « OK ne fait rien » —,
     * et partout ailleurs le symptôme était invisible : ouvrir les pistes
     * mettait la vidéo en pause, +30 sautait ET mettait en pause. Le
     * `PlayerControls` du web pose la même barrière sur chacune de ses deux
     * barres ; le portage ne l'avait pas reprise.
     */
    <div
      className="osd-tv"
      ref={osd}
      data-panneau={etat.panneau}
      onClick={(evenement) => evenement.stopPropagation()}
    >
      <div className="osd-tv-haut">
        <h2 className="osd-tv-titre">{title}</h2>
        {subtitle && <p className="osd-tv-sous-titre">{subtitle}</p>}
      </div>

      <div className="osd-tv-bas">
        {etat.panneau === "pistes" && (
          <PanneauPistesTv
            audioTracks={audioTracks}
            subtitleTracks={subtitleTracks}
            currentAudio={currentAudio}
            currentSubtitle={currentSubtitle}
            currentQuality={currentQuality}
            sourceQuality={sourceQuality}
            qualityPresets={qualityPresets}
            onAudioChange={onAudioChange}
            onSubtitleChange={onSubtitleChange}
            onQualityChange={onQualityChange}
            applyToSeries={applyToSeries}
            onClose={() => poserPanneau("aucun")}
          />
        )}
        {etat.panneau === "episodes" && item && (
          <PanneauEpisodesTv item={item} onClose={() => poserPanneau("aucun")} />
        )}

        <BarreProgressionTv
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
        />

        <RangeeTransportTv
          playing={playing}
          aPrecedent={!!hasPreviousEpisode}
          aSuivant={!!hasNextEpisode}
          aEpisodes={aEpisodes}
          aPistes={aPistes}
          onBasculer={() => {
            montrerOsd();
            onTogglePlay();
          }}
          onSauter={sauter}
          onPrecedent={() => onPreviousEpisode?.()}
          onSuivant={() => onNextEpisode?.()}
          onEpisodes={() => poserPanneau(etat.panneau === "episodes" ? "aucun" : "episodes")}
          onPistes={() => poserPanneau(etat.panneau === "pistes" ? "aucun" : "pistes")}
        />
      </div>
      {/* `itemId` reste dans le contrat sans emploi ici : le client web s'en
          sert pour l'aperçu au survol, que la surcouche de déplacement rend
          autrement. `mediaSourceId`, lui, y sert — c'est la clé du manifeste
          de vignettes. */}
      <span hidden data-item={itemId} />
    </div>
  );
}
