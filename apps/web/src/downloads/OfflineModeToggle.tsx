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
import { WifiOff } from "lucide-react";
import { setManualOffline } from "../offline/connectivityStore";
import { useConnectivity } from "../offline/useConnectivity";

export function OfflineModeToggle() {
  const { t } = useTranslation("downloads");
  const snap = useConnectivity();
  const manual = snap.state === "offline-manual";
  const forced = snap.state === "offline-auto";
  const on = manual || forced;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-fill-faint px-3 py-2.5">
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          on ? "bg-status-warning-bg text-status-warning-fg" : "bg-fill-subtle text-content-tertiary"
        }`}
        aria-hidden
      >
        <WifiOff className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-content-primary">{t("offlineModeLabel")}</p>
        <p className="text-xs leading-snug text-content-tertiary">
          {forced ? t("offlineAutoHint") : on ? t("offlineModeOnHint") : t("offlineModeOffHint")}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={t("offlineModeLabel")}
        disabled={forced}
        onClick={() => setManualOffline(!manual)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-60 ${
          on ? "bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)]" : "bg-fill-soft"
        }`}
      >
        {/* Le curseur glisse par `transform` : aucune peinture par image. */}
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none ${
            on ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
