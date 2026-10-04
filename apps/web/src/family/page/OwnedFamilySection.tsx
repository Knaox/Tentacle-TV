import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus, Users } from "lucide-react";
import { SettingsSection } from "@tentacle-tv/ui";
import { useCancelFamilyInvitation, useDeleteFamilyGuest, useRemoveFamilyMember } from "@tentacle-tv/api-client";
import type { FamilyOverviewDto, FamilyProfileDto, OutgoingInvitationDto } from "@tentacle-tv/shared";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../contexts/ToastContext";
import { FAMILY_LIMITS, ownedCounts, ownerActions } from "../familyModel";
import { useFamilyText } from "../useFamilyText";
import { GuestDialog } from "./GuestDialog";
import { InviteDialog } from "./InviteDialog";
import { PendingInvitations } from "./PendingInvitations";
import { GuestPinDialog } from "./PinEditors";
import { ProfileRow } from "./ProfileRow";
import { BRAND_BUTTON, BRAND_BUTTON_STYLE, SECONDARY_BUTTON } from "./familyUi";

type Pending =
  | { kind: "remove"; profile: FamilyProfileDto }
  | { kind: "deleteGuest"; profile: FamilyProfileDto }
  | { kind: "cancelInvite"; invitation: OutgoingInvitationDto };

/**
 * « Ma famille » : les profils (le propriétaire en tête, puis les membres,
 * puis les invités), les invitations en attente, et les deux gestes qui la
 * font grandir — inviter un compte, créer un invité. Sans famille, un appel
 * à la créer : elle naît au premier invité ou à la première invitation.
 * Tout geste qui retire passe par une confirmation qui dit ce qu'il coûte.
 */
export function OwnedFamilySection({ overview }: { overview: FamilyOverviewDto }) {
  const { t } = useTranslation(["familyWeb", "family"]);
  const { errorText, codeText } = useFamilyText();
  const toast = useToast();
  const removeMember = useRemoveFamilyMember();
  const deleteGuest = useDeleteFamilyGuest();
  const cancelInvite = useCancelFamilyInvitation();
  const [confirming, setConfirming] = useState<Pending | null>(null);
  const [dialog, setDialog] = useState<"invite" | "guest" | null>(null);
  const [pinGuest, setPinGuest] = useState<FamilyProfileDto | null>(null);

  const owned = overview.owned;
  const manage = overview.account.personalSession;
  const counts = useMemo(() => ownedCounts(owned), [owned]);
  const actions = useMemo(() => ownerActions(overview), [overview]);
  const pending = removeMember.isPending || deleteGuest.isPending || cancelInvite.isPending;

  const onRemove = useCallback((profile: FamilyProfileDto) => setConfirming({ kind: "remove", profile }), []);
  const onDeleteGuest = useCallback((profile: FamilyProfileDto) => setConfirming({ kind: "deleteGuest", profile }), []);
  const onCancelInvite = useCallback((invitation: OutgoingInvitationDto) => setConfirming({ kind: "cancelInvite", invitation }), []);

  const confirm = () => {
    if (!confirming) return;
    const done = { onSuccess: () => setConfirming(null), onError: (e: unknown) => { setConfirming(null); toast.show("error", errorText(e)); } };
    if (confirming.kind === "remove") removeMember.mutate(confirming.profile.userId, done);
    else if (confirming.kind === "deleteGuest") deleteGuest.mutate(confirming.profile.userId, done);
    else cancelInvite.mutate(confirming.invitation.id, done);
  };

  const copy = confirmCopy(confirming, t);
  // L'obstacle le plus parlant : celui de l'invitation s'il y en a un, sinon celui de l'invité.
  const blocked = actions.invite ?? actions.addGuest;
  const blockedText = blocked && blocked !== "family.personal_session_required" ? codeText(blocked) : null;

  const buttons = manage && (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setDialog("invite")} disabled={actions.invite !== null} className={BRAND_BUTTON} style={BRAND_BUTTON_STYLE}>
        <UserPlus size={16} aria-hidden="true" />
        {t("familyWeb:owned.invite")}
      </button>
      <button type="button" onClick={() => setDialog("guest")} disabled={actions.addGuest !== null} className={SECONDARY_BUTTON}>
        {t("familyWeb:owned.addGuest")}
      </button>
    </div>
  );

  return (
    <>
      <SettingsSection
        title={t("familyWeb:owned.title")}
        caption={owned ? (
          <>
            {t("familyWeb:owned.capacity", { count: counts.profiles, max: FAMILY_LIMITS.profiles })}
            {" · "}
            {t("familyWeb:owned.guests", { count: counts.guests, max: FAMILY_LIMITS.guests })}
          </>
        ) : undefined}
      >
        {owned ? (
          <ul>
            {owned.profiles.map((profile, index) => (
              <ProfileRow
                key={profile.userId}
                profile={profile}
                last={index === owned.profiles.length - 1 && !buttons}
                canManage={manage}
                onRemove={onRemove}
                onDeleteGuest={onDeleteGuest}
                onGuestPin={setPinGuest}
              />
            ))}
            {buttons && <li className="px-4 py-3">{buttons}</li>}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-cta-brand-fg"
              style={BRAND_BUTTON_STYLE}
            >
              <Users size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-content-primary">{t("familyWeb:owned.emptyTitle")}</p>
              <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{t("familyWeb:owned.emptyBody")}</p>
              {buttons && <div className="mt-3">{buttons}</div>}
            </div>
          </div>
        )}
      </SettingsSection>
      {blockedText && manage && <p className="-mt-4 mb-6 px-1 text-xs text-content-tertiary">{blockedText}</p>}

      {owned && owned.pendingInvitations.length > 0 && (
        <PendingInvitations invitations={owned.pendingInvitations} canManage={manage} onCancel={onCancelInvite} />
      )}

      {copy && (
        <ConfirmDialog
          open
          danger
          title={copy.title}
          message={copy.message}
          confirmLabel={copy.action}
          cancelLabel={t("familyWeb:cancel")}
          pending={pending}
          onConfirm={confirm}
          onCancel={() => setConfirming(null)}
        />
      )}
      {dialog === "invite" && <InviteDialog onClose={() => setDialog(null)} />}
      {dialog === "guest" && <GuestDialog onClose={() => setDialog(null)} />}
      {pinGuest && <GuestPinDialog guest={pinGuest} onClose={() => setPinGuest(null)} />}
    </>
  );
}

function confirmCopy(pending: Pending | null, t: (key: string, values?: Record<string, string>) => string) {
  if (!pending) return null;
  if (pending.kind === "remove") {
    const name = pending.profile.name;
    return { title: t("familyWeb:confirm.removeTitle", { name }), message: t("familyWeb:confirm.removeBody"), action: t("familyWeb:confirm.removeAction") };
  }
  if (pending.kind === "deleteGuest") {
    const name = pending.profile.name;
    return { title: t("familyWeb:confirm.deleteGuestTitle", { name }), message: t("familyWeb:confirm.deleteGuestBody"), action: t("familyWeb:confirm.deleteGuestAction") };
  }
  const name = pending.invitation.inviteeName;
  return { title: t("familyWeb:confirm.cancelInviteTitle", { name }), message: t("familyWeb:confirm.cancelInviteBody"), action: t("familyWeb:confirm.cancelInviteAction") };
}
