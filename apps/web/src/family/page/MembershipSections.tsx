import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail } from "lucide-react";
import { SettingsSection } from "@tentacle-tv/ui";
import { useLeaveFamily } from "@tentacle-tv/api-client";
import type { FamilyMembershipDto, IncomingInvitationDto } from "@tentacle-tv/shared";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { useToast } from "../../contexts/ToastContext";
import { requestFamilyPoster } from "../familyPosterStore";
import { useFamilyText } from "../useFamilyText";
import { BRAND_BUTTON, BRAND_BUTTON_STYLE, SMALL_DANGER_BUTTON } from "./familyUi";

/** Les invitations reçues : « Répondre » rouvre l'AFFICHE (même remise à plus
 *  tard) — une seule façon de répondre, qui dit ce qu'accepter implique. */
export function IncomingInvitationsSection({ incoming }: { incoming: IncomingInvitationDto[] }) {
  const { t } = useTranslation("familyWeb");
  const { formatDate } = useFamilyText();
  if (incoming.length === 0) return null;
  return (
    <SettingsSection title={t("incoming.title")}>
      <ul>
        {incoming.map((invitation, index) => (
          <li
            key={invitation.id}
            className={`flex flex-wrap items-center gap-3 px-4 py-3 ${index === incoming.length - 1 ? "" : "border-b border-line-subtle"}`}
          >
            <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(var(--brand-rgb),0.14)] text-[var(--brand-light)]">
              <Mail size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-content-primary">{t("incoming.row", { owner: invitation.ownerName })}</p>
              <p className="mt-0.5 text-xs text-content-tertiary">{t("incoming.expires", { date: formatDate(invitation.expiresAt) })}</p>
            </div>
            <button type="button" onClick={() => requestFamilyPoster(invitation.id)} className={BRAND_BUTTON} style={BRAND_BUTTON_STYLE}>
              {t("incoming.open")}
            </button>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}

/** Les familles dont je suis membre : quitter, à tout moment, confirmé. */
export function MembershipsSection({ memberships, canLeave }: { memberships: FamilyMembershipDto[]; canLeave: boolean }) {
  const { t } = useTranslation("familyWeb");
  const { formatDate, errorText } = useFamilyText();
  const toast = useToast();
  const leave = useLeaveFamily();
  const [leaving, setLeaving] = useState<FamilyMembershipDto | null>(null);
  if (memberships.length === 0) return null;

  const confirm = () => {
    if (!leaving) return;
    leave.mutate(leaving.familyId, {
      onSuccess: () => setLeaving(null),
      onError: (failure) => {
        setLeaving(null);
        toast.show("error", errorText(failure));
      },
    });
  };

  return (
    <>
      <SettingsSection title={t("memberships.title")} caption={t("memberships.hint")}>
        <ul>
          {memberships.map((membership, index) => (
            <li
              key={membership.familyId}
              className={`flex items-center gap-3 px-4 py-3 ${index === memberships.length - 1 ? "" : "border-b border-line-subtle"}`}
            >
              <UserAvatar userId={membership.ownerUserId} name={membership.ownerName} hasAvatar size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content-primary">{t("memberships.row", { owner: membership.ownerName })}</p>
                <p className="mt-0.5 text-xs text-content-tertiary">{t("memberships.since", { date: formatDate(membership.since) })}</p>
              </div>
              {canLeave && (
                <button type="button" onClick={() => setLeaving(membership)} className={SMALL_DANGER_BUTTON}
                  aria-label={`${t("memberships.leave")} — ${t("memberships.row", { owner: membership.ownerName })}`}>
                  {t("memberships.leave")}
                </button>
              )}
            </li>
          ))}
        </ul>
      </SettingsSection>
      {leaving && (
        <ConfirmDialog
          open
          danger
          title={t("confirm.leaveTitle", { owner: leaving.ownerName })}
          message={t("confirm.leaveBody")}
          confirmLabel={t("confirm.leaveAction")}
          cancelLabel={t("cancel")}
          pending={leave.isPending}
          onConfirm={confirm}
          onCancel={() => setLeaving(null)}
        />
      )}
    </>
  );
}
