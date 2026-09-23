import { memo } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Lock, MessageSquare, Pause, Play, Radio } from "lucide-react";
import type { AdminSessionDto } from "@tentacle-tv/shared";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { easeOut } from "../../../theme/motion";
import { LeaderboardAvatar } from "../../easterEggs/LeaderboardAvatar";
import { ActionPill } from "./ActionPill";
import { CommandStatus } from "./CommandStatus";
import { ConfirmButton } from "./ConfirmButton";
import { PlaybackDetails } from "./PlaybackDetails";
import { Poster } from "./Poster";
import { buttonStatus, type Feedback } from "./commandFeedback";
import { formatClock, joinParts, livePositionTicks } from "./format";

/**
 * Une lecture en cours : qui, sur quoi, où en est-on, comment le média
 * arrive — et la main pour intervenir. La barre de progression avance entre
 * deux instantanés (position extrapolée par la page, à la seconde).
 *
 * Chaque appui se voit jusqu'au bout : le bouton travaille (anneau), la ligne
 * d'état dit ce qui est demandé puis ce qui est fait (`CommandStatus`), et
 * une lecture arrêtée quitte la grille en s'effaçant.
 */

export interface SessionCardActions {
  onPlaystate: (session: AdminSessionDto, command: "Pause" | "Unpause" | "Stop") => void;
  onMessage: (session: AdminSessionDto) => void;
}

export const SessionCard = memo(function SessionCard({
  session,
  now,
  clockOffsetMs,
  actions,
  feedback,
}: {
  session: AdminSessionDto;
  now: number;
  clockOffsetMs: number;
  actions: SessionCardActions;
  feedback: Feedback | undefined;
}) {
  const { t } = useTranslation("sessions");
  const client = useJellyfinClient();
  const reduced = useReducedMotion();
  const item = session.nowPlaying;
  if (!item) return null;

  const position = livePositionTicks(session.positionTicks, session.positionAt, session.isPaused, now, clockOffsetMs, item.runTimeTicks);
  const fraction = item.runTimeTicks ? Math.min(1, position / item.runTimeTicks) : 0;
  const title = item.seriesName ?? item.name;
  const subtitle = item.seriesName
    ? joinParts([
        item.seasonNumber !== undefined && item.episodeNumber !== undefined
          ? t("episodeCode", { season: item.seasonNumber, episode: item.episodeNumber })
          : null,
        item.name,
      ])
    : item.productionYear !== undefined ? String(item.productionYear) : "";
  const poster = client.getImageUrl(item.imageItemId, "Primary", { width: 160, quality: 80, tag: item.imageTag });
  const device = session.deviceName || session.client;

  return (
    <motion.article
      aria-label={`${session.userName} — ${title}`}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: easeOut } }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
      className="flex flex-col gap-4 rounded-xl border border-line-subtle bg-fill-faint p-4 sm:flex-row"
    >
      <Poster src={poster} width={80} height={120} className="h-[120px] w-20 shrink-0 rounded-lg bg-fill-soft" />
      <div className="min-w-0 flex-1 space-y-3">
        <header className="min-w-0">
          <h3 className="truncate text-base font-semibold text-content-primary" title={title}>{title}</h3>
          {subtitle && <p className="truncate text-sm text-content-tertiary" title={subtitle}>{subtitle}</p>}
        </header>

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-content-secondary">
          <LeaderboardAvatar userId={session.userId} name={session.userName} hasAvatar={session.userImageTag !== null} size={24} />
          <span className="font-medium text-content-primary">{session.userName}</span>
          <span className="truncate text-content-tertiary">{joinParts([session.client, session.deviceName])}</span>
          {session.viaTentacle && (
            <span
              className="inline-flex h-6 items-center gap-1 rounded-full bg-[var(--brand-soft)] px-2 text-[11px] font-semibold tracking-wide text-content-primary"
              title={t("viaTentacleHint")}
            >
              <Radio size={12} aria-hidden />
              {t("viaTentacle")}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(fraction * 100)}
            aria-label={title}
            className="h-1.5 overflow-hidden rounded-full bg-fill-soft"
          >
            {/* `scaleX` et non `width` : la barre avance chaque seconde, une
                transformation ne repeint rien. */}
            <div className="h-full origin-left rounded-full bg-brand" style={{ transform: `scaleX(${fraction})` }} />
          </div>
          <div className="flex items-center justify-between text-xs tabular-nums text-content-tertiary">
            <CommandStatus isPaused={session.isPaused} feedback={feedback} />
            <span>
              {formatClock(position)}
              {item.runTimeTicks ? ` / ${formatClock(item.runTimeTicks)}` : ""}
            </span>
          </div>
        </div>

        <PlaybackDetails session={session} />

        {session.supportsRemoteControl ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3">
            <ActionPill
              icon={session.isPaused ? Play : Pause}
              label={session.isPaused ? t("resume") : t("pause")}
              errorLabel={t("failedShort")}
              status={buttonStatus(feedback, ["Pause", "Unpause"])}
              onClick={() => actions.onPlaystate(session, session.isPaused ? "Unpause" : "Pause")}
            />
            <ActionPill
              tone="brand"
              icon={MessageSquare}
              label={t("message")}
              doneLabel={t("sentShort")}
              errorLabel={t("failedShort")}
              status={buttonStatus(feedback, ["message"])}
              onClick={() => actions.onMessage(session)}
            />
            <ConfirmButton
              className="ml-auto"
              label={t("stop")}
              busyLabel={t("stopping")}
              title={t("stopConfirm")}
              body={t("stopConfirmBody", { name: session.userName, device })}
              confirmLabel={t("confirmStop")}
              cancelLabel={t("cancel")}
              status={buttonStatus(feedback, ["Stop"])}
              onConfirm={() => actions.onPlaystate(session, "Stop")}
            />
          </div>
        ) : (
          <p className="flex items-center gap-1.5 border-t border-line-subtle pt-3 text-xs text-content-tertiary">
            <Lock size={12} aria-hidden />
            {t("noRemote")}
          </p>
        )}
      </div>
    </motion.article>
  );
});
