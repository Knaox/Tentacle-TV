import { useTranslation } from "react-i18next";
import { usePairedDevices, useRevokePairedDevice } from "@tentacle-tv/api-client";
import { cls } from "../../pages/adminUtils";

/**
 * Section "Appareils appairés" admin — extraite depuis Admin.tsx. Layout
 * responsive : stack vertical sur mobile, row sur ≥480px.
 */
export function PairedDevicesSection() {
  const { t } = useTranslation("admin");
  const { data: devices } = usePairedDevices();
  const revokeMut = useRevokePairedDevice();

  return (
    <div className={cls.card}>
      <h2 className="mb-4 text-lg font-semibold text-white">{t("pairedDevices")}</h2>
      {!devices || devices.length === 0 ? (
        <p className="text-sm text-white/40">{t("noPairedDevices")}</p>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex flex-col items-start gap-3 rounded-lg border border-white/[0.06] p-4 xs:flex-row xs:items-center xs:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{device.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/40">
                  <span>{device.username}</span>
                  <span>{t("lastActivity", { date: new Date(device.lastSeen).toLocaleDateString() })}</span>
                  <span>{t("pairedOn", { date: new Date(device.createdAt).toLocaleDateString() })}</span>
                </div>
              </div>
              <button
                onClick={() => { if (confirm(t("revokeConfirm"))) revokeMut.mutate(device.id); }}
                disabled={revokeMut.isPending}
                className={cls.bd}
              >
                {t("revoke")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
