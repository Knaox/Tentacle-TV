import { useTranslation } from "react-i18next";
import { Tv } from "lucide-react";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";
import { useMyPairedDevices, useRevokeMyDevice } from "@tentacle-tv/api-client";

/**
 * MES appareils jumelés — self-service.
 *
 * Renommé depuis `PairedDevicesSection` : ce nom était porté par DEUX
 * composants de portée différente, celui-ci (mes appareils, dans les réglages)
 * et `components/admin/PairedDevicesSection` (tous les appareils, côté admin).
 * Même nom, même sujet, périmètres opposés — source de confusion garantie à la
 * relecture.
 */
export function MyDevicesSection() {
  const { t } = useTranslation("pairing");
  const { data: devices } = useMyPairedDevices();
  const revokeMut = useRevokeMyDevice();

  if (!devices || devices.length === 0) return null;

  return (
    <SettingsSection title={t("pairedDevices")}>
      {devices.map((device, i) => (
        <SettingsRow
          key={device.id}
          icon={<Tv size={17} />}
          label={device.name}
          description={t("lastActive", {
            date: new Date(device.lastSeen).toLocaleDateString(),
          })}
          last={i === devices.length - 1}
          trailing={
            <button
              type="button"
              onClick={() => revokeMut.mutate(device.id)}
              disabled={revokeMut.isPending}
              className="rounded-lg bg-danger-surface px-3 py-1.5 text-xs font-medium text-status-error-fg transition-colors hover:bg-danger-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-40"
            >
              {t("revoke")}
            </button>
          }
        />
      ))}
    </SettingsSection>
  );
}
