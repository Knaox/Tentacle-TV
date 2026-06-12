import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getImpersonationState, stopImpersonation } from "../lib/impersonation";

/**
 * Pill flottante affichée pendant une session d'impersonation admin —
 * rappel permanent "vous naviguez en tant que X" + sortie en un clic.
 * Bottom-center pour rester visible sans entrer en conflit avec la sidebar,
 * la tabbar mobile (d'où le bottom-20 en mobile) ou les contrôles du player.
 */
export function ImpersonationBanner() {
  // Lu une seule fois au mount : l'état ne change que via full reload
  // (startImpersonation / stopImpersonation font un location.assign).
  const [state] = useState(getImpersonationState);
  const [leaving, setLeaving] = useState(false);
  const { t } = useTranslation("common");

  if (!state) return null;

  const handleStop = async () => {
    setLeaving(true);
    try {
      await stopImpersonation();
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-20 z-[90] flex justify-center px-4 md:bottom-5"
    >
      <div
        className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-[var(--brand)]/40 bg-black/75 py-2 pl-4 pr-2 backdrop-blur-xl"
        style={{ boxShadow: "0 8px 32px rgba(var(--brand-rgb), 0.35)" }}
      >
        <span aria-hidden className="relative flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)]" />
        </span>
        <p className="truncate text-xs font-medium text-white/85 sm:text-sm">
          {t("impersonationActive", { name: state.targetName })}
        </p>
        <button
          onClick={handleStop}
          disabled={leaving}
          className="h-8 flex-shrink-0 rounded-full bg-white px-3.5 text-xs font-bold text-black transition hover:bg-white/90 disabled:opacity-50"
        >
          {leaving ? t("impersonationLeaving") : t("impersonationLeave")}
        </button>
      </div>
    </div>
  );
}
