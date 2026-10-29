/**
 * Octave — la fin d'un import : « X sur N titres », ce qui est entré (bibliothèque, vos imports, en cloud), chaque
 * titre non importé avec son motif (règle partagée `importReport` : liste fermée, jamais un message brut — repliée
 * quand elle est longue), une source lue en partie, et « Ouvrir la playlist ». Ou l'échec, en mots, avec « Réessayer ».
 */

import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, CloudCheck, FolderDown, Library, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ImportFlowState } from "@tentacle-tv/api-client";
import { importReport, type ImportReportPart } from "@tentacle-tv/shared/octave";

const BUTTON = "min-h-[44px] cursor-pointer rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

interface Props {
  titleId: string;
  state: ImportFlowState;
  onOpen: (playlistId: string) => void;
  onAnother: () => void;
  onClose: () => void;
}

const PART_ICON: Record<ImportReportPart, typeof Library> = { library: Library, imported: FolderDown, cloud: CloudCheck };

function Line({ icon: Icon, text, muted = false }: { icon: typeof Library; text: string; muted?: boolean }) {
  return (
    <li className={`flex items-center gap-3 text-sm ${muted ? "text-content-tertiary" : "text-content-primary"}`}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {text}
    </li>
  );
}

type Summary = NonNullable<ImportFlowState["summary"]>;

/** Le bilan lui-même : « X sur N », ses parts, les titres non importés et leurs motifs. */
function ReportBody({ summary }: { summary: Summary }) {
  const { t } = useTranslation("musicImport");
  const report = useMemo(() => importReport(summary), [summary]);
  const [open, setOpen] = useState(false);
  const listed = !report.folded || open;
  return (
    <>
      <p className="text-base font-semibold tabular-nums text-content-primary">{t("report.kept", { kept: report.kept, count: report.total })}</p>
      <ul className="flex flex-col gap-2">
        {report.parts.map(({ part, count }) => (
          <Line key={part} icon={PART_ICON[part]} text={t(`report.part.${part}`, { count })} />
        ))}
        {report.missing.length > 0 && <Line icon={SearchX} text={t("report.skipped", { count: report.missing.length })} muted />}
      </ul>
      {summary.truncated && <p className="text-xs text-content-tertiary">{t("truncated")}</p>}
      {report.missing.length > 0 && (
        <div className="flex min-h-0 flex-col gap-2">
          {report.folded && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls="octave-import-skipped"
              onClick={() => setOpen((v) => !v)}
              className="flex min-h-[44px] cursor-pointer items-center gap-1.5 self-start rounded-lg px-1 text-sm font-semibold text-content-secondary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden />
              {t(open ? "report.hide" : "report.show")}
            </button>
          )}
          {listed && (
            <ol id="octave-import-skipped" className="min-h-0 overflow-y-auto overscroll-contain rounded-xl bg-fill-subtle px-3 py-2 text-sm">
              {report.missing.map((track) => (
                <li key={track.index} className="flex gap-2 py-1.5">
                  <span className="w-8 shrink-0 text-right tabular-nums text-content-quaternary">{track.index + 1}</span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-content-primary">
                      {track.title}
                      {track.artists.length > 0 && <span className="text-content-tertiary"> · {track.artists.join(", ")}</span>}
                    </span>
                    <span className="text-xs text-content-tertiary">{t(`report.reason.${track.reason}`)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </>
  );
}

export function ImportResult({ titleId, state, onOpen, onAnother, onClose }: Props) {
  const { t } = useTranslation("musicImport");
  const summary = state.summary;

  if (!summary) {
    return (
      <div className="flex flex-col gap-4">
        <h2 id={titleId} className="flex items-center gap-2 text-lg font-bold tracking-tight text-content-primary">
          <AlertCircle className="h-5 w-5 text-amber-300" aria-hidden />
          {t("title")}
        </h2>
        <p className="text-sm text-content-secondary" role="alert">
          {t(`failure.${state.failure ?? "network"}`)}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${BUTTON} text-content-tertiary hover:text-content-primary`}>
            {t("close")}
          </button>
          <button type="button" autoFocus onClick={onAnother} className={`${BUTTON} octave-brand-fill`}>
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-h-[70vh] flex-col gap-4">
      <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
        {t("doneTitle", { name: summary.name })}
      </h2>
      <ReportBody summary={summary} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onAnother} className={`${BUTTON} text-content-tertiary hover:text-content-primary`}>
          {t("another")}
        </button>
        <button type="button" autoFocus onClick={() => onOpen(summary.playlistId)} className={`${BUTTON} octave-brand-fill`}>
          {t("open")}
        </button>
      </div>
    </div>
  );
}
