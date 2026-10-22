import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Ban, Clock, Lock, LogIn } from "lucide-react";
import type { AccountAccessPage as AccessPageState } from "@tentacle-tv/api-client";
import { accountAccessView, reopeningCopy, scheduleClock, type AccountAccessBlocked, type ScheduleLine } from "@tentacle-tv/shared";
import { AccessFrame } from "./AccessFrame";
import { useAccountAccessActions, type AccountAccessAction } from "./useAccountAccessActions";

/**
 * La page d'un compte BLOQUÉ, web et bureau (docs/DROITS-UTILISATEURS.md § 9.1) :
 * elle remplace l'application. Désactivé (ou bloqué après trop d'essais) : la
 * raison, et que Jellyfin a fermé ses sessions. Hors plage : les heures permises
 * en clair, dans la langue de l'interface, et l'heure de réouverture ; la page
 * se lève seule. Réactivé alors que la session de cet appareil est morte (jeton
 * révoqué par Jellyfin) : « Se reconnecter », jamais une app à moitié connectée.
 */

const ACTION_KEYS: Record<AccountAccessAction, string> = {
  switchProfile: "actions.switchProfile",
  signOut: "actions.signOut",
  changeServer: "actions.changeServer",
};

const ICONS = { disabled: Ban, lockedOut: Lock, outsideSchedule: Clock } as const;

type T = (key: string, options?: Record<string, unknown>) => string;

export function AccountAccessPage({ page }: { page: AccessPageState }) {
  const { t } = useTranslation("accountAccess");
  const { actions, run } = useAccountAccessActions();
  if (page.state === "reconnect") {
    return (
      <AccessFrame
        icon={LogIn}
        title={t("reconnect.title")}
        body={t("reconnect.body")}
        actions={[{ key: "reconnect", label: t("actions.reconnect"), onClick: () => run("signOut") }]}
      />
    );
  }
  return <BlockedPage blocked={page} actions={actions} run={run} t={t} />;
}

function BlockedPage({ blocked, actions, run, t }: {
  blocked: AccountAccessBlocked;
  actions: AccountAccessAction[];
  run: (action: AccountAccessAction) => void;
  t: T;
}) {
  const { i18n } = useTranslation();
  const view = useMemo(() => accountAccessView(blocked, Date.now()), [blocked]);
  const lang = i18n.language;
  const reopening = view.reopening ? reopeningCopy(view.reopening, lang) : null;
  return (
    <AccessFrame
      icon={ICONS[view.variant]}
      title={t(view.titleKey)}
      body={t(view.bodyKey)}
      actions={actions.map((action) => ({ key: action, label: t(ACTION_KEYS[action]), onClick: () => run(action) }))}
      footer={t(view.variant === "outsideSchedule" ? "footer" : "footerDisabled")}
    >
      {view.lines.length > 0 && <Schedules lines={view.lines} t={t} lang={lang} />}
      {reopening && <p className="mt-5 text-sm font-medium text-content-primary">{t(reopening.key, reopening.params)}</p>}
    </AccessFrame>
  );
}

function Schedules({ lines, t, lang }: { lines: ScheduleLine[]; t: T; lang: string }) {
  const clock = (minutes: number) => scheduleClock(minutes, lang) ?? t("midnight");
  return (
    <section
      aria-labelledby="account-access-hours"
      className="lg-content mt-8 w-full rounded-2xl border border-line-subtle bg-fill-subtle p-5 text-left backdrop-blur-md"
    >
      <h2 id="account-access-hours" className="text-xs font-semibold uppercase tracking-wider text-content-tertiary">
        {t("schedulesTitle")}
      </h2>
      <ul className="mt-3 space-y-2.5">
        {lines.map((line) => (
          <li key={`${line.day}-${line.start}-${line.end}`} className="flex items-baseline justify-between gap-4 text-sm">
            <span className="text-content-secondary">{t(`days.${line.day}`)}</span>
            <span className="font-medium tabular-nums text-content-primary">{t("range", { from: clock(line.start), to: clock(line.end) })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
