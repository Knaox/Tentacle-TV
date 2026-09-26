import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../contexts/ToastContext";
import {
  useAdminDownloadRights,
  useUpdateAdminDownloadRights,
  type RightsPatch,
} from "../../../hooks/useAdminDownloadRights";
import { ToggleSwitch } from "../../settings/ToggleSwitch";
import { SHEET_LIST, SheetSkeleton, UserSheetSection } from "./UserSheetSection";
import { sameUserId } from "./userListModel";

/**
 * Les droits de téléchargement du compte, écrits dans Jellyfin — la même
 * lecture, et le même cache, que la page Téléchargements : un interrupteur
 * basculé ici s'y voit aussi. Le périmètre par bibliothèque reste géré dans
 * Jellyfin, la fiche ne fait que le rappeler.
 */
export function UserRightsSection({ userId }: { userId: string }) {
  const { t } = useTranslation("admin");
  const { show } = useToast();
  const { data, isLoading } = useAdminDownloadRights();
  const update = useUpdateAdminDownloadRights();
  const [pending, setPending] = useState<keyof RightsPatch | null>(null);
  const rights = data?.find((entry) => sameUserId(entry.id, userId));

  const toggle = (field: keyof RightsPatch, value: boolean) => {
    if (!rights) return;
    setPending(field);
    update.mutateAsync({ userId: rights.id, patch: { [field]: value } }).then(
      () => show("success", t("downloadsSaved")),
      () => show("error", t("downloadsSaveError")),
    ).finally(() => setPending((current) => (current === field ? null : current)));
  };

  return (
    <UserSheetSection title={t("downloadsTitle")}>
      {isLoading ? (
        <SheetSkeleton />
      ) : !rights ? (
        <p className="text-sm text-content-tertiary">{t("userRightsError")}</p>
      ) : (
        <div className={SHEET_LIST}>
          <RightRow
            label={t("rightDownload")}
            hint={t("userRightDownloadHint")}
            checked={rights.enableContentDownloading}
            busy={pending === "enableContentDownloading"}
            onChange={(value) => toggle("enableContentDownloading", value)}
          />
          <RightRow
            label={t("rightLight")}
            hint={t("userRightLightHint")}
            checked={rights.enableMediaConversion}
            busy={pending === "enableMediaConversion"}
            onChange={(value) => toggle("enableMediaConversion", value)}
          />
          <p className="px-4 py-2.5 text-xs text-content-tertiary">
            {rights.enableAllFolders
              ? t("downloadsAllLibraries")
              : t("downloadsSomeLibraries", { count: rights.enabledFoldersCount })}
          </p>
        </div>
      )}
    </UserSheetSection>
  );
}

function RightRow({ label, hint, checked, busy, onChange }: {
  label: string;
  hint: string;
  checked: boolean;
  busy: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-content-primary">{label}</span>
        <span className="mt-0.5 block text-xs text-content-tertiary">{hint}</span>
      </span>
      <ToggleSwitch checked={checked} onChange={onChange} label={label} disabled={busy} />
    </label>
  );
}
