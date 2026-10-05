import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useJellyfinOutage } from "@tentacle-tv/api-client";
import { jellyfinOutageCopy, type QualityPreset } from "@tentacle-tv/shared";
import { activatesTroublePanel, focusInTrouble, TROUBLE_REFOCUS_MS, troubleLeaveReturnsToOsd } from "@tentacle-tv/tv-core";
import { noteSkipFocusClaim, returnFocusToOsd } from "../../components/player/focus/osdFocusBus";
import { useRemoteIntents } from "../../platform/input";
import { retryPlaybackNow, usePlaybackTroubleState, useServerFallbackAt } from "../../hooks/playbackTroubleStore";
import type { Translate } from "../../redesign/screens/player/playerLabels";
import type { PlaybackTroubleModel, TroubleActionKey } from "../../redesign/screens/player/playbackTroubleTypes";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { lowerQualityKey, noticeOf, panelOf, RESUMED_NOTICE, SERVER_FALLBACK_NOTICE, troubleModelOf } from "./playbackTroubleModel";

/** « La lecture a repris » : le temps de le lire. */
const RESUMED_NOTICE_MS = 4000;
/** Tentacle seul à terre, flux direct : on le dit, puis seulement avec l'habillage. */
const TENTACLE_NOTICE_MS = 8000;
/** Le serveur a pris le relais : le temps d'ouvrir son flux, puis de le lire. */
const SERVER_FALLBACK_NOTICE_MS = 14000;
const PANEL_KINDS = new Set(["waiting", "recovering", "stuck"]);

/** Vrai jusqu'à `until`, puis faux — un rendu à l'échéance, pas de minuterie à vide. */
function useUntil(until: number | null): boolean {
  const [, bump] = useState(0);
  const live = until !== null && Date.now() < until;
  useEffect(() => {
    if (until === null) return undefined;
    const left = until - Date.now();
    if (left <= 0) return undefined;
    const timer = setTimeout(() => bump((n) => n + 1), left + 20);
    return () => clearTimeout(timer);
  }, [until]);
  return live;
}

/**
 * Le message-outil du lecteur refondu : l'état de la reprise
 * (`playbackTroubleStore`) traduit en bandeau ou en panneau, et ses gestes.
 *
 * Le focus : le panneau PARAÎT sans le prendre — c'est le premier appui de
 * l'utilisateur qui l'ACTIVE : le focus va alors à « Réessayer maintenant »,
 * l'habillage recule (`covers`), le fond cesse d'être focalisable. Quand la
 * lecture reprend, le panneau part et rend le focus : à l'habillage s'il est
 * là, sinon au fond, qui le réclame de lui-même.
 */
export function usePlaybackTrouble(args: {
  t: Translate;
  store: FocusStore;
  /** Où la lecture reprendra : la position affichée, figée pendant l'arrêt. */
  position: number;
  osdVisible: boolean;
  qualityKey: string;
  qualityPresets: readonly QualityPreset[];
  onSelectQuality?: (key: string) => void;
  onBack?: () => void;
}): { model: PlaybackTroubleModel | null; covers: boolean; onAction: (key: TroubleActionKey) => void } {
  const { t, store, osdVisible, qualityKey, qualityPresets, onSelectQuality, onBack } = args;
  const trouble = usePlaybackTroubleState();
  const { phase } = trouble;
  const panelPhase = PANEL_KINDS.has(phase.kind);

  // L'ACTIVATION, au premier APPUI pendant que le panneau est là (tv-core
  // `activatesTroublePanel` : ni le pavé, ni Retour) — vu passer à l'entrée unique.
  const [active, setActive] = useState(false);
  const watching = useRef({ panelPhase, active });
  watching.current = { panelPhase, active };
  useRemoteIntents((event) => {
    const w = watching.current;
    if (!w.panelPhase || w.active || !activatesTroublePanel(event.intent)) return;
    setActive(true);
  });
  // Le même appui rallume l'habillage, dont la restauration IMPLICITE (au
  // dernier bouton, 220 ms plus tard) défaisait la réclamation : elle cède à
  // une surface qui vient de réclamer — le mécanisme de la pilule de saut.
  useEffect(() => {
    if (!active) return undefined;
    noteSkipFocusClaim();
    return store.claim("trouble:retry");
  }, [active, store]);

  // Le panneau part (la lecture reprend) : il rend le focus qu'il tenait.
  const wasPanel = useRef(false);
  const [resumedUntil, setResumedUntil] = useState<number | null>(null);
  useEffect(() => {
    if (wasPanel.current && !panelPhase) {
      setActive(false);
      if (phase.kind === "none") setResumedUntil(Date.now() + RESUMED_NOTICE_MS);
      if (troubleLeaveReturnsToOsd(store.focusedKey(), osdVisible)) returnFocusToOsd();
    }
    if (panelPhase) setResumedUntil(null);
    wasPanel.current = panelPhase;
  }, [panelPhase, phase.kind, store, osdVisible]);
  const resumedShown = useUntil(resumedUntil);
  const fallbackAt = useServerFallbackAt();
  const fallbackShown = useUntil(fallbackAt !== null ? fallbackAt + SERVER_FALLBACK_NOTICE_MS : null);

  // Le décompte « nouvelle vérification dans 4 s » : une seconde à la fois,
  // seulement panneau affiché.
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!panelPhase) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [panelPhase]);

  // Le rappel bref ne vaut que pour Tentacle seul, sous un flux qui n'en
  // dépend pas ; un flux qui passe par lui garde son compte à rebours.
  const tentacleSince = phase.kind === "degraded" && phase.cause === "tentacle" && !phase.streamAffected ? phase.since : null;
  const tentacleFresh = useUntil(tentacleSince !== null ? tentacleSince + TENTACLE_NOTICE_MS : null);

  const lower = lowerQualityKey(qualityPresets, qualityKey);
  const position = Math.floor(args.position);
  // Jellyfin en panne, dit par le serveur : son état en titre (la même phrase qu'ailleurs).
  const outage = useJellyfinOutage();
  const outageCopy = outage.phase === "outage" || outage.phase === "long" ? jellyfinOutageCopy(outage.state, false) : null;
  const outageTitle = outageCopy ? t(outageCopy.titleKey) : null;
  const model = useMemo(() => {
    const panel = panelOf({
      t, phase, now, position, nextCheckAt: trouble.nextCheckAt, checking: trouble.checking,
      stillDown: trouble.stillDown, canLowerQuality: lower !== null && !!onSelectQuality, active, outageTitle,
    });
    let notice = noticeOf(t, phase, outageTitle);
    if (notice && tentacleSince !== null && !tentacleFresh && !osdVisible) notice = null;
    if (!panel && !notice && fallbackShown) notice = SERVER_FALLBACK_NOTICE(t);
    if (!panel && !notice && resumedShown) notice = RESUMED_NOTICE(t);
    return troubleModelOf(panel, notice);
  }, [t, phase, now, position, trouble.nextCheckAt, trouble.checking, trouble.stillDown, lower, onSelectQuality, active,
    tentacleSince, tentacleFresh, osdVisible, resumedShown, fallbackShown, outageTitle]);

  // Un bouton qui paraît ou part (« Baisser la qualité ») réordonne les vues
  // natives, et UIKit perd le focus de celle qu'il déplace : panneau activé,
  // on le rend au geste principal s'il n'est plus dans le panneau.
  const actionsKey = model?.mode === "panel" ? model.actions.map((action) => action.key).join() : "";
  useEffect(() => {
    if (!active || !actionsKey) return undefined;
    const timer = setTimeout(() => {
      if (!focusInTrouble(store.focusedKey())) store.claim("trouble:retry");
    }, TROUBLE_REFOCUS_MS);
    return () => clearTimeout(timer);
  }, [actionsKey, active, store]);

  // VoiceOver : le titre dit, à chaque changement — sans prendre le focus.
  const title = model?.title;
  useEffect(() => { if (title) AccessibilityInfo.announceForAccessibility(title); }, [title]);

  const onAction = useCallback((key: TroubleActionKey) => {
    if (key === "retry") retryPlaybackNow();
    else if (key === "quality" && lower) onSelectQuality?.(lower);
    else if (key === "back") onBack?.();
  }, [lower, onSelectQuality, onBack]);

  return { model, covers: panelPhase && active, onAction };
}
