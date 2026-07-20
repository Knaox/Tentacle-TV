import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, Gauge, Wifi, WifiOff } from "lucide-react";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";

import { useDataSaverActive, useDataSaverSetting } from "../../offline/useDataSaver";
import type { DataSaverSetting } from "../../offline/dataSaver";

/**
 * Données — mode économie.
 *
 * Réglage PAR APPAREIL (localStorage), comme le thème : la qualité de
 * connexion dépend de l'endroit où tourne l'app, pas du compte. Le même
 * utilisateur peut être en fibre au bureau et en partage de connexion ailleurs.
 *
 * `auto` par défaut : la latence mesurée par les sondes de connectivité décide.
 * Les deux forçages existent pour les cas que la mesure ne peut pas connaître —
 * un lien rapide mais facturé au volume, ou au contraire lent mais illimité.
 */

const ICON = 17;

export function SettingsData() {
  const { t } = useTranslation("downloads");
  const { setting, setSetting } = useDataSaverSetting();
  const active = useDataSaverActive();

  const modes: Array<{ id: DataSaverSetting; label: string; icon: ReactNode; hint: string }> = [
    {
      id: "auto",
      label: t("saverModeAuto"),
      icon: <Gauge size={ICON} />,
      hint: t("saverModeAutoHint"),
    },
    {
      id: "on",
      label: t("saverModeOn"),
      icon: <WifiOff size={ICON} />,
      hint: t("saverModeOnHint"),
    },
    {
      id: "off",
      label: t("saverModeOff"),
      icon: <Wifi size={ICON} />,
      hint: t("saverModeOffHint"),
    },
  ];

  return (
    <div className="max-w-2xl">
      <SettingsSection
        title={t("saverSettingsTitle")}
        caption={
          active
            ? `${t("saverSettingsCaption")} — ${t("saverActiveNow")}`
            : t("saverSettingsCaption")
        }
      >
        {modes.map((m, i) => (
          <SettingsRow
            key={m.id}
            icon={m.icon}
            label={m.label}
            description={m.hint}
            onClick={() => setSetting(m.id)}
            last={i === modes.length - 1}
            trailing={
              setting === m.id ? (
                <span className="text-brand" aria-label="selected">
                  <Check size={18} />
                </span>
              ) : undefined
            }
          />
        ))}
      </SettingsSection>
    </div>
  );
}
