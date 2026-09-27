import { useTranslation } from "react-i18next";
import { Eye, MonitorSmartphone, Tv } from "lucide-react";
import { UserAvatar } from "../../../components/admin/kit";
import { Place, type Animated, type Placed } from "..";
import { useAgo, type SceneAccount } from "./FauxUserCard";

/**
 * La fiche d'un compte, en faux : sa photo, son activité, ses appareils
 * jumelés à révoquer et « Voir en tant que ». Les intertitres sont ceux de
 * `UserSheetSection` ; les appareils portent les noms de nos applications.
 */

const DEVICES = [
  { icon: Tv, name: "Tentacle TV" },
  { icon: MonitorSmartphone, name: "Tentacle Mobile" },
] as const;

function Heading({ children }: { children: string }) {
  return <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-content-tertiary">{children}</p>;
}

export function FauxUserSheet({ account, ...place }: Placed & Animated & { account: SceneAccount }) {
  const { t } = useTranslation("admin");
  const ago = useAgo(account.minutesAgo);
  return (
    <Place {...place}>
      <div
        className="flex h-full flex-col gap-3 rounded-2xl border border-line-subtle p-4"
        style={{ background: "var(--nav-panel-bg)", boxShadow: "var(--shadow-dropdown)" }}
      >
        <div className="flex items-center gap-3">
          <UserAvatar userId={account.id} name={account.name} hasAvatar={account.hasAvatar} imageTag={account.imageTag} size={48} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-content-primary">{account.name}</p>
            <p className="truncate text-[10px] text-content-tertiary">{t("userActive", { time: ago })}</p>
          </div>
        </div>
        <div>
          <Heading>{t("userActivityTitle")}</Heading>
          <div className="flex items-center justify-between rounded-lg bg-fill-subtle px-2.5 py-1.5 text-[10.5px]">
            <span className="text-content-secondary">{t("userLastActivity")}</span>
            <span className="text-content-primary">{ago}</span>
          </div>
        </div>
        <div>
          <Heading>{t("pairedDevices")}</Heading>
          <div className="space-y-1">
            {DEVICES.map(({ icon: Icon, name }) => (
              <div key={name} className="flex items-center gap-2 rounded-lg bg-fill-subtle px-2.5 py-1.5 text-[10.5px]">
                <Icon aria-hidden className="h-3.5 w-3.5 text-content-tertiary" />
                <span className="flex-1 truncate text-content-primary">{name}</span>
                <span className="rounded-md border border-danger-border px-1.5 py-0.5 text-[9.5px] font-semibold text-[var(--status-error-fg)]">
                  {t("revoke")}
                </span>
              </div>
            ))}
          </div>
        </div>
        <span className="mt-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line-subtle bg-fill-soft text-[11px] font-semibold text-content-primary">
          <Eye aria-hidden className="h-3.5 w-3.5" />
          {t("impersonate")}
        </span>
      </div>
    </Place>
  );
}
