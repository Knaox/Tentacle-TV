import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import type { SetupPluginState } from "@tentacle-tv/shared";
import { AdminSection, StatusPill, type StatusTone } from "../kit";
import { useJellyfinSetup } from "../jellyfin/jellyfinAdminApi";
import { AudioAnalysisPanel } from "./AudioAnalysisPanel";

/**
 * Où le serveur trouve les passages d'un épisode — et comment lui en donner.
 *
 * Les greffons restent la SOURCE PREMIÈRE : ils voient la vidéo et l'audio.
 * Mais Tentacle n'est plus aveugle sans eux : à la première lecture de chaque
 * film et de chaque épisode, l'analyse de FIN DE MÉDIA lit les vignettes
 * trickplay et écoute la fin (`services/tailAnalysis/`) — début du générique,
 * scènes mi- et post-génériques, y compris contre un greffon qui s'est
 * trompé ; et pour un épisode que personne n'a décrit, l'analyse AUDIO écoute
 * ses voisins de saison (`services/audioAnalysis.ts`). Les deux font
 * travailler Jellyfin : elles partagent un interrupteur, et un compteur.
 *
 * Les greffons s'EMPILENT : chacun signale ce qu'il sait, et le résolveur prend
 * le plus précis. En installer deux ne crée pas de conflit. Chaque carte dit
 * s'il est installé sur le Jellyfin connecté — lu par les réglages
 * recommandés, la même requête que la vue d'ensemble, où il s'installe.
 */

interface Plugin {
  key: string;
  name: string;
  url: string;
}

const PLUGINS: readonly Plugin[] = [
  { key: "introSkipper", name: "Intro Skipper", url: "https://github.com/intro-skipper/intro-skipper" },
  { key: "chapterSegments", name: "Chapter Segments", url: "https://github.com/jellyfin/jellyfin-plugin-chapter-segments" },
  { key: "introDb", name: "TheIntroDB", url: "https://github.com/TheIntroDB/jellyfin-plugin" },
  { key: "skipmeDb", name: "skipme.db", url: "https://github.com/intro-skipper/skipme.db-plugin" },
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
  const { t } = useTranslation(["adminServices", "adminJellyfin"]);
  const states = usePluginStates();
  return (
    <AdminSection id="segments" title={t("segmentsTitle")} description={t("segmentsDescription")}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">{t("segmentsPlugins")}</p>
          <ul className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
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
                        {plugin.name}
                        {state && (
                          <StatusPill tone={PLUGIN_STATE[state].tone} size="sm">{t(`adminJellyfin:${PLUGIN_STATE[state].key}`)}</StatusPill>
                        )}
                        <span className="sr-only"> {t("opensNewTab")}</span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-content-tertiary">{t(`plugin_${plugin.key}`)}</span>
                    </span>
                    <ExternalLink size={14} aria-hidden="true" className="mt-1 shrink-0 text-content-quaternary group-hover:text-content-secondary" />
                  </a>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-content-tertiary">{t("segmentsScanHelp")}</p>
          <p className="mt-2 text-xs leading-relaxed text-content-tertiary">{t("segmentsFrameNote")}</p>
        </div>
        <AudioAnalysisPanel />
      </div>
    </AdminSection>
  );
}
