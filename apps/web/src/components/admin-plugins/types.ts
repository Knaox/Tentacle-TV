export interface InstalledPlugin {
  id: string;
  pluginId: string;
  name: string;
  version: string;
  sourceId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  installedAt: string;
}

export interface MarketplacePlugin {
  pluginId: string;
  name: string;
  version: string;
  description: string;
  author: string;
  sourceId: string;
  sourceName: string;
  official: boolean;
  installed: boolean;
  installedVersion?: string;
  updateAvailable: boolean;
  downloadUrl?: string;
  icon?: string;
  tags?: string[];
  category?: string;
  repo?: string;
}

export interface PluginSource {
  id: string;
  name: string;
  url: string;
  official: boolean;
  enabled: boolean;
}

export const cls = {
  card: "rounded-xl border border-white/10 bg-white/[0.03] p-5",
  row: "flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-4",
  bp: "rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-40 transition-colors",
  bs: "rounded-lg bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 hover:bg-white/20 disabled:opacity-40 transition-colors",
  bd: "rounded-lg bg-red-600/20 px-4 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/30 disabled:opacity-40 transition-colors",
  inp: "w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-purple-500 placeholder-white/30",
  lbl: "mb-1 block text-xs text-white/40",
  empty: "py-12 text-center text-sm text-white/40",
  spinner: "flex justify-center py-12",
};
