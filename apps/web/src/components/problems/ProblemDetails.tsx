import { memo, useEffect, useId, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

export type ProblemTone = "player" | "page";

/** Le temps de lire « Copié » avant que le bouton ne redise « Copier ». */
const COPIED_MS = 2000;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Les détails techniques, repliés : un mot pour les ouvrir, les lignes en
 * petit (sélectionnables), et « Copier » — la trace à transmettre à
 * l'administrateur. Jamais un jeton : le modèle les a masqués. Ton `player` :
 * toujours sombre, sur l'image du titre ; ton `page` : celui du thème.
 */
export const ProblemDetails = memo(function ProblemDetails({ lines, copy, tone, center = false }: {
  lines: string[];
  copy: string;
  tone: ProblemTone;
  center?: boolean;
}) {
  const { t } = useTranslation("errors");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelId = useId();
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  if (lines.length === 0) return null;
  const player = tone === "player";
  const muted = player ? "text-white/55 hover:text-white/80" : "text-content-tertiary hover:text-content-secondary";
  const body = player ? "text-white/75" : "text-content-secondary";
  const box = player ? "border-white/15 bg-white/[0.06]" : "border-line-subtle bg-fill-subtle";
  return (
    <div className={`flex w-full flex-col ${center ? "items-center" : "items-start"}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`inline-flex min-h-11 cursor-pointer items-center gap-1 text-[13px] font-medium transition-colors ${muted}`}
      >
        {open ? t("detailsHide") : t("details")}
        <ChevronDown size={14} aria-hidden className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id={panelId} className={`w-full max-w-xl rounded-lg border p-3 text-left ${box}`}>
          {lines.map((line, index) => (
            <p key={index} className={`select-text break-words text-xs leading-[17px] tabular-nums ${body}`}>{line}</p>
          ))}
          <button
            type="button"
            onClick={() => void copyText(copy).then((ok) => ok && setCopied(true))}
            className={`mt-2 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors ${box} ${body} hover:brightness-125`}
          >
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            <span aria-live="polite">{copied ? t("detailsCopied") : t("copyDetails")}</span>
          </button>
        </div>
      )}
    </div>
  );
});
