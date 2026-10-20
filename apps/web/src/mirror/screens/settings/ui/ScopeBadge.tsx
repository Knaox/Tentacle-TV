import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Cloud, MonitorSmartphone } from "lucide-react";
import type { SettingScope } from "@tentacle-tv/shared";

/**
 * La pastille « Compte » / « Cet appareil » du web étroit — le jumeau de
 * `ScopeBadge` du mobile : un mot ET une icône (nuage, appareil), jamais la
 * couleur seule. Le compte prend la teinte de marque, l'appareil reste
 * neutre. Ce qu'elle dit vient du catalogue partagé (`SETTINGS_CONTROLS`,
 * `SETTINGS_PANE_SCOPES`), jamais d'une portée écrite dans une ligne.
 */
export const ScopeBadge = memo(function ScopeBadge({ scope }: { scope: SettingScope }) {
  const { t } = useTranslation("settingsMobile");
  const account = scope === "account";
  const Icon = account ? Cloud : MonitorSmartphone;
  return (
    <span
      role="note"
      aria-label={t(account ? "scope.accountA11y" : "scope.deviceA11y")}
      className={[
        "mt-1 inline-flex items-center gap-1 self-start rounded-full border px-1.5 py-[2px] text-[11px] font-semibold leading-[14px]",
        account
          ? "border-[var(--brand-soft)] bg-[var(--brand-soft)] text-[var(--brand-light)]"
          : "border-line-subtle bg-fill-subtle text-content-tertiary",
      ].join(" ")}
    >
      <Icon size={10} aria-hidden />
      <span aria-hidden>{t(account ? "scope.account" : "scope.device")}</span>
    </span>
  );
});
