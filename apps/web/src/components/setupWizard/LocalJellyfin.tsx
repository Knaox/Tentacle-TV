import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { JELLYFIN_WINDOWS_DOWNLOAD_URL } from "@tentacle-tv/shared";
import { cls } from "../../pages/adminUtils";
import { localJellyfinView } from "./localJellyfinModel";
import { SetupErrorLine } from "./SetupErrorLine";
import { useLocalJellyfin } from "./useLocalJellyfin";

const linkCls = "inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-content-primary underline underline-offset-4 hover:opacity-80";
const panelCls = "space-y-3 rounded-xl border border-line-subtle bg-fill-faint p-4 text-sm leading-relaxed text-content-secondary";

function OfficialPage({ url }: { url: string }) {
  const { t } = useTranslation("setupWizard");
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={linkCls}>
      {t("installOpenSite")}
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}

/**
 * L'app Windows : le Jellyfin de CE PC, dit en clair au-dessus de la liste.
 * Arrêté, « Démarrer Jellyfin » (installation simple) ou le renvoi vers
 * Services ; absent, l'installation guidée — l'installateur officiel,
 * téléchargé et vérifié par l'app, avec le conseil « Installation simple » —
 * ou la page officielle quand elle n'est pas possible. Dès qu'il répond, il
 * rejoint la liste (`onFound`) et ce panneau se tait.
 */
export function LocalJellyfin({ onFound }: { onFound: (url: string) => void }) {
  const { t } = useTranslation("setupWizard");
  const host = useLocalJellyfin(onFound);
  const view = localJellyfinView(host.local, host.install);
  const docsUrl = host.local?.docsUrl ?? JELLYFIN_WINDOWS_DOWNLOAD_URL;
  if (view.kind === "running") return null;

  return (
    <section className={panelCls} aria-live="polite">
      {view.kind === "checking" ? <p className="text-content-tertiary">{t("localChecking")}</p> : null}

      {view.kind === "stoppedTray" ? (
        <>
          <p className="font-semibold text-content-primary">{t("localStoppedTray")}</p>
          {host.starting ? (
            <p>{t("localStartWaiting")}</p>
          ) : (
            <button type="button" onClick={() => void host.start()} disabled={host.busy} className={cls.bp}>
              {host.busy ? t("localStarting") : t("localStart")}
            </button>
          )}
          {host.startRefusal === "service" ? <p>{t("localStoppedService")}</p> : host.startRefusal ? <p>{t("localStartFailed")}</p> : null}
        </>
      ) : null}
      {view.kind === "stoppedService" ? <p>{t("localStoppedService")}</p> : null}
      {view.kind === "stoppedUnknown" ? <p>{t("localStoppedUnknown")}</p> : null}

      {view.kind === "installOffer" ? (
        <>
          <p className="font-semibold text-content-primary">{t("installTitle")}</p>
          <p>{t("installIntro")}</p>
          <p className="text-content-primary">{t("installAdvice")}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="button" onClick={() => void host.startInstall()} disabled={host.busy} className={cls.bp}>
              {t("installButton")}
            </button>
            <OfficialPage url={docsUrl} />
          </div>
        </>
      ) : null}

      {view.kind === "installing" ? (
        <>
          <p className="font-semibold text-content-primary">{t("installTitle")}</p>
          <p>{t(view.message.key, view.message.values)}</p>
          {view.message.key === "install_installing" ? <p className="text-content-primary">{t("installAdvice")}</p> : null}
        </>
      ) : null}

      {view.kind === "installFailed" ? (
        <>
          <p>{t(`installFailed_${view.failure}`)}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {view.failure === "unsupported_arch" || view.failure === "disabled" ? null : (
              <button type="button" onClick={() => void host.startInstall()} disabled={host.busy} className={cls.bs}>
                {t("installRetry")}
              </button>
            )}
            <OfficialPage url={docsUrl} />
          </div>
        </>
      ) : null}

      {view.kind === "manual" ? (
        <>
          <p>{t(`installFailed_${view.reason}`)}</p>
          <OfficialPage url={docsUrl} />
          <p className="text-xs text-content-tertiary">{t("jfMissingWaiting")}</p>
        </>
      ) : null}

      <SetupErrorLine code={host.error} onRetry={() => void host.refresh()} />
    </section>
  );
}
