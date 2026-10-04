import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { SettingsSection } from "@tentacle-tv/ui";
import type { OutgoingInvitationDto } from "@tentacle-tv/shared";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { useFamilyText } from "../useFamilyText";
import { SMALL_BUTTON } from "./familyUi";

interface PendingInvitationsProps {
  invitations: OutgoingInvitationDto[];
  canManage: boolean;
  onCancel: (invitation: OutgoingInvitationDto) => void;
}

/** Les invitations envoyées qui attendent leur réponse (sept jours au plus) —
 *  chacune réserve sa place dans la famille, et s'annule. */
export const PendingInvitations = memo(function PendingInvitations({ invitations, canManage, onCancel }: PendingInvitationsProps) {
  const { t } = useTranslation("familyWeb");
  const { formatDate } = useFamilyText();
  return (
    <SettingsSection title={t("owned.pendingTitle")}>
      <ul>
        {invitations.map((invitation, index) => (
          <li
            key={invitation.id}
            className={`flex items-center gap-3 px-4 py-3 ${index === invitations.length - 1 ? "" : "border-b border-line-subtle"}`}
          >
            <div className="relative">
              <UserAvatar userId={invitation.inviteeUserId} name={invitation.inviteeName} hasAvatar size={36} className="opacity-70" />
              <Clock size={14} aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface-1 text-content-tertiary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-content-primary">{invitation.inviteeName}</p>
              <p className="mt-0.5 text-xs text-content-tertiary">
                {t("owned.pendingRow", { sent: formatDate(invitation.createdAt), expires: formatDate(invitation.expiresAt) })}
              </p>
            </div>
            {canManage && (
              <button type="button" onClick={() => onCancel(invitation)} className={SMALL_BUTTON}
                aria-label={`${t("owned.cancelInvite")} — ${invitation.inviteeName}`}>
                {t("owned.cancelInvite")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
});
