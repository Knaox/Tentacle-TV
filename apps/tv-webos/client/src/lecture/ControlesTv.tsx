import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PlayerControlsProps } from "@/components/PlayerControls";
import { inscrireRetour } from "../focus/retour";
import { reviserApresMontage } from "../focus/attente";
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
    document.documentElement.setAttribute("data-tv-lecteur", "");
    return () => {
      poserMonte(false);
      document.documentElement.removeAttribute("data-tv-lecteur");
    };
  }, []);

  useEffect(() => installerTouchesLecteurTv(() => actions.current), []);

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

  // Le focus n'est pas posé en entrant dans un écran : `amorcerFocus` n'est
  // appelé qu'au démarrage de l'application. La rangée dépend de l'épisode
  // suivant, qui arrive après une requête — d'où la révision après montage.
  const osd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (etat.mode !== "osd" || etat.panneau !== "aucun") return;
    reviserApresMontage(() => {
      const racine = osd.current;
      if (!racine) return false;
      if (racine.contains(document.activeElement)) return true;
      const defaut = racine.querySelector<HTMLElement>("[data-osd-defaut]");
      if (!defaut) return false;
      defaut.focus();
      return true;
    });
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
      />
    );
  }

  const aPistes = audioTracks.length > 0 || subtitleTracks.length > 0;
  const aEpisodes = item?.Type === "Episode" && !!item.SeriesId;

  return (
    <div className="osd-tv" ref={osd}>
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
      {/* `itemId` et `mediaSourceId` restent dans le contrat — ils servaient à
          l'aperçu de vignettes au survol, qui n'a pas d'équivalent ici. */}
      <span hidden data-item={itemId} data-source={mediaSourceId} />
    </div>
  );
}
