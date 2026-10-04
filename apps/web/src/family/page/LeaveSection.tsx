import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";
import { useLeaveFamily } from "@tentacle-tv/api-client";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../contexts/ToastContext";
import { useFamilyText } from "../useFamilyText";

/**
 * Un MEMBRE quitte la famille, à tout moment, confirmé : son profil quitte
 * les TV de la famille, et les profils de la famille quittent les siennes.
 * Le propriétaire ne quitte pas — il dissout (`DissolveSection`).
 */
export function LeaveSection({ familyId, ownerName }: { familyId: string; ownerName: string }) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  const toast = useToast();
  const leave = useLeaveFamily();
  const [open, setOpen] = useState(false);

  const confirm = () =>
    leave.mutate(familyId, {
      onSuccess: () => setOpen(false),
      onError: (failure) => {
        setOpen(false);
        toast.show("error", errorText(failure));
      },
    });

  return (
    <>
      <SettingsSection title={t("danger.title")}>
        <SettingsRow
          label={t("shared.leave")}
          description={t("shared.leaveHint")}
          destructive
          last
          chevron
          onClick={() => setOpen(true)}
        />
      </SettingsSection>
      {open && (
        <ConfirmDialog
          open
          danger
          title={t("confirm.leaveTitle", { owner: ownerName })}
          message={t("confirm.leaveBody")}
          confirmLabel={t("confirm.leaveAction")}
          cancelLabel={t("cancel")}
          pending={leave.isPending}
          onConfirm={confirm}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
