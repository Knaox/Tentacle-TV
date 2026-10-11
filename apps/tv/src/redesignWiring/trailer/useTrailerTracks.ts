import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerCapability, useTentacleConfig, useUserId } from "@tentacle-tv/api-client";
import { languageName } from "@tentacle-tv/shared";
import {
  TRAILER_QUALITY_AUTO,
  TRAILER_SUBTITLES_OFF,
  trailerChoose,
  trailerEngineRequest,
  trailerInitialQuality,
  trailerPanelEntryKey,
  trailerQualityHeights,
  trailerQualityOptions,
  trailerRememberedSubtitle,
  trailerSubtitleKey,
  trailerSubtitleMemoryOf,
  trailerSubtitleOptions,
  trailerTools,
  type TrailerOption,
  type TrailerPanel,
  type TrailerTools,
} from "@tentacle-tv/tv-core";
import type { TrackOptionModel } from "../../redesign/screens/player/playerTypes";
import type { TrailerPanelModel } from "../../redesign/screens/trailer/trailerTypes";
import type { TrailerTracks } from "../../screens/trailer/types";

/**
 * Les deux choix de la bande-annonce — sous-titres et qualité — et leurs
 * panneaux. Ce qui rend un bouton présent, les options, l'entrée d'un panneau
 * et ce que fait un choix : tv-core (`player/trailerPanels.ts`) ; ici, la
 * capacité du serveur, les libellés et l'état.
 *
 * - Garde : `trailers.player` pour les BOUTONS. Un serveur d'avant ne
 *   déclare rien → aucun bouton ; il n'offre ni pistes ni paliers, donc rien
 *   n'est demandé au moteur (tv-core `trailerEngineRequest`, lu sur l'offre)
 *   — avancer et reculer restent, sans un mot d'erreur.
 * - Le sous-titre choisi se RETIENT pour les bandes-annonces suivantes, par
 *   profil (tv-core `trailerSubtitleMemory`, clé du compte affiché).
 * - La qualité démarre à la PLUS HAUTE offerte (tv-core
 *   `trailerInitialQuality`), posée avec les pistes : la première source du
 *   moteur est déjà ce palier, sans second chargement. Un choix vaut pour
 *   cette bande-annonce seulement.
 */

const NO_TRACKS: TrailerTracks = { qualities: [], subtitles: [] };

export interface TrailerTracksState {
  tools: TrailerTools;
  /** La langue de la piste à afficher, `null` : aucune — à donner au moteur. */
  subtitle: string | null;
  /** La hauteur demandée, `null` : Auto — à donner au moteur. */
  quality: number | null;
  /** Le panneau ouvert, libellés posés ; `null` : aucun. */
  panel: TrailerPanelModel | null;
  /** L'option qui prend le focus à l'ouverture du panneau. */
  panelEntry: string | null;
  onTracks: (tracks: TrailerTracks) => void;
  open: (panel: TrailerPanel) => void;
  close: () => void;
  choose: (key: string) => void;
}

export function useTrailerTracks(): TrailerTracksState {
  const { t, i18n } = useTranslation("common");
  const { storage } = useTentacleConfig();
  const userId = useUserId();
  // Sans compte connu, rien ne se retient (aucune clé partagée entre profils).
  const memoryKey = userId ? trailerSubtitleKey(userId) : null;
  const capable = useServerCapability("trailers.player");
  const [tracks, setTracks] = useState<TrailerTracks>(NO_TRACKS);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [open, setOpen] = useState<TrailerPanel | null>(null);
  const locale = (i18n.language ?? "en").slice(0, 2);

  const onTracks = useCallback((next: TrailerTracks) => {
    setTracks(next);
    // Dans le même lot que la résolution : la source initiale est déjà la bonne.
    setQuality(trailerInitialQuality(next.qualities.map((q) => q.height)));
    setSubtitle(trailerRememberedSubtitle(next.subtitles, memoryKey ? storage.getItem(memoryKey) : null));
  }, [storage, memoryKey]);

  const heights = useMemo(() => trailerQualityHeights(tracks.qualities.map((q) => q.height)), [tracks.qualities]);
  const tools = useMemo(
    () => trailerTools({ playerCapable: capable, subtitleCount: tracks.subtitles.length, qualityCount: heights.length }),
    [capable, tracks.subtitles.length, heights.length],
  );

  const options = useMemo((): TrailerOption[] => {
    if (open === "subtitles") return trailerSubtitleOptions(tracks.subtitles.map((s) => ({ id: s.lang })), subtitle);
    if (open === "quality") return trailerQualityOptions(heights, quality);
    return [];
  }, [open, tracks.subtitles, subtitle, heights, quality]);

  const panel = useMemo((): TrailerPanelModel | null => {
    if (!open) return null;
    const label = (option: TrailerOption): TrackOptionModel => {
      if (open === "quality") {
        const text = option.key === TRAILER_QUALITY_AUTO ? t("trailerQualityAuto") : t("trailerQualityHeight", { height: option.key });
        return { key: option.key, label: text, selected: option.selected };
      }
      if (option.key === TRAILER_SUBTITLES_OFF) return { key: option.key, label: t("trailerSubtitlesOff"), selected: option.selected };
      const track = tracks.subtitles.find((s) => s.lang === option.key);
      const named = languageName(option.key, locale);
      // Sans nom de langue connu du moteur JS (le code en capitales), celui du serveur.
      const text = named === option.key.toUpperCase() && track?.label ? track.label : named;
      return { key: option.key, label: text, detail: track?.auto ? t("trailerSubtitleAutoGenerated") : undefined, selected: option.selected };
    };
    return { kind: open, options: options.map(label) };
  }, [open, options, tracks.subtitles, locale, t]);

  const choose = useCallback((key: string) => {
    if (!open) return;
    const choice = trailerChoose(open, options, key);
    setOpen(null);
    if (choice.apply === null) return;
    if (open === "subtitles") {
      setSubtitle(choice.apply === TRAILER_SUBTITLES_OFF ? null : choice.apply);
      if (memoryKey) storage.setItem(memoryKey, trailerSubtitleMemoryOf(choice.apply));
    } else {
      setQuality(choice.apply === TRAILER_QUALITY_AUTO ? null : Number(choice.apply));
    }
  }, [open, options, storage, memoryKey]);

  const openPanel = useCallback((next: TrailerPanel) => setOpen(next), []);
  const close = useCallback(() => setOpen(null), []);

  // Rien n'est demandé hors de l'offre du flux : un serveur d'avant n'offre rien.
  const request = trailerEngineRequest({
    offered: { subtitles: tracks.subtitles.map((s) => s.lang), qualities: heights },
    subtitle,
    quality,
  });
  return {
    tools,
    subtitle: request.subtitle,
    quality: request.quality,
    panel,
    panelEntry: open ? trailerPanelEntryKey(open, options) : null,
    onTracks,
    open: openPanel,
    close,
    choose,
  };
}
