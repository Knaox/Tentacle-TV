import { useTranslation } from "react-i18next";
import type { FamilyProfileDto, OutgoingInvitationDto } from "@tentacle-tv/shared";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";

/** Le geste qui attend sa confirmation : retirer un membre ou supprimer un
 *  invité (selon le profil), ou annuler une invitation. */
export type FamilyPending =
  | { kind: "profile"; profile: FamilyProfileDto }
  | { kind: "cancelInvite"; invitation: OutgoingInvitationDto };

interface FamilyConfirmProps {
  pending: FamilyPending | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** La confirmation d'un geste qui retire : elle dit ce qu'il coûte — un
 *  membre garde son compte, un invité perd sa lecture. */
export function FamilyConfirm({ pending, busy, onConfirm, onCancel }: FamilyConfirmProps) {
  const { t } = useTranslation("familyWeb");
  if (!pending) return null;
  const copy =
    pending.kind === "cancelInvite"
      ? { name: pending.invitation.inviteeName, key: "cancelInvite" }
      : { name: pending.profile.name, key: pending.profile.kind === "guest" ? "deleteGuest" : "remove" };
  return (
    <ConfirmDialog
      open
      danger
      title={t(`confirm.${copy.key}Title`, { name: copy.name })}
      message={t(`confirm.${copy.key}Body`)}
      confirmLabel={t(`confirm.${copy.key}Action`)}
      cancelLabel={t("cancel")}
      pending={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
