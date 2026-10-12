import { useTranslation } from "react-i18next";
import { CircleCheck, ExternalLink, LoaderCircle } from "lucide-react";
import { JELLYFIN_WINDOWS_DOWNLOAD_URL } from "@tentacle-tv/shared";
import { cls } from "../../pages/adminUtils";
import { JellyfinInstallProgress } from "./JellyfinInstallProgress";
import type { LocalJellyfinView } from "./localJellyfinModel";
import { SetupErrorLine } from "./SetupErrorLine";
import type { LocalJellyfin as LocalJellyfinHost } from "./useLocalJellyfin";

const linkCls = "inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-content-primary underline underline-offset-4 hover:opacity-80";
const panelCls = "space-y-3 rounded-xl border bg-fill-faint p-4 text-sm leading-relaxed text-content-secondary";
const titleCls = "font-semibold text-content-primary";

function OfficialPage({ url }: { url: string }) {
  const { t } = useTranslation("setupWizard");
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={linkCls}>
      {t("installOpenSite")}
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}

/** « Démarrer Jellyfin » (installation simple arrêtée) ; `afterInstall` : il vient d'être installé et se tait encore. */
function StoppedTray({ host, afterInstall }: { host: LocalJellyfinHost; afterInstall: boolean }) {
  const { t } = useTranslation("setupWizard");
  return (
    <>
      <p className={titleCls}>{t(afterInstall ? "installLateTitle" : "localStoppedTray")}</p>
      <p>{t("localStartHint")}</p>
      <button type="button" onClick={() => void host.start()} disabled={host.busy} className={cls.bp}>
        {host.busy ? t("localStarting") : t("localStart")}
      </button>
      {host.startRefusal ? <p>{t("localStartFailed")}</p> : null}
    </>
  );
}

/** Relancer l'installation guidée, et la page officielle en repli. */
function RetryRow({ host, docsUrl, retry }: { host: LocalJellyfinHost; docsUrl: string; retry: boolean }) {
  const { t } = useTranslation("setupWizard");
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {retry ? (
        <button type="button" onClick={() => void host.startInstall()} disabled={host.busy} className={cls.bs}>
          {t("installRetry")}
        </button>
      ) : null}
      <OfficialPage url={docsUrl} />
    </div>
  );
}

function ViewBody({ view, host, docsUrl }: { view: LocalJellyfinView; host: LocalJellyfinHost; docsUrl: string }) {
  const { t } = useTranslation("setupWizard");
  switch (view.kind) {
    case "running":
      return null;
    case "checking":
      return <p className="text-content-tertiary">{t("localChecking")}</p>;
    case "ready":
      return (
        <div className="flex items-start gap-3">
          <CircleCheck size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-status-success-fg" />
          <div className="space-y-1">
            <p className={`text-base ${titleCls}`}>{t("installReadyTitle")}</p>
            <p>{t("installReadyBody")}</p>
          </div>
        </div>
      );
    case "install":
      return <JellyfinInstallProgress progress={view.progress} />;
    case "starting":
      return (
        <div className="flex items-start gap-3">
          <LoaderCircle size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--brand-light)] motion-safe:animate-spin" />
          <div className="space-y-1">
            <p className={titleCls}>{t("localStarting")}</p>
            <p>{t("localStartWaiting")}</p>
          </div>
        </div>
      );
    case "stoppedTray":
      return <StoppedTray host={host} afterInstall={view.afterInstall} />;
    case "stoppedService":
      return (
        <>
          <p>{t("localStoppedService")}</p>
          <button type="button" onClick={() => void host.start()} disabled={host.busy} className={cls.bs}>
            {t("localOpenServices")}
          </button>
        </>
      );
    case "stoppedUnknown":
      return <p>{t("localStoppedUnknown")}</p>;
    case "installOffer":
      return (
        <>
          <p className={titleCls}>{t("installTitle")}</p>
          <p>{t("installIntro")}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="button" onClick={() => void host.startInstall()} disabled={host.busy} className={cls.bp}>
              {t("installButton")}
            </button>
            <OfficialPage url={docsUrl} />
          </div>
        </>
      );
    case "installFailed": {
      const cancelled = view.failure === "cancelled";
      return (
        <>
          {cancelled ? <p className={titleCls}>{t("installCancelledTitle")}</p> : null}
          <p>{t(`installFailed_${view.failure}`)}</p>
          {cancelled ? <p className="text-xs text-content-tertiary">{t("installCancelledFound")}</p> : null}
          <RetryRow host={host} docsUrl={docsUrl} retry={view.failure !== "unsupported_arch" && view.failure !== "disabled"} />
        </>
      );
    }
    case "installedNotFound":
      return (
        <>
          <p className={titleCls}>{t("installNotFoundTitle")}</p>
          <p>{t("installNotFoundBody")}</p>
          <RetryRow host={host} docsUrl={docsUrl} retry />
        </>
      );
    case "manual":
      return (
        <>
          <p>{t(`installFailed_${view.reason}`)}</p>
          <OfficialPage url={docsUrl} />
          <p className="text-xs text-content-tertiary">{t("jfMissingWaiting")}</p>
        </>
      );
  }
}

/** Un état qui demande l'attention (installation en cours, prêt) se voit : bordure de marque. */
function emphasized(view: LocalJellyfinView): boolean {
  return view.kind === "install" || view.kind === "ready" || view.kind === "starting";
}

/**
 * L'app Windows : le Jellyfin de CE PC, dit en clair au-dessus de la liste.
 * Arrêté, « Démarrer Jellyfin » (installation simple) ou le renvoi vers
 * Services ; absent, l'installation guidée — l'installateur officiel,
 * téléchargé et vérifié par l'app, dont l'ÉTAT se dit ici
 * (`JellyfinInstallProgress`) et les étapes à gauche (`JellyfinInstallSteps`)
 * — ou la page officielle quand elle n'est pas possible. L'hôte est suivi par
 * l'écran (`useLocalJellyfin`, qui en tire aussi le pied et ce qui se tait) ;
 * installé ici, le panneau le dit d'abord, sinon il se tait.
 */
export function LocalJellyfin({ host, view }: { host: LocalJellyfinHost; view: LocalJellyfinView }) {
  const docsUrl = host.local?.docsUrl ?? JELLYFIN_WINDOWS_DOWNLOAD_URL;
  if (view.kind === "running") return null;
  const border = emphasized(view) ? "border-[rgba(var(--brand-rgb),0.45)]" : "border-line-subtle";

  return (
    <section className={`${panelCls} ${border}`} aria-live="polite">
      <ViewBody view={view} host={host} docsUrl={docsUrl} />
      <SetupErrorLine code={host.error} onRetry={() => void host.refresh()} />
    </section>
  );
}
