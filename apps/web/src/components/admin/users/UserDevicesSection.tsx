import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MonitorSmartphone } from "lucide-react";
import { useRevokePairedDevice, type PairedDevice } from "@tentacle-tv/api-client";
import { useToast } from "../../../contexts/ToastContext";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { SHEET_LIST, SheetSkeleton, UserSheetSection } from "./UserSheetSection";
import { absoluteTime, relativeTime } from "./userListModel";

interface UserDevicesSectionProps {
  /** Les appareils jumelés à CE compte — `undefined` tant que la liste n'est pas lue. */
  devices: PairedDevice[] | undefined;
  failed: boolean;
  now: number;
}

/**
 * Les téléviseurs et appareils jumelés au compte, et leur révocation. Révoquer
 * déconnecte l'appareil sur-le-champ (le serveur coupe aussi sa connexion
 * ouverte) : la confirmation le dit avant, pas après.
 */
export function UserDevicesSection({ devices, failed, now }: UserDevicesSectionProps) {
  const { t, i18n } = useTranslation(["admin", "common"]);
  const { show } = useToast();
  const revoke = useRevokePairedDevice();
  // L'appareil visé reste en mémoire pendant la fermeture du dialogue : son
  // titre ne se vide pas sous les yeux pendant le fondu.
  const [target, setTarget] = useState<PairedDevice | null>(null);
  const [confirming, setConfirming] = useState(false);
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });

  const confirmRevoke = () => {
    if (!target) return;
    revoke.mutateAsync(target.id).then(
      () => show("success", t("userDeviceRevoked")),
      () => show("error", t("userDeviceRevokeError")),
    ).finally(() => setConfirming(false));
  };

  let body;
  if (failed) body = <p className="text-sm text-content-tertiary">{t("userDevicesError")}</p>;
  else if (!devices) body = <SheetSkeleton />;
  else if (devices.length === 0) body = <p className="text-sm text-content-tertiary">{t("userNoDevices")}</p>;
  else {
    body = (
      <ul className={SHEET_LIST}>
        {devices.map((device) => {
          const seen = relativeTime(device.lastSeen, now, i18n.language);
          const pairedAt = Date.parse(device.createdAt);
          return (
            <li key={device.id} className="flex items-center gap-3 px-4 py-3">
              <MonitorSmartphone aria-hidden className="h-4 w-4 shrink-0 text-content-tertiary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-content-primary">{device.name}</p>
                <p className="truncate text-xs text-content-tertiary">
                  {seen && (
                    <time dateTime={device.lastSeen} title={absoluteTime(device.lastSeen, i18n.language) ?? undefined}>
                      {t("userDeviceSeen", { time: seen })}
                    </time>
                  )}
                  {seen && !Number.isNaN(pairedAt) ? " · " : null}
                  {!Number.isNaN(pairedAt) && t("pairedOn", { date: dateFormat.format(pairedAt) })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setTarget(device); setConfirming(true); }}
                aria-label={`${t("revoke")} — ${device.name}`}
                className="h-8 shrink-0 rounded-lg px-3 text-xs font-semibold text-status-error-fg transition-colors duration-150 hover:bg-danger-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
              >
                {t("revoke")}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <UserSheetSection title={t("pairedDevices")}>
      {body}
      <ConfirmDialog
        open={confirming}
        title={t("userRevokeTitle", { device: target?.name ?? "" })}
        message={t("userRevokeMessage")}
        confirmLabel={t("revoke")}
        cancelLabel={t("common:cancel")}
        danger
        pending={revoke.isPending}
        onConfirm={confirmRevoke}
        onCancel={() => { if (!revoke.isPending) setConfirming(false); }}
      />
    </UserSheetSection>
  );
}
