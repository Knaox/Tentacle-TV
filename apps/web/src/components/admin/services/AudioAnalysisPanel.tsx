import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../../contexts/ToastContext";
import { ToggleSwitch } from "../../settings/ToggleSwitch";
import { SectionError, SectionSkeleton } from "./SectionParts";
import { servicesApi } from "./servicesApi";
import { SERVICES_KEYS, type AudioAnalysisStatus } from "./servicesModel";
import { formatDuration, formatMegabytes } from "./serviceSummary";
import { useAudioAnalysis, useExplainFailure } from "./useServicesData";

/**
 * L'analyse audio — la fin de chaque média, et les voisins de saison d'un
 * épisode : son interrupteur, écrit au changement — pas de bouton
 * « enregistrer » pour un seul réglage —, l'outil d'empreinte trouvé sur ce
 * serveur, et ce que la fonction a coûté depuis le démarrage. C'est ce qui
 * permet de décider en connaissance de cause de la laisser allumée.
 */
export function AudioAnalysisPanel() {
  const { t } = useTranslation("adminServices");
  const query = useAudioAnalysis();
  const audio = query.data;

  return (
    <div className="space-y-4 rounded-xl border border-line-subtle p-4">
      {audio ? (
        <>
          <AudioToggle audio={audio} />
          {audio.tool === null ? (
            <p className="text-xs leading-relaxed text-status-warning-fg">{t("audioUnavailable")}</p>
          ) : (
            <AudioCounters audio={audio} />
          )}
        </>
      ) : query.isError ? (
        <SectionError onRetry={() => void query.refetch()} />
      ) : (
        <SectionSkeleton lines={1} />
      )}
    </div>
  );
}

function AudioToggle({ audio }: { audio: AudioAnalysisStatus }) {
  const { t } = useTranslation("adminServices");
  const { show } = useToast();
  const explain = useExplainFailure();
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: servicesApi.setAudioAnalysis,
    onSuccess: (_done, enabled) => {
      queryClient.setQueryData<AudioAnalysisStatus>(SERVICES_KEYS.audioAnalysis, (previous) => previous && { ...previous, enabled });
      show("success", enabled ? t("audioEnabled") : t("audioDisabled"));
    },
    // L'interrupteur n'a pas bougé : il suit le cache, que seul un succès modifie.
    onError: (error) => show("error", explain(error)),
  });
  // Pendant l'écriture, l'interrupteur montre déjà la position demandée.
  const checked = toggle.isPending ? toggle.variables : audio.enabled;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-content-primary">{t("audioTitle")}</p>
        <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{t("audioNote")}</p>
        {audio.tool !== null && (
          <p className="mt-1.5 text-xs text-content-secondary">{t("audioTool", { tool: audio.tool })}</p>
        )}
      </div>
      <ToggleSwitch
        checked={checked}
        onChange={(next) => toggle.mutate(next)}
        label={t("audioTitle")}
        disabled={toggle.isPending || audio.tool === null}
      />
    </div>
  );
}

function AudioCounters({ audio }: { audio: AudioAnalysisStatus }) {
  const { t, i18n } = useTranslation("adminServices");
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const number = new Intl.NumberFormat(locale);
  const { counters } = audio;
  const stats: Array<[string, string]> = [
    [t("audioJobs"), number.format(counters.jobs)],
    [t("audioWindows"), number.format(counters.windows)],
    [t("audioData"), formatMegabytes(counters.bytes, locale)],
    [t("audioTime"), formatDuration(counters.seconds, locale)],
    [t("audioVerdicts"), number.format(counters.verdicts)],
    [t("audioSilent"), number.format(counters.silent)],
  ];
  if (counters.deferred !== null) stats.push([t("audioDeferred"), number.format(counters.deferred)]);

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">{t("audioSince")}</p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-7">
        {stats.map(([label, value]) => (
          // `dt` avant `dd`, comme le veut une liste de définitions ; la
          // colonne inversée remonte le chiffre au-dessus de son libellé.
          <div key={label} className="flex min-w-0 flex-col-reverse rounded-lg bg-fill-subtle px-3 py-2.5">
            <dt className="mt-0.5 truncate text-xs text-content-tertiary" title={label}>{label}</dt>
            <dd className="truncate text-lg font-semibold tabular-nums text-content-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
