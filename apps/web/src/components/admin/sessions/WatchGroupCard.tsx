import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Crown, MessageSquare, Pause, Play, Square, Users } from "lucide-react";
import type { AdminSessionDto, AdminWatchGroupDto } from "@tentacle-tv/shared";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { LeaderboardAvatar } from "../../easterEggs/LeaderboardAvatar";
import { cls } from "../../../pages/adminUtils";
import { ConfirmButton } from "./ConfirmButton";
import { DeliveryChip } from "./DeliveryChip";
import { deliveryOf } from "./delivery";
import { formatClock, joinParts, livePositionTicks } from "./format";
import { Poster } from "./Poster";

/**
 * Une salle Watch Together : ce qu'elle regarde, où elle en est, chacun de
 * ses membres — statut, écart au rythme de la salle, et la façon dont le
 * média lui arrive (qui transcode quoi : la salle lit UN fichier, c'est
 * l'appareil de chacun qui fait la différence). Un message ou un arrêt part à
 * TOUS.
 */

export const WatchGroupCard = memo(function WatchGroupCard({
  group,
  sessionsById,
  now,
  clockOffsetMs,
  pending,
  onMessage,
  onStop,
}: {
  group: AdminWatchGroupDto;
  sessionsById: ReadonlyMap<string, AdminSessionDto>;
  now: number;
  clockOffsetMs: number;
  pending: boolean;
  onMessage: (group: AdminWatchGroupDto) => void;
  onStop: (group: AdminWatchGroupDto) => void;
}) {
  const { t } = useTranslation("sessions");
  const client = useJellyfinClient();
  // Ce que regarde la salle, lu sur la session d'un membre qui le lit.
  const item = group.members
    .map((m) => (m.sessionId ? sessionsById.get(m.sessionId)?.nowPlaying : undefined))
    .find((n) => n != null);
  const position = livePositionTicks(group.positionTicks, group.positionAt, group.isPaused, now, clockOffsetMs, item?.runTimeTicks);
  const title = item ? item.seriesName ?? item.name : "—";
  const subtitle = item?.seriesName ? item.name : undefined;

  return (
    <article aria-label={`${t("sectionGroups")} — ${title}`} className="space-y-4 rounded-xl border border-line-subtle bg-fill-faint p-4">
      <header className="flex items-start gap-4">
        {item && (
          <Poster
            src={client.getImageUrl(item.imageItemId, "Primary", { width: 120, quality: 80, tag: item.imageTag })}
            width={60}
            height={90}
            className="h-[90px] w-[60px] shrink-0 rounded-md bg-fill-soft"
          />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="truncate text-base font-semibold text-content-primary" title={title}>{title}</h3>
          {subtitle && <p className="truncate text-sm text-content-tertiary">{subtitle}</p>}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-content-tertiary">
            <span className="inline-flex items-center gap-1"><Users size={12} aria-hidden />{t("groupOf", { count: group.members.length })}</span>
            <span className="inline-flex items-center gap-1">
              {group.isPaused ? <Pause size={12} aria-hidden /> : <Play size={12} aria-hidden />}
              {group.isPaused ? t("paused") : t("playing")}
            </span>
            <span>{formatClock(position)}{item?.runTimeTicks ? ` / ${formatClock(item.runTimeTicks)}` : ""}</span>
          </p>
        </div>
      </header>

      <ul className="space-y-2">
        {group.members.map((member) => {
          const session = member.sessionId ? sessionsById.get(member.sessionId) : undefined;
          const status = !member.inPlayback
            ? t("notInPlayback")
            : member.buffering
              ? t("buffering")
              : member.driftMs !== null && Math.abs(member.driftMs) >= 250
                ? t("drift", { ms: Math.round(member.driftMs) })
                : t("inSync");
          return (
            <li key={member.userId} className="flex items-center gap-3">
              <LeaderboardAvatar userId={member.userId} name={member.userName} hasAvatar={member.hasAvatar} size={28} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-content-primary">
                  <span className="truncate">{member.userName}</span>
                  {member.isHost && <Crown size={12} aria-label={t("host")} className="shrink-0 text-brand" />}
                </p>
                <p className="truncate text-xs text-content-tertiary">
                  {joinParts([
                    status,
                    !session && member.inPlayback ? t("noSession") : null,
                    session ? joinParts([session.client, session.deviceName]) : null,
                  ])}
                </p>
              </div>
              {session?.nowPlaying && <DeliveryChip kind={deliveryOf(session)} size="sm" />}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${cls.bbrand} px-4`} onClick={() => onMessage(group)}>
          <MessageSquare size={16} aria-hidden />
          {t("messageGroup")}
        </button>
        <ConfirmButton
          label={t("stopAll")}
          icon={<Square size={14} aria-hidden />}
          prompt={t("stopAllConfirm")}
          confirmLabel={t("confirmStop")}
          cancelLabel={t("cancel")}
          pending={pending}
          onConfirm={() => onStop(group)}
        />
      </div>
    </article>
  );
});
