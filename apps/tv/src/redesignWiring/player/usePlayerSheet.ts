import { useMemo, useRef, useState } from "react";
import { sheetEntryKey } from "@tentacle-tv/tv-core";
import type { Translate } from "../../redesign/screens/player/playerLabels";
import type { PlayerPanel } from "../../redesign/screens/player/playerTypes";
import { buildSettingsPanel, buildTracksPanel } from "./playerPanelModels";
import type { PlayerRedesignStageProps } from "./playerStageTypes";

/** Les deux onglets de la feuille : les pistes, et les réglages (qualité et le reste). */
export type SheetTab = "tracks" | "settings";

export interface PlayerSheet {
  /** La feuille ouverte, ou `null`. */
  panel: Extract<PlayerPanel, { kind: SheetTab }> | null;
  /** L'option qui prend le focus à l'ouverture, figée tant que la feuille reste ouverte. */
  entryKey: string | null;
  /** La pilule de l'onglet ouvert — gardée après la fermeture : le focus y revient. */
  opener: string;
  /** Ouvre l'onglet d'une pilule (« Pistes », « Réglages »). */
  open: (tab: SheetTab) => void;
}

/** La pilule de l'habillage qui ouvre chaque onglet. */
const OPENERS: Readonly<Record<SheetTab, string>> = { tracks: "player:tracks", settings: "player:settings" };

/** Le choix retenu de la première colonne, sinon la croix (tv-core `sheetEntryKey`). */
function entryKeyOf(panel: NonNullable<PlayerSheet["panel"]>): string {
  if (panel.kind === "settings") return sheetEntryKey("settings", "quality", panel.settings.quality);
  return sheetEntryKey("tracks", "audio", panel.tracks.audio);
}

/**
 * La feuille du lecteur refondu — « Pistes » ou « Réglages ». L'écran ne
 * tient qu'un état, un panneau de réglages ouvert (`showSettings`, le même
 * qu'Android TV et sa route modale : Retour, fond, contrôles inchangés) ;
 * l'onglet, c'est la pilule pressée. L'entrée du focus — le choix retenu —
 * est figée à l'ouverture : choisir ne déplace pas la préférence sous le doigt.
 */
export function usePlayerSheet(p: PlayerRedesignStageProps, t: Translate): PlayerSheet {
  const [tab, setTab] = useState<SheetTab>("tracks");
  const panel = useMemo<PlayerSheet["panel"]>(() => {
    if (!p.showSettings) return null;
    if (tab === "settings") {
      return {
        kind: "settings",
        settings: buildSettingsPanel({
          qualityKey: p.qualityKey, qualityPresets: p.qualityPresets, source: p.sourceQuality, autoCap: !!p.autoCapActive, t,
        }),
      };
    }
    return {
      kind: "tracks",
      tracks: buildTracksPanel({
        audio: p.audioTracksList, subtitles: p.subtitleTracksList, audioIndex: p.audioIndex, subtitleIndex: p.subtitleIndex, t,
      }),
    };
  }, [p.showSettings, tab, p.qualityKey, p.qualityPresets, p.sourceQuality, p.autoCapActive, p.audioTracksList,
    p.subtitleTracksList, p.audioIndex, p.subtitleIndex, t]);

  const entry = useRef<string | null>(null);
  if (!panel) entry.current = null;
  else if (entry.current === null) entry.current = entryKeyOf(panel);

  // Lu au moment du geste : l'ouverture de l'écran change à chaque rendu.
  const latest = useRef(p);
  latest.current = p;
  const [open] = useState(() => (next: SheetTab) => {
    setTab(next);
    latest.current.onToggleSettings();
  });
  return { panel, entryKey: entry.current, opener: OPENERS[tab], open };
}
