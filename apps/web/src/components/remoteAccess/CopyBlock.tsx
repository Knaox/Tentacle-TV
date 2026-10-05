import { memo, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";

/**
 * Un bloc à copier (lignes de .env, commande, extrait de configuration) : le
 * texte en police à chasse fixe, défilant dans son cadre s'il est large — la
 * page, elle, ne défile jamais de côté —, et un bouton qui dit ce qu'il a fait.
 */
export const CopyBlock = memo(function CopyBlock({ label, code }: { label: string; code: string }) {
  const { t } = useTranslation("remoteAccess");
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
  }, [code]);

  return (
    <figure className="min-w-0">
      <figcaption className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-content-tertiary">{label}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-content-secondary transition-colors hover:bg-fill-subtle hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {state === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {state === "copied" ? t("copied") : t("copy")}
        </button>
      </figcaption>
      <pre className="max-h-80 overflow-auto rounded-lg border border-line-subtle bg-fill-subtle p-3 text-xs leading-relaxed text-content-secondary">
        <code>{code}</code>
      </pre>
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? t("copied") : state === "failed" ? t("copyFailed") : ""}
      </span>
      {state === "failed" ? <p className="mt-1.5 text-xs text-status-error-fg">{t("copyFailed")}</p> : null}
    </figure>
  );
});
