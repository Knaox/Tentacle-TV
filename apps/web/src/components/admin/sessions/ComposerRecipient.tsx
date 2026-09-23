import { useTranslation } from "react-i18next";
import type { AdminSessionDto, AdminWatchGroupDto } from "@tentacle-tv/shared";
import { LeaderboardAvatar } from "../../easterEggs/LeaderboardAvatar";
import { joinParts } from "./format";

/**
 * Le destinataire d'un message, sous le titre de la rédaction : l'avatar et
 * l'appareil d'une session, ou les visages d'une salle — on ne doit jamais
 * se demander à qui l'on écrit.
 */

const STACK = 4;

export function SessionRecipient({ session }: { session: AdminSessionDto }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <LeaderboardAvatar userId={session.userId} name={session.userName} hasAvatar={session.userImageTag !== null} size={22} />
      <span className="truncate">{joinParts([session.client, session.deviceName])}</span>
    </span>
  );
}

export function GroupRecipient({ group }: { group: AdminWatchGroupDto }) {
  const { t } = useTranslation("sessions");
  const shown = group.members.slice(0, STACK);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex shrink-0 -space-x-1.5">
        {shown.map((member) => (
          <span key={member.userId} className="rounded-full ring-2 ring-[color:var(--surface-modal)]">
            <LeaderboardAvatar userId={member.userId} name={member.userName} hasAvatar={member.hasAvatar} size={22} />
          </span>
        ))}
      </span>
      <span className="truncate">
        {joinParts([t("groupOf", { count: group.members.length }), group.members.map((m) => m.userName).join(", ")])}
      </span>
    </span>
  );
}
