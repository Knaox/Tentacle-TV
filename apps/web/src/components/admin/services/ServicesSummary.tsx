import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AudioWaveform, Database, Globe, Server, Zap } from "lucide-react";
import { StatTile, type StatTone } from "../kit";
import {
  summarizeAudio,
  summarizeDatabase,
  summarizeDirectStreaming,
  summarizeJellyfin,
  summarizePublicUrl,
  type Summary,
  type Tone,
} from "./serviceSummary";
import {
  useAudioAnalysis,
  useDirectStreamingConfig,
  useKeyHealth,
  usePublicUrlConfig,
  useServicesStatus,
} from "./useServicesData";

/**
 * Le résumé en tête de page : cinq tuiles, un état chacune, et la tuile
 * entière mène à sa section (`#jellyfin`…). On sait d'un regard ce qui va et
 * ce qui ne va pas, avant de lire le moindre formulaire.
 *
 * Mêmes requêtes que les sections, donc aucune de plus : ce qu'une section
 * enregistre, sa tuile le montre aussitôt.
 */

const STAT_TONE: Record<Tone, StatTone> = { success: "success", warning: "warning", error: "error", neutral: "default" };

interface Tile {
  id: string;
  icon: ReactNode;
  label: string;
  loading: boolean;
  failed: boolean;
  summary: Summary | null;
}

export function ServicesSummary() {
  const { t } = useTranslation("adminServices");
  const status = useServicesStatus();
  const keyState = useKeyHealth().data?.state ?? null;
  const publicUrl = usePublicUrlConfig();
  const direct = useDirectStreamingConfig();
  const audio = useAudioAnalysis();

  const tiles: Tile[] = [
    {
      id: "jellyfin",
      icon: <Server size={18} />,
      label: t("jellyfinTitle"),
      loading: status.isPending,
      failed: status.isError,
      summary: status.data ? summarizeJellyfin(status.data.jellyfin, keyState) : null,
    },
    {
      id: "database",
      icon: <Database size={18} />,
      label: t("databaseTitle"),
      loading: status.isPending,
      failed: status.isError,
      summary: status.data ? summarizeDatabase(status.data.database) : null,
    },
    {
      id: "publicurl",
      icon: <Globe size={18} />,
      label: t("publicUrlTitle"),
      loading: publicUrl.isPending,
      failed: publicUrl.isError,
      summary: publicUrl.data ? summarizePublicUrl(publicUrl.data) : null,
    },
    {
      id: "directstreaming",
      icon: <Zap size={18} />,
      label: t("directTitle"),
      loading: direct.isPending,
      failed: direct.isError,
      summary: direct.data ? summarizeDirectStreaming(direct.data) : null,
    },
    {
      id: "segments",
      icon: <AudioWaveform size={18} />,
      label: t("summaryAudio"),
      loading: audio.isPending,
      failed: audio.isError,
      summary: audio.data ? summarizeAudio(audio.data) : null,
    },
  ];

  return (
    <section aria-label={t("summaryLabel")} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map(({ id, icon, label, loading, failed, summary }) => {
        const state = summary ? t(summary.label) : t("summaryUnknown");
        const hint = summary?.detail ?? (summary?.detailKey ? t(summary.detailKey) : undefined);
        return (
          <StatTile
            key={id}
            to={`#${id}`}
            icon={icon}
            label={label}
            loading={loading}
            tone={summary ? STAT_TONE[summary.tone] : failed ? "error" : "default"}
            // Un mot, pas un chiffre : la taille du kit (`text-3xl`) le ferait
            // passer à la ligne dans une tuile étroite.
            value={<span className="text-xl">{state}</span>}
            hint={hint && <span className="block truncate" title={hint}>{hint}</span>}
            className="min-w-0"
          />
        );
      })}
    </section>
  );
}
