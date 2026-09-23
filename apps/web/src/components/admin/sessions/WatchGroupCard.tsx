import { memo } from "react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import { Crown, MessageSquare, Users } from "lucide-react";
import type { AdminSessionDto, AdminWatchGroupDto } from "@tentacle-tv/shared";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { easeOut } from "../../../theme/motion";
import { LeaderboardAvatar } from "../../easterEggs/LeaderboardAvatar";
import { ActionPill } from "./ActionPill";
import { CommandStatus } from "./CommandStatus";
import { ConfirmButton } from "./ConfirmButton";
import { buttonStatus, type Feedback } from "./commandFeedback";
import { DeliveryChip } from "./DeliveryChip";
import { deliveryOf } from "./delivery";
import { formatClock, joinParts, livePositionTicks } from "./format";
import { Poster } from "./Poster";
import { SessionAppLabel } from "./SessionAppLabel";

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
  feedback,
  onMessage,
  onStop,
}: {
  group: AdminWatchGroupDto;
  sessionsById: ReadonlyMap<string, AdminSessionDto>;
  now: number;
  clockOffsetMs: number;
  feedback: Feedback | undefined;
  onMessage: (group: AdminWatchGroupDto) => void;
  onStop: (group: AdminWatchGroupDto) => void;
}) {
  const { t } = useTranslation("sessions");
  const client = useJellyfinClient();
  const reduced = useReducedMotion();
  // Ce que regarde la salle, lu sur la session d'un membre qui le lit.
  const item = group.members
    .map((m) => (m.sessionId ? sessionsById.get(m.sessionId)?.nowPlaying : undefined))
    .find((n) => n != null);
  const position = livePositionTicks(group.positionTicks, group.positionAt, group.isPaused, now, clockOffsetMs, item?.runTimeTicks);
  const title = item ? item.seriesName ?? item.name : "—";
  const subtitle = item?.seriesName ? item.name : undefined;

  return (
    <motion.article
      aria-label={`${t("sectionGroups")} — ${title}`}
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: easeOut } }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, transition: { duration: 0.16 } }}
      className="space-y-4 rounded-xl border border-line-subtle bg-fill-faint p-4"
    >
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
            <CommandStatus isPaused={group.isPaused} feedback={feedback} />
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
                  {joinParts([status, !session && member.inPlayback ? t("noSession") : null])}
                  {session && <>{" · "}<SessionAppLabel session={session} /></>}
                </p>
              </div>
              {session?.nowPlaying && <DeliveryChip kind={deliveryOf(session)} size="sm" />}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3">
        <ActionPill
          tone="brand"
          icon={MessageSquare}
          label={t("messageGroup")}
          doneLabel={t("sentShort")}
          errorLabel={t("failedShort")}
          status={buttonStatus(feedback, ["message"])}
          onClick={() => onMessage(group)}
        />
        <ConfirmButton
          className="ml-auto"
          label={t("stopAll")}
          busyLabel={t("stopping")}
          title={t("stopAllConfirm")}
          body={t("stopAllConfirmBody", { count: group.members.length })}
          confirmLabel={t("confirmStop")}
          cancelLabel={t("cancel")}
          status={buttonStatus(feedback, ["Stop"])}
          onConfirm={() => onStop(group)}
        />
      </div>
    </motion.article>
  );
});
