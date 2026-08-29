import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tv } from "lucide-react";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";
import { useMyPairedDevices, useRevokeMyDevice } from "@tentacle-tv/api-client";

import { ConfirmDialog } from "../ui/ConfirmDialog";

/**
 * MES appareils jumelés — self-service.
 *
 * Renommé depuis `PairedDevicesSection` : ce nom était porté par DEUX
 * composants de portée différente, celui-ci (mes appareils, dans les réglages)
 * et `components/admin/PairedDevicesSection` (tous les appareils, côté admin).
 * Même nom, même sujet, périmètres opposés — source de confusion garantie à la
 * relecture.
 *
 * La section ne s'efface plus quand la liste est vide ou que l'appel échoue.
 * Elle le faisait, et c'était indiscernable d'une fonctionnalité absente : un
 * compte non administrateur n'avait aucun moyen de savoir s'il n'avait pas
 * d'appareil, ou si la requête était partie au fossé. On répond dans les deux
 * cas.
 *
 * La confirmation passe par `ConfirmDialog`, JAMAIS `window.confirm()`. Sous
 * Electron (Windows, macOS) `confirm()` répondrait — c'est du Chromium — mais
 * la coquille Linux est Tauri, dont le webview renvoie false SANS RIEN
 * AFFICHER (wry #460) : le bouton « Révoquer » y serait mort. Même dialogue
 * partout, donc, comme pour le changement de serveur.
 */
export function MyDevicesSection() {
  const { t } = useTranslation(["pairing", "common"]);
  const { data: devices, isLoading, isError } = useMyPairedDevices();
  const revokeMut = useRevokeMyDevice();
  const [toRevoke, setToRevoke] = useState<string | null>(null);

  // Premier chargement : rien plutôt qu'une carte vide qui se remplirait sous
  // les yeux. Les rafraîchissements suivants gardent la liste affichée.
  if (isLoading) return null;

  const confirm = () => {
    if (toRevoke) revokeMut.mutate(toRevoke);
    setToRevoke(null);
  };

  return (
    <>
      <SettingsSection title={t("pairing:pairedDevices")}>
        {isError ? (
          <p className="px-4 py-3.5 text-sm text-status-error-fg">{t("pairing:devicesLoadError")}</p>
        ) : !devices || devices.length === 0 ? (
          <p className="px-4 py-3.5 text-sm text-content-tertiary">{t("pairing:noPairedDevices")}</p>
        ) : (
          devices.map((device, i) => (
            <SettingsRow
              key={device.id}
              icon={<Tv size={17} />}
              label={device.name}
              description={t("pairing:lastActive", {
                date: new Date(device.lastSeen).toLocaleDateString(),
              })}
              last={i === devices.length - 1}
              trailing={
                <button
                  type="button"
                  onClick={() => setToRevoke(device.id)}
                  disabled={revokeMut.isPending}
                  className="rounded-lg bg-danger-surface px-3 py-1.5 text-xs font-medium text-status-error-fg transition-colors hover:bg-danger-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-40"
                >
                  {t("pairing:revoke")}
                </button>
              }
            />
          ))
        )}
      </SettingsSection>

      <ConfirmDialog
        open={toRevoke !== null}
        title={t("pairing:revoke")}
        message={t("pairing:revokeConfirm")}
        confirmLabel={t("pairing:revoke")}
        cancelLabel={t("common:cancel")}
        onConfirm={confirm}
        onCancel={() => setToRevoke(null)}
        pending={revokeMut.isPending}
        danger
      />
    </>
  );
}
