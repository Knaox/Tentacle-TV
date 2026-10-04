import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserPlus, Users } from "lucide-react";
import { SettingsSection } from "@tentacle-tv/ui";
import {
  useCancelFamilyInvitation,
  useDeleteFamilyGuest,
  useRemoveFamilyMember,
  useSetFamilyGuestRights,
  useSetFamilyMemberRights,
  useUserId,
} from "@tentacle-tv/api-client";
import {
  FAMILY_LIMITS,
  familyActions,
  familyCounts,
  isOwnProfile,
  profileActions,
  sameUserId,
  type FamilyErrorCode,
  type FamilyOverviewDto,
  type FamilyProfileDto,
  type OutgoingInvitationDto,
} from "@tentacle-tv/shared";
import { useToast } from "../../contexts/ToastContext";
import { useFamilyAvailability } from "../useFamilyAvailability";
import { useFamilyText } from "../useFamilyText";
import { FamilyConfirm, type FamilyPending } from "./FamilyConfirm";
import { GuestDialog } from "./GuestDialog";
import { InviteDialog } from "./InviteDialog";
import { PendingInvitations } from "./PendingInvitations";
import { GuestPinDialog } from "./PinEditors";
import { ProfileRow } from "./ProfileRow";
import { BRAND_BUTTON, BRAND_BUTTON_STYLE, SECONDARY_BUTTON } from "./familyUi";

/** Les refus que la page dit déjà dans ses encarts (SettingsFamily), et ceux
 *  d'un membre : il n'invite pas, et sans le droit, il n'a pas de bouton. */
const UNSPOKEN = new Set<FamilyErrorCode>([
  "family.personal_session_required", "family.disabled", "family.guests_disabled", "family.not_owner",
  "family.guest_right_required",
]);

/**
 * LA famille, partagée : le propriétaire en tête, puis les membres, puis les
 * invités — la même liste pour le propriétaire et pour chaque membre. Le
 * propriétaire invite, annule, retire, règle les droits ; un membre voit tout
 * mais ne gère que ses invités (s'il a le droit d'en créer). Sans famille, un
 * appel à la créer : elle naît au premier invité ou à la première invitation.
 * Chaque geste vient de `familyActions` / `profileActions` (shared) ; le
 * serveur revérifie tout.
 */
export function FamilySection({ overview }: { overview: FamilyOverviewDto }) {
  const { t } = useTranslation(["familyWeb", "family"]);
  const { errorText, codeText } = useFamilyText();
  const toast = useToast();
  const viewerId = useUserId();
  // « Peut demander » n'existe que si le serveur l'annonce (/api/config).
  const guestRequests = useFamilyAvailability().capability?.guestRequests;
  const capability = useMemo(() => ({ guestRequests }), [guestRequests]);
  const removeMember = useRemoveFamilyMember();
  const deleteGuest = useDeleteFamilyGuest();
  const cancelInvite = useCancelFamilyInvitation();
  const setRights = useSetFamilyMemberRights();
  const setGuestRights = useSetFamilyGuestRights();
  const [confirming, setConfirming] = useState<FamilyPending | null>(null);
  const [dialog, setDialog] = useState<"invite" | "guest" | null>(null);
  const [pinGuest, setPinGuest] = useState<FamilyProfileDto | null>(null);

  const family = overview.family;
  const personal = overview.account.personalSession;
  const counts = useMemo(() => familyCounts(family), [family]);
  const actions = useMemo(() => familyActions(overview), [overview]);
  const owner = family?.role !== "member";

  const onRemove = useCallback((profile: FamilyProfileDto) => setConfirming({ kind: "profile", profile }), []);
  const onCancelInvite = useCallback((invitation: OutgoingInvitationDto) => setConfirming({ kind: "cancelInvite", invitation }), []);
  const fail = useCallback((error: unknown) => toast.show("error", errorText(error)), [toast, errorText]);
  const { mutate: mutateRights } = setRights;
  const { mutate: mutateGuestRights } = setGuestRights;
  // Un membre : « peut créer des invités » ; un invité : « peut demander ».
  const onRightChange = useCallback(
    (profile: FamilyProfileDto, next: boolean) => {
      const done = { onSuccess: () => toast.show("success", t("familyWeb:rights.saved")), onError: fail };
      if (profile.kind === "guest") mutateGuestRights({ userId: profile.userId, rights: { requestTitles: next } }, done);
      else mutateRights({ userId: profile.userId, rights: { createGuests: next } }, done);
    },
    [mutateRights, mutateGuestRights, toast, t, fail],
  );

  const confirm = () => {
    if (!confirming) return;
    const done = { onSuccess: () => setConfirming(null), onError: (e: unknown) => { setConfirming(null); fail(e); } };
    if (confirming.kind === "cancelInvite") cancelInvite.mutate(confirming.invitation.id, done);
    else if (confirming.profile.kind === "guest") deleteGuest.mutate(confirming.profile.userId, done);
    else removeMember.mutate(confirming.profile.userId, done);
  };

  // L'obstacle le plus parlant — sauf ceux que la page dit déjà ailleurs.
  const blocked = (owner ? actions.invite : null) ?? actions.addGuest;
  const blockedText = blocked && !UNSPOKEN.has(blocked) ? codeText(blocked) : null;
  const showInvite = personal && owner;
  const showAddGuest = personal && (owner || actions.addGuest !== "family.guest_right_required");

  const buttons = (showInvite || showAddGuest) && (
    <div className="flex flex-wrap gap-2">
      {showInvite && (
        <button type="button" onClick={() => setDialog("invite")} disabled={actions.invite !== null} className={BRAND_BUTTON} style={BRAND_BUTTON_STYLE}>
          <UserPlus size={16} aria-hidden="true" />
          {t("familyWeb:owned.invite")}
        </button>
      )}
      {showAddGuest && (
        <button type="button" onClick={() => setDialog("guest")} disabled={actions.addGuest !== null} className={SECONDARY_BUTTON}>
          {t("familyWeb:owned.addGuest")}
        </button>
      )}
    </div>
  );

  const title = !family || owner ? t("familyWeb:shared.titleOwner") : t("familyWeb:shared.titleMember", { owner: family.owner.name });
  const caption = family && (
    <>
      {!owner && <>{t("familyWeb:shared.memberNotice", { owner: family.owner.name })} </>}
      {t("familyWeb:owned.capacity", { count: counts.profiles, max: FAMILY_LIMITS.profiles })}
      {" · "}
      {t("familyWeb:owned.guests", { count: counts.guests, max: FAMILY_LIMITS.guests })}
    </>
  );

  return (
    <>
      <SettingsSection title={title} caption={caption || undefined}>
        {family ? (
          <ul>
            {family.profiles.map((profile, index) => (
              <ProfileRow
                key={profile.userId}
                profile={profile}
                last={index === family.profiles.length - 1 && !buttons}
                isSelf={isOwnProfile(profile, viewerId)}
                actions={profileActions(overview, profile, viewerId, capability)}
                showCreator={!!profile.createdBy && !sameUserId(profile.createdBy, family.owner.userId)}
                ownerName={family.owner.name}
                rightPending={setRights.isPending || setGuestRights.isPending}
                onRemove={onRemove}
                onGuestPin={setPinGuest}
                onRightChange={onRightChange}
              />
            ))}
            {buttons && <li className="px-4 py-3">{buttons}</li>}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center">
            <span aria-hidden="true" className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-cta-brand-fg" style={BRAND_BUTTON_STYLE}>
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
      {blockedText && personal && <p className="-mt-4 mb-6 px-1 text-xs text-content-tertiary">{blockedText}</p>}

      {family && owner && family.pendingInvitations.length > 0 && (
        <PendingInvitations invitations={family.pendingInvitations} canManage={personal} onCancel={onCancelInvite} />
      )}

      <FamilyConfirm
        pending={confirming}
        busy={removeMember.isPending || deleteGuest.isPending || cancelInvite.isPending}
        onConfirm={confirm}
        onCancel={() => setConfirming(null)}
      />
      {dialog === "invite" && <InviteDialog onClose={() => setDialog(null)} />}
      {dialog === "guest" && <GuestDialog onClose={() => setDialog(null)} />}
      {pinGuest && <GuestPinDialog guest={pinGuest} onClose={() => setPinGuest(null)} />}
    </>
  );
}
