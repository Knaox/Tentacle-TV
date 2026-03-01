import { useState } from "react";
import { InstalledTab } from "../components/admin-plugins/InstalledTab";
import { MarketplaceTab } from "../components/admin-plugins/MarketplaceTab";
import { SourcesTab } from "../components/admin-plugins/SourcesTab";

const TABS = [
  { key: "installed", label: "Installes" },
  { key: "marketplace", label: "Marketplace" },
  { key: "sources", label: "Sources" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AdminPlugins() {
  const [tab, setTab] = useState<TabKey>("installed");

  return (
    <div className="px-4 pt-6 pb-16 md:px-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-2xl font-bold text-white">Plugins</h1>
        <p className="mb-6 text-sm text-white/50">
          Gerez les plugins installes, explorez le marketplace et configurez vos sources.
        </p>

        {/* Tab bar */}
        <div className="mb-6 flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-purple-600 text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "installed" && <InstalledTab />}
        {tab === "marketplace" && <MarketplaceTab />}
        {tab === "sources" && <SourcesTab />}
      </div>
    </div>
  );
}
