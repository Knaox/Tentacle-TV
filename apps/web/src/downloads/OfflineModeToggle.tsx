/**
 * La bascule « Mode hors ligne » de l'écran des téléchargements.
 *
 * Le passage manuel n'existait que dans la bulle de la pastille « Hors ligne »,
 * qui n'apparaît… qu'une fois hors ligne. Depuis l'écran qui porte ce qu'on a
 * gardé, on doit pouvoir s'y mettre avant de prendre le train. Même magasin,
 * même clé de stockage : la pastille et cette bascule disent la même chose.
 *
 * Hors ligne SUBI (serveur injoignable), la bascule reste visible mais ne se
 * désactive pas : repasser en ligne n'est pas en notre pouvoir, la sonde le
 * fera d'elle-même.
 */

import { useTranslation } from "react-i18next";
import { WifiSlashIcon as WifiOff } from "@phosphor-icons/react/dist/csr/WifiSlash";
import { ToggleSwitch } from "../components/settings/ToggleSwitch";
import { setManualOffline } from "../offline/connectivityStore";
import { useConnectivity } from "../offline/useConnectivity";

export function OfflineModeToggle() {
  const { t } = useTranslation("downloads");
  const snap = useConnectivity();
  const manual = snap.state === "offline-manual";
  const forced = snap.state === "offline-auto";
  const on = manual || forced;

  return (
    <div className="ui-panel lg-panel flex items-center gap-3.5 px-5 py-4" data-offline-mode={on ? "on" : "off"}>
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-pill ${
          on ? "bg-status-warning-bg text-status-warning-fg" : "bg-fill-soft text-content-secondary"
        }`}
        aria-hidden
      >
        <WifiOff size={18} weight={on ? "fill" : "regular"} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-[15px] font-semibold text-content-primary">{t("offlineModeLabel")}</p>
        <p className="max-w-[65ch] text-[13px] leading-snug text-content-secondary">
          {forced ? t("offlineAutoHint") : on ? t("offlineModeOnHint") : t("offlineModeOffHint")}
        </p>
      </div>
      {/* L'interrupteur du socle : allumé, la teinte franche ; le pouce glisse par `transform`. */}
      <ToggleSwitch checked={on} onChange={() => setManualOffline(!manual)} label={t("offlineModeLabel")} disabled={forced} />
    </div>
  );
}
