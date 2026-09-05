import { useTranslation } from "react-i18next";

interface UpdateVersionBannerProps {
  from: string;
  to?: string;
  channelLabel: string;
}

/**
 * Le bandeau « 1.20.11 → 1.21.0 » : la version installée en pastille neutre, la
 * nouvelle en dégradé de marque, le canal en puce. Rien n'y bouge — il est là
 * dans toutes les phases, c'est le repère fixe de la pop-up.
 */
export function UpdateVersionBanner({ from, to, channelLabel }: UpdateVersionBannerProps) {
  const { t } = useTranslation("notifications");
  const label = to
    ? t("notifications:updateVersionLine", { from, to })
    : `${t("notifications:updateCurrentVersion")} ${from}`;
  return (
    <div
      role="group"
      aria-label={label}
      className="relative isolate flex items-center gap-3 overflow-hidden rounded-[var(--radius-lg)] border border-line-subtle bg-fill-subtle px-4 py-3"
    >
      {/* Lueur de marque, statique : un dégradé peint une fois, jamais animé. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-[var(--brand-soft)] via-transparent to-transparent"
      />
      <SparkleIcon />
      <div aria-hidden className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="rounded-full bg-fill-soft px-3 py-1 text-sm font-semibold tabular-nums text-content-secondary">
          {from}
        </span>
        {to && (
          <>
            <ArrowIcon />
            <span className="rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] px-3 py-1 text-sm font-bold tabular-nums text-cta-brand-fg shadow-[0_2px_10px_rgba(var(--brand-rgb),0.4)]">
              {to}
            </span>
          </>
        )}
      </div>
      <span
        aria-hidden
        className="flex-shrink-0 rounded-full border border-[rgba(var(--brand-rgb),0.5)] bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand)]"
      >
        {channelLabel}
      </span>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 flex-shrink-0" aria-hidden>
      <path
        d="M11 2c.6 4.6 2.7 6.7 7.3 7.3C13.7 9.9 11.6 12 11 16.6c-.6-4.6-2.7-6.7-7.3-7.3C8.3 8.7 10.4 6.6 11 2z"
        className="text-[var(--brand)]"
        fill="currentColor"
      />
      <path
        d="M18.5 14c.3 2.1 1.3 3.1 3.5 3.5-2.2.3-3.2 1.3-3.5 3.5-.3-2.2-1.3-3.2-3.5-3.5 2.2-.4 3.2-1.4 3.5-3.5z"
        className="text-[var(--brand-accent)]"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 flex-shrink-0 text-content-quaternary"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
