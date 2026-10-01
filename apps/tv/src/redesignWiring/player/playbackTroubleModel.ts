import type { QualityPreset } from "@tentacle-tv/shared";
import type { RecoveryPhase, TroubleCause } from "@tentacle-tv/tv-core";
import type { IconName } from "../../redesign/icons/Icon";
import { formatClock } from "../../redesign/screens/player/formatClock";
import type { Translate } from "../../redesign/screens/player/playerLabels";
import type {
  PlaybackTroubleModel, TroubleAction, TroubleNoticeModel, TroublePanelModel,
} from "../../redesign/screens/player/playbackTroubleTypes";

/**
 * L'état de la reprise (`playbackTroubleStore`), traduit en message-outil.
 * Pur : l'intégration lui donne l'heure, la position, les paliers ; il rend
 * ce que la vue dit.
 */

const TITLE: Record<TroubleCause, string> = {
  media: "player:troubleMediaTitle",
  tentacle: "player:troubleTentacleTitle",
  network: "player:troubleNetworkTitle",
  slow: "player:troubleSlowTitle",
};

const ICON: Record<TroubleCause, IconName> = {
  media: "server",
  tentacle: "server",
  network: "wifiOff",
  slow: "gauge",
};

/** « 34 s », « 2 min » — ce qui reste chargé. */
export function aheadLabel(t: Translate, seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return s < 60 ? t("player:troubleSeconds", { count: s }) : t("player:troubleMinutes", { count: Math.floor(s / 60) });
}

/** Le palier sous celui qui joue — `null` s'il n'y en a pas. */
export function lowerQualityKey(presets: readonly QualityPreset[], current: string): string | null {
  const index = presets.findIndex((preset) => preset.key === current);
  const next = presets[index < 0 ? 1 : index + 1];
  return next ? next.key : null;
}

export function noticeOf(t: Translate, phase: RecoveryPhase): TroubleNoticeModel | null {
  if (phase.kind !== "degraded") return null;
  // Tentacle seul, sous un flux direct : la lecture n'en dépend pas. Sinon (le
  // flux passe par le serveur à terre), elle vit sur ce qui est chargé.
  const detail = phase.streamAffected
    ? t("player:troublePlayingOn", { time: aheadLabel(t, phase.ahead) })
    : t("player:troublePlayingUnaffected");
  return { mode: "notice", icon: "server", tone: "warning", title: t(TITLE[phase.cause]), detail };
}

export const RESUMED_NOTICE = (t: Translate): TroubleNoticeModel => ({
  mode: "notice", icon: "check", tone: "success", title: t("player:troubleResumed"), detail: t("player:troubleResumedDetail"),
});

export function panelOf(args: {
  t: Translate;
  phase: RecoveryPhase;
  now: number;
  /** Où la lecture reprendra (timeline absolue). */
  position: number;
  nextCheckAt: number | null;
  checking: boolean;
  stillDown: boolean;
  canLowerQuality: boolean;
  active: boolean;
}): TroublePanelModel | null {
  const { t, phase } = args;
  if (phase.kind !== "waiting" && phase.kind !== "recovering" && phase.kind !== "stuck") return null;
  const cause = phase.cause;
  const position = formatClock(args.position);
  const slowish = cause === "slow" || phase.kind === "stuck";
  const seconds = args.nextCheckAt !== null ? Math.max(1, Math.ceil((args.nextCheckAt - args.now) / 1000)) : null;

  let status: string;
  let busy = false;
  if (phase.kind === "recovering") { status = t("player:troubleResuming"); busy = true; }
  else if (phase.kind === "stuck") status = t("player:troubleStuckStatus");
  else if (args.checking) { status = t("player:troubleChecking"); busy = true; }
  else if (cause === "slow") status = t("player:troubleSlowWaiting");
  else if (seconds !== null) status = t(args.stillDown ? "player:troubleStillDown" : "player:troubleCheckingIn", { seconds });
  else { status = t("player:troubleChecking"); busy = true; }

  // La reprise en cours : le serveur répond — le dire, plutôt que sa panne.
  const back = phase.kind === "recovering" && cause !== "slow";
  const detail = phase.kind === "stuck"
    ? t("player:troubleStuckDetail", { position })
    : back ? t("player:troubleResumingAt", { position })
      : cause === "slow" ? t("player:troubleSlowDetail") : t("player:troubleResumesAt", { position });

  const actions: TroubleAction[] = [{ key: "retry", label: t("player:troubleRetryNow"), icon: "refresh" }];
  if (slowish && args.canLowerQuality) actions.push({ key: "quality", label: t("player:troubleLowerQuality"), icon: "gauge" });

  const title = back ? t("player:troubleBackTitle") : t(TITLE[cause]);
  return { mode: "panel", icon: back ? "refresh" : ICON[cause], title, detail, status, busy, actions, active: args.active };
}

/** Le bandeau ou le panneau — un seul à la fois, le panneau d'abord. */
export function troubleModelOf(panel: TroublePanelModel | null, notice: TroubleNoticeModel | null): PlaybackTroubleModel | null {
  return panel ?? notice;
}
