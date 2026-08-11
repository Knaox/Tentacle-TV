import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PlayerControlsProps } from "@/components/PlayerControls";
import { entrerDansPanneau, quitterPanneau } from "./focusOsd";
import { cumuler, type CumulSauts } from "./cumulSauts";
import { creerMachineScrub, type MachineScrub } from "./machineScrub";
import { useCycleLecteurTv } from "./cycleLecteurTv";
import {
  entrerScrub,
  majScrub,
  montrerOsd,
  poserPanneau,
  sortirScrub,
  useEtatLecteurTv,
} from "./etatLecteurTv";
import { BarreProgressionTv } from "./BarreProgressionTv";
import { EnteteTv } from "./EnteteTv";
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
    // `buffered` du web est une FRACTION de 0 à 1, pas des secondes. La barre du
    // téléviseur le redivisait par la durée et n'a donc jamais rien affiché ;
    // c'est exactement la casse « en silence, sur une dalle » annoncée plus
    // haut, et elle a duré parce que les deux unités sont des `number`. La
    // propriété d'en face porte désormais son unité dans son nom.
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

  /** Ce que les sauts enchaînés ont demandé jusqu'ici, et quand. */
  const cumul = useRef<CumulSauts | null>(null);

  /**
   * Le saut nu, sans rien allumer.
   *
   * C'est la forme qu'appellent les FLÈCHES, habillage éteint : y répondre en
   * rallumant les commandes ferait d'un geste anodin un changement d'écran, et
   * masquerait l'image au moment précis où l'on cherche à s'y retrouver. Le
   * badge suffit à dire ce qui se passe — c'est son emploi.
   *
   * **Pourquoi on passe le CUMUL et non le pas.** `skipBy` du client web
   * calcule sa cible depuis la position RÉELLE de la vidéo. Or celle-ci ne
   * bouge pas entre deux appuis enchaînés — le déplacement est différé, et sur
   * un flux transcodé il l'est franchement. Trois « +30 » d'affilée
   * demandaient donc trois fois la même chose : trente secondes, une seule
   * fois, pendant que le badge en annonçait quatre-vingt-dix. On additionne
   * ici, et l'on demande la somme.
   *
   * C'est aussi ce qui rend le badge juste sans qu'il ait à compter : il reçoit
   * le total, il l'affiche.
   */
  const sauterNu = useCallback(
    (delta: number) => {
      const suivant = cumuler(cumul.current, delta, Date.now());
      cumul.current = suivant;
      if (onSkip) onSkip(suivant.total);
      else onSeek(Math.max(0, position.current + suivant.total));
    },
    [onSeek, onSkip],
  );

  useCycleLecteurTv({
    mode: etat.mode,
    actions: { basculerLecture: onTogglePlay, sauter: sauterNu, quitter, scrub },
    scrub,
  });

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

  /** La forme des BOUTONS : le même saut, mais l'habillage reste à l'écran. */
  const sauter = useCallback(
    (delta: number) => {
      montrerOsd();
      sauterNu(delta);
    },
    [sauterNu],
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
        fractionChargee={buffered}
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
      <EnteteTv titre={title} sousTitre={subtitle} onQuitter={quitter} />

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
          fractionChargee={buffered}
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
          // Le curseur fantôme se pose où l'on en est, sans avancer : on a
          // demandé à se déplacer, pas encore où.
          onDeplacement={() => scrub.entrer()}
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
