import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import type { SegmentPluginKey, SetupPluginState } from "@tentacle-tv/shared";
import { ServerCapabilityGate } from "@tentacle-tv/api-client";
import { AdminSection, StatusPill, type StatusTone } from "../kit";
import { useJellyfinSetup } from "../jellyfin/jellyfinAdminApi";
import { AudioAnalysisPanel } from "./AudioAnalysisPanel";
import { SegmentPluginsRepair } from "./SegmentPluginsRepair";

/**
 * Où le serveur trouve les passages d'un épisode — et le geste qui les lui
 * donne.
 *
 * Trois greffons de Jellyfin, que Tentacle installe et règle lui-même
 * (« Installer / réparer », le même passage que l'assistant d'installation) :
 * Intro Skipper (son analyse automatique, qui écoute l'audio, reste coupée),
 * TheIntroDB et SkipMe.db — deux bases en ligne. Ils s'EMPILENT : chacun
 * signale ce qu'il sait, et le résolveur prend le plus précis.
 *
 * Tentacle a aussi son analyse : à la première lecture, la fin de chaque média
 * par ses vignettes trickplay (`services/tailAnalysis/`) ; l'ÉCOUTE (fin de
 * média et voisins de saison) est coupée par défaut, son interrupteur est
 * ci-dessous. Chaque carte dit si le greffon est installé sur le Jellyfin
 * connecté — lu par les réglages recommandés, la même requête que la vue
 * d'ensemble.
 */

interface Plugin {
  key: SegmentPluginKey;
  url: string;
}

const PLUGINS: readonly Plugin[] = [
  { key: "introSkipper", url: "https://github.com/intro-skipper/intro-skipper" },
  { key: "theIntroDb", url: "https://github.com/TheIntroDB/jellyfin-plugin" },
  { key: "skipMeDb", url: "https://github.com/intro-skipper/skipme.db-plugin" },
];

const PLUGIN_STATE: Record<SetupPluginState, { tone: StatusTone; key: string }> = {
  active: { tone: "success", key: "pluginActive" },
  restart: { tone: "warning", key: "pluginRestart" },
  disabled: { tone: "neutral", key: "pluginDisabled" },
  missing: { tone: "neutral", key: "pluginMissing" },
};

/** L'état d'un greffon d'après les réglages recommandés, rapproché par son dépôt. */
function usePluginStates(): Map<string, SetupPluginState> {
  const setup = useJellyfinSetup();
  const plugins = setup.data?.checks.find((check) => check.id === "segmentsProvider")?.plugins ?? [];
  return new Map(plugins.flatMap((plugin) => (plugin.homepage ? [[plugin.homepage, plugin.state] as const] : [])));
}

export function SegmentDetectionSection() {
  const { t } = useTranslation(["adminServices", "adminJellyfin", "segmentPlugins"]);
  const states = usePluginStates();
  return (
    <AdminSection id="segments" title={t("segmentsTitle")} description={t("segmentsDescription")}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">{t("segmentsPlugins")}</p>
          <ul className="grid gap-2 md:grid-cols-3">
            {PLUGINS.map((plugin) => {
              const state = states.get(plugin.url);
              return (
                <li key={plugin.key}>
                  <a
                    href={plugin.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex h-full items-start gap-3 rounded-xl border border-line-subtle bg-fill-subtle px-3 py-2.5 transition-colors hover:bg-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-content-primary">
                        {t(`segmentPlugins:plugin_${plugin.key}`)}
                        {state && (
                          <StatusPill tone={PLUGIN_STATE[state].tone} size="sm">{t(`adminJellyfin:${PLUGIN_STATE[state].key}`)}</StatusPill>
                        )}
                        <span className="sr-only"> {t("opensNewTab")}</span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-content-tertiary">{t(`segmentPlugins:role_${plugin.key}`)}</span>
                    </span>
                    <ExternalLink size={14} aria-hidden="true" className="mt-1 shrink-0 text-content-quaternary group-hover:text-content-secondary" />
                  </a>
                </li>
              );
            })}
          </ul>
          {/* « Installer / réparer » : un serveur d'avant 1.24.0 n'a pas la route — ni le geste, ni sa phrase. */}
          <ServerCapabilityGate
            capability="admin.segmentPlugins"
            fallback={<p className="mt-3 text-xs leading-relaxed text-content-tertiary">{t("segmentsStackHelp")}</p>}
          >
            <div className="mt-3">
              <SegmentPluginsRepair />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-content-tertiary">{t("segmentsScanHelp")}</p>
          </ServerCapabilityGate>
          <p className="mt-2 text-xs leading-relaxed text-content-tertiary">{t("segmentsFrameNote")}</p>
        </div>
        <AudioAnalysisPanel />
      </div>
    </AdminSection>
  );
}
