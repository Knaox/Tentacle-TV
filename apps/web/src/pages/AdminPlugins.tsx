import { useState } from "react";
import { useTranslation } from "react-i18next";
import { InstalledTab } from "../components/admin-plugins/InstalledTab";
import { MarketplaceTab } from "../components/admin-plugins/MarketplaceTab";
import { SourcesTab } from "../components/admin-plugins/SourcesTab";
import { PageTransition } from "../components/PageTransition";
import { cls } from "./adminUtils";

type TabKey = "installed" | "marketplace" | "sources";

export function AdminPlugins() {
  const { t } = useTranslation("adminPlugins");
  const [tab, setTab] = useState<TabKey>("installed");

  const TABS: { key: TabKey; label: string }[] = [
    { key: "installed", label: t("adminPlugins:tabInstalled") },
    { key: "marketplace", label: t("adminPlugins:tabMarketplace") },
    { key: "sources", label: t("adminPlugins:tabSources") },
  ];

  return (
    <PageTransition>
    <div className="px-4 pt-6 pb-16 md:px-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white">{t("adminPlugins:pageTitle")}</h1>
        <p className="mb-6 text-sm text-white/50">
          {t("adminPlugins:subtitle")}
        </p>

        {/* Tab bar */}
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={tab === tb.key ? cls.bbrand : cls.bs}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "installed" && <InstalledTab />}
        {tab === "marketplace" && <MarketplaceTab />}
        {tab === "sources" && <SourcesTab />}
      </div>
    </div>
    </PageTransition>
  );
}
