import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Ban, Clock, Lock } from "lucide-react";
import { accountAccessView, type AccountAccessBlocked, type Reopening, type ScheduleLine } from "@tentacle-tv/shared";
import { useAccountAccessActions, type AccountAccessAction } from "./useAccountAccessActions";

/**
 * La page d'un compte BLOQUÉ, web et bureau (docs/DROITS-UTILISATEURS.md § 9.1) :
 * elle remplace l'application. Désactivé (ou bloqué après trop d'essais) : la
 * raison. Hors plage : les heures permises en clair, dans la langue de
 * l'interface, et l'heure de réouverture. Une action principale (au focus dès
 * l'entrée), une secondaire au plus. Elle se lève seule à la réouverture.
 */

const ACTION_KEYS: Record<AccountAccessAction, string> = {
  switchProfile: "actions.switchProfile",
  signOut: "actions.signOut",
  changeServer: "actions.changeServer",
};

const ICONS = { disabled: Ban, lockedOut: Lock, outsideSchedule: Clock } as const;

export function AccountAccessPage({ blocked }: { blocked: AccountAccessBlocked }) {
  const { t, i18n } = useTranslation("accountAccess");
  const view = useMemo(() => accountAccessView(blocked, Date.now()), [blocked]);
  const { actions, run } = useAccountAccessActions();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const Icon = ICONS[view.variant];

  // Le focus entre sur l'action principale : le clavier n'a rien d'autre à atteindre.
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="account-access-title"
      aria-describedby="account-access-body"
      className="fixed inset-0 z-[1001] overflow-y-auto bg-surface-modal backdrop-blur-md motion-safe:[animation:fadeIn_0.4s_ease-out]"
    >
      <div className="flex min-h-full items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-lg flex-col items-center text-center">
          <div className="rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-accent)] p-px">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-modal">
              <Icon aria-hidden className="h-9 w-9 text-content-primary" strokeWidth={1.75} />
            </div>
          </div>
          <h1 id="account-access-title" className="mt-7 text-2xl font-bold leading-tight text-content-primary">
            {t(view.titleKey)}
          </h1>
          <p id="account-access-body" className="mt-3 max-w-md text-[15px] leading-relaxed text-content-secondary">
            {t(view.bodyKey)}
          </p>
          {view.lines.length > 0 && <Schedules lines={view.lines} t={t} lang={i18n.language} />}
          {view.reopening && (
            <p className="mt-5 text-sm font-medium text-content-primary">{reopeningText(view.reopening, t, i18n.language)}</p>
          )}
          <div className="mt-9 flex w-full flex-col items-center gap-3">
            {actions.map((action, index) => (
              <button
                key={action}
                ref={index === 0 ? primaryRef : undefined}
                type="button"
                onClick={() => run(action)}
                className={
                  index === 0
                    ? "inline-flex min-h-[44px] min-w-[240px] cursor-pointer items-center justify-center rounded-full bg-cta-primary-bg px-7 py-3 text-sm font-bold text-cta-primary-fg transition-transform duration-200 hover:scale-[1.03] hover:bg-cta-primary-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.98]"
                    : "inline-flex min-h-[44px] min-w-[240px] cursor-pointer items-center justify-center rounded-full border border-line-strong bg-fill-subtle px-7 py-3 text-sm font-semibold text-content-secondary backdrop-blur-md transition-transform duration-200 hover:scale-[1.03] hover:bg-fill-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] active:scale-[0.98]"
                }
              >
                {t(ACTION_KEYS[action])}
              </button>
            ))}
          </div>
          <p className="mt-9 text-xs leading-relaxed text-content-tertiary">
            {t(view.variant === "outsideSchedule" ? "footer" : "footerDisabled")}
          </p>
        </div>
      </div>
    </div>
  );
}

type T = (key: string, options?: Record<string, unknown>) => string;

function Schedules({ lines, t, lang }: { lines: ScheduleLine[]; t: T; lang: string }) {
  return (
    <section
      aria-labelledby="account-access-hours"
      className="mt-8 w-full rounded-2xl border border-line-subtle bg-fill-subtle p-5 text-left backdrop-blur-md"
    >
      <h2 id="account-access-hours" className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">
        {t("schedulesTitle")}
      </h2>
      <ul className="mt-3 space-y-2.5">
        {lines.map((line) => (
          <li key={`${line.day}-${line.start}-${line.end}`} className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-content-secondary">{t(`days.${line.day}`)}</span>
            <span className="font-medium tabular-nums text-content-primary">
              {t("range", { from: clock(line.start, t, lang), to: clock(line.end, t, lang) })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Une heure de la journée (minutes) dans la langue de l'interface ; 1440 = minuit. */
function clock(minutes: number, t: T, lang: string): string {
  if (minutes >= 1440) return t("midnight");
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return new Intl.DateTimeFormat(lang, { hour: "numeric", minute: "2-digit" }).format(date);
}

function reopeningText(reopening: Reopening, t: T, lang: string): string {
  if (reopening.kind === "never" || reopening.kind === "unknown") return t(`reopening.${reopening.kind}`);
  const time = new Intl.DateTimeFormat(lang, { hour: "numeric", minute: "2-digit" }).format(reopening.at);
  const day = new Intl.DateTimeFormat(lang, { weekday: "long" }).format(reopening.at);
  return t(`reopening.${reopening.kind}`, { time, day });
}
