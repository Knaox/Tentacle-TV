import { memo } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Pause, Play, Radio, Square } from "lucide-react";
import type { AdminSessionDto } from "@tentacle-tv/shared";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { LeaderboardAvatar } from "../../easterEggs/LeaderboardAvatar";
import { cls } from "../../../pages/adminUtils";
import { ConfirmButton } from "./ConfirmButton";
import { PlaybackDetails } from "./PlaybackDetails";
import { Poster } from "./Poster";
import { formatClock, joinParts, livePositionTicks } from "./format";

/**
 * Une lecture en cours : qui, sur quoi, où en est-on, comment le média
 * arrive — et la main pour intervenir. La barre de progression avance entre
 * deux instantanés (position extrapolée par la page, à la seconde).
 */

export interface SessionCardActions {
  onPlaystate: (session: AdminSessionDto, command: "Pause" | "Unpause" | "Stop") => void;
  onMessage: (session: AdminSessionDto) => void;
  pendingId: string | null;
}

export const SessionCard = memo(function SessionCard({
  session,
  now,
  clockOffsetMs,
  actions,
}: {
  session: AdminSessionDto;
  now: number;
  clockOffsetMs: number;
  actions: SessionCardActions;
}) {
  const { t } = useTranslation("sessions");
  const client = useJellyfinClient();
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
  const pending = actions.pendingId === session.id;

  return (
    <article
      aria-label={`${session.userName} — ${title}`}
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
            <span className={`${cls.chip} bg-[var(--brand-soft)] text-content-primary`} title={t("viaTentacleHint")}>
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
            <span className="inline-flex items-center gap-1">
              {session.isPaused ? <Pause size={12} aria-hidden /> : <Play size={12} aria-hidden />}
              {session.isPaused ? t("paused") : t("playing")}
            </span>
            <span>
              {formatClock(position)}
              {item.runTimeTicks ? ` / ${formatClock(item.runTimeTicks)}` : ""}
            </span>
          </div>
        </div>

        <PlaybackDetails session={session} />

        {session.supportsRemoteControl ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              className={`${cls.bs} px-4`}
              disabled={pending}
              onClick={() => actions.onPlaystate(session, session.isPaused ? "Unpause" : "Pause")}
            >
              {session.isPaused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
              {session.isPaused ? t("resume") : t("pause")}
            </button>
            <button type="button" className={`${cls.bbrand} px-4`} onClick={() => actions.onMessage(session)}>
              <MessageSquare size={16} aria-hidden />
              {t("message")}
            </button>
            <ConfirmButton
              label={t("stop")}
              icon={<Square size={14} aria-hidden />}
              prompt={t("stopConfirm")}
              confirmLabel={t("confirmStop")}
              cancelLabel={t("cancel")}
              pending={pending}
              onConfirm={() => actions.onPlaystate(session, "Stop")}
            />
          </div>
        ) : (
          <p className="text-xs text-content-tertiary">{t("noRemote")}</p>
        )}
      </div>
    </article>
  );
});
