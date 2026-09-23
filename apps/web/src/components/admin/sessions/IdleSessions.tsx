import { memo } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Radio } from "lucide-react";
import type { AdminSessionDto } from "@tentacle-tv/shared";
import { LeaderboardAvatar } from "../../easterEggs/LeaderboardAvatar";
import { ActionPill } from "./ActionPill";
import { buttonStatus, type Feedback } from "./commandFeedback";
import { joinParts } from "./format";

/**
 * Les appareils connectés qui ne lisent rien : une ligne chacun, compacte —
 * on les voit, on peut leur écrire, ils ne volent pas la place des lectures.
 */

function relativeTime(iso: string, now: number, locale: string): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(seconds) < 60) return format.format(Math.min(seconds, 0), "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  return format.format(Math.round(minutes / 60), "hour");
}

export const IdleSessions = memo(function IdleSessions({
  sessions,
  now,
  feedback,
  onMessage,
}: {
  sessions: AdminSessionDto[];
  now: number;
  feedback: ReadonlyMap<string, Feedback>;
  onMessage: (session: AdminSessionDto) => void;
}) {
  const { t, i18n } = useTranslation("sessions");
  return (
    <ul className="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line-subtle bg-fill-faint">
      {sessions.map((session) => (
        <li key={session.id} className="flex items-center gap-3 px-4 py-2">
          <LeaderboardAvatar userId={session.userId} name={session.userName} hasAvatar={session.userImageTag !== null} size={32} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm font-medium text-content-primary">
              <span className="truncate">{session.userName}</span>
              {session.viaTentacle && (
                <Radio size={12} aria-label={t("viaTentacle")} className="shrink-0 text-brand" />
              )}
            </p>
            <p className="truncate text-xs text-content-tertiary">
              {joinParts([session.client, session.deviceName, t("lastActive", { time: relativeTime(session.lastActivity, now, i18n.language) })])}
            </p>
          </div>
          {session.supportsRemoteControl && (
            <ActionPill
              iconOnly
              icon={MessageSquare}
              label={`${t("message")} — ${session.userName}`}
              doneLabel={t("sentShort")}
              errorLabel={t("failedShort")}
              status={buttonStatus(feedback.get(session.id), ["message"])}
              onClick={() => onMessage(session)}
            />
          )}
        </li>
      ))}
    </ul>
  );
});
