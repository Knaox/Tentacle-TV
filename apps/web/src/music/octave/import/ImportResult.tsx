/**
 * Octave — la fin d'un import : ce qui est entré (bibliothèque, hors
 * bibliothèque), ce qui manque (liste repliée), une source lue en partie, et
 * « Ouvrir la playlist ». Ou l'échec, en mots, avec « Réessayer ».
 */

import { useState } from "react";
import { AlertCircle, ChevronDown, CloudCheck, Library, SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ImportFlowState } from "@tentacle-tv/api-client";

const BUTTON = "min-h-[44px] cursor-pointer rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus";

interface Props {
  titleId: string;
  state: ImportFlowState;
  onOpen: (playlistId: string) => void;
  onAnother: () => void;
  onClose: () => void;
}

function Line({ icon: Icon, text, muted = false }: { icon: typeof Library; text: string; muted?: boolean }) {
  return (
    <li className={`flex items-center gap-3 text-sm ${muted ? "text-content-tertiary" : "text-content-primary"}`}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {text}
    </li>
  );
}

export function ImportResult({ titleId, state, onOpen, onAnother, onClose }: Props) {
  const { t } = useTranslation("musicImport");
  const [showMissing, setShowMissing] = useState(false);
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

  const missing = summary.missing;
  return (
    <div className="flex max-h-[70vh] flex-col gap-4">
      <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">
        {t("doneTitle", { name: summary.name })}
      </h2>
      <ul className="flex flex-col gap-2">
        <Line icon={Library} text={t("inLibrary", { count: summary.inLibrary })} />
        {summary.outside > 0 && <Line icon={CloudCheck} text={t("outside", { count: summary.outside })} />}
        {missing.length > 0 && <Line icon={SearchX} text={t("missing", { count: missing.length })} muted />}
      </ul>
      {summary.outsideRefused && <p className="text-xs text-amber-300">{t("outsideRefused")}</p>}
      {summary.truncated && <p className="text-xs text-content-tertiary">{t("truncated")}</p>}
      {missing.length > 0 && (
        <div className="flex min-h-0 flex-col gap-2">
          <button
            type="button"
            aria-expanded={showMissing}
            onClick={() => setShowMissing((v) => !v)}
            className="flex min-h-[36px] cursor-pointer items-center gap-1.5 self-start rounded-lg px-1 text-sm font-semibold text-content-secondary hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${showMissing ? "rotate-180" : ""}`} aria-hidden />
            {t(showMissing ? "missingHide" : "missingShow")}
          </button>
          {showMissing && (
            <>
              {summary.outside === 0 && <p className="text-xs text-content-tertiary">{t("missingNotAdded")}</p>}
              <ol className="min-h-0 overflow-y-auto overscroll-contain rounded-xl bg-fill-subtle px-3 py-2 text-sm">
                {missing.map((track) => (
                  <li key={track.index} className="flex gap-2 py-1">
                    <span className="w-8 shrink-0 text-right tabular-nums text-content-quaternary">{track.index + 1}</span>
                    <span className="min-w-0 truncate text-content-primary">
                      {track.title}
                      {track.artists.length > 0 && <span className="text-content-tertiary"> · {track.artists.join(", ")}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
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
