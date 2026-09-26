import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BACKEND, cls, hdrs } from "../../pages/adminUtils";
import { ToggleSwitch } from "../settings/ToggleSwitch";

/**
 * Où le serveur trouve les passages d'un épisode — et comment lui en donner.
 *
 * Les greffons restent la SOURCE PREMIÈRE : ils voient la vidéo et l'audio.
 * Mais Tentacle n'est plus aveugle sans eux : quand aucune source ne dit rien
 * de crédible sur le générique de fin, l'analyse embarquée lit les vignettes
 * trickplay (`creditsFromFrames.ts`) et fournit générique et scène
 * post-générique ; et pour un épisode que personne n'a décrit, l'analyse AUDIO
 * écoute ses voisins de saison (`services/audioAnalysis.ts`). Cette dernière
 * fait travailler Jellyfin : elle a donc son interrupteur, et son compteur.
 *
 * Les greffons s'EMPILENT : chacun signale ce qu'il sait, et le résolveur prend
 * le plus précis. En installer deux ne crée pas de conflit.
 */

interface Plugin {
  key: string;
  nom: string;
  url: string;
}

const PLUGINS: readonly Plugin[] = [
  { key: "introSkipper", nom: "Intro Skipper", url: "https://github.com/intro-skipper/intro-skipper" },
  { key: "chapterSegments", nom: "Chapter Segments", url: "https://github.com/jellyfin/jellyfin-plugin-chapter-segments" },
  { key: "introDb", nom: "TheIntroDB", url: "https://github.com/TheIntroDB/jellyfin-plugin" },
  { key: "skipmeDb", nom: "skipme.db", url: "https://github.com/intro-skipper/skipme.db-plugin" },
];

interface AudioAnalysisStatus {
  enabled: boolean;
  tool: "fpcalc" | "ffmpeg" | null;
  counters: { jobs: number; windows: number; bytes: number; seconds: number; verdicts: number; silent: number };
}

/** L'interrupteur de l'analyse audio, écrit au changement — pas de bouton « enregistrer ». */
function AudioAnalysisToggle() {
  const { t } = useTranslation("admin");
  const [status, setStatus] = useState<AudioAnalysisStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND}/api/admin/audio-analysis`, { headers: hdrs() });
        if (r.ok) setStatus((await r.json()) as AudioAnalysisStatus);
      } catch {
        // Section informative : sans réponse, elle ne s'affiche pas.
      }
    })();
  }, []);

  const toggle = async (enabled: boolean) => {
    if (status === null) return;
    setBusy(true);
    try {
      const r = await fetch(`${BACKEND}/api/admin/audio-analysis`, {
        method: "PUT",
        headers: hdrs(),
        body: JSON.stringify({ enabled }),
      });
      if (r.ok) setStatus({ ...status, enabled });
    } catch {
      // L'état affiché reste celui du serveur.
    }
    setBusy(false);
  };

  if (status === null) return null;
  const { counters } = status;
  return (
    <div className="mt-4 space-y-2 border-t border-line-subtle pt-4">
      {/* L'interrupteur canonique (role="switch") : la copie d'avant tenait sa
          bordure d'une classe `[var(--brand)]/45` qui ne produisait aucun CSS. */}
      <label className="flex cursor-pointer items-center gap-3">
        <ToggleSwitch
          checked={status.enabled}
          disabled={busy || status.tool === null}
          onChange={(enabled) => void toggle(enabled)}
          label={t("segmentPluginsAudioAnalysisEnabled")}
        />
        <span className="text-sm text-content-primary">{t("segmentPluginsAudioAnalysisEnabled")}</span>
      </label>
      <p className="text-xs text-content-quaternary">{t("segmentPluginsAudioAnalysisNote")}</p>
      <p className="text-xs text-content-quaternary">
        {status.tool === null
          ? t("segmentPluginsAudioAnalysisUnavailable")
          : t("segmentPluginsAudioAnalysisTool", { tool: status.tool })}
      </p>
      {status.tool !== null && (
        <p className="text-xs text-content-disabled">
          {t("segmentPluginsAudioAnalysisCounters", {
            jobs: counters.jobs,
            windows: counters.windows,
            megabytes: (counters.bytes / 1e6).toFixed(1),
            seconds: Math.round(counters.seconds),
            verdicts: counters.verdicts,
            silent: counters.silent,
          })}
        </p>
      )}
    </div>
  );
}

export function SegmentPluginsSection() {
  const { t } = useTranslation("admin");

  return (
    <div className={cls.card}>
      <h2 className="mb-1 text-lg font-semibold text-content-primary">{t("segmentPlugins")}</h2>
      <p className="mb-4 text-sm text-content-quaternary">{t("segmentPluginsDescription")}</p>
      <div className={cls.sub}>
        <ul className="space-y-2">
          {PLUGINS.map((plugin) => (
            <li key={plugin.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <a
                href={plugin.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-content-primary underline decoration-line-subtle underline-offset-4 hover:decoration-current"
              >
                {plugin.nom}
              </a>
              <span className="text-xs text-content-quaternary">
                {t(`segmentPlugin_${plugin.key}`)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-content-quaternary">{t("segmentPluginsScanHelp")}</p>
        <p className="mt-2 text-xs text-content-quaternary">
          {t("segmentPluginsFrameAnalysisNote")}
        </p>
        <AudioAnalysisToggle />
      </div>
    </div>
  );
}
