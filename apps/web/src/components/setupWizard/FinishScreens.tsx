import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { APP_LINKS, packagedHelpKey, remoteVerdict, type SetupCompleteResponse } from "@tentacle-tv/shared";
import { RemoteAccessPanel } from "../remoteAccess/RemoteAccessPanel";
import { useRemoteAccess } from "../remoteAccess/remoteAccessApi";
import { QrCode } from "./QrCode";
import type { Wizard } from "./useWizard";
import { contentFolders } from "./addContentModel";
import { AddContentTutorial } from "./AddContentTutorial";
import { WizardFrame } from "./WizardFrame";

/** L'accès à distance, facultatif : le même panneau que dans l'administration. La session est ouverte, ses appels passent. */
export function RemoteScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  return (
    <WizardFrame
      wizard={wizard}
      title={t("remoteTitle")}
      subtitle={t("remoteSubtitle")}
      layout="wide"
      bare
      primary={{ label: t("next"), onClick: wizard.next }}
      secondary={[{ label: t("remoteSkip"), onClick: wizard.next }]}
    >
      <RemoteAccessPanel variant="wizard" />
    </WizardFrame>
  );
}

type RemoteSummary = "secure" | "exposed" | "unverified" | "off";

function useRemoteSummary(): { summary: RemoteSummary; publicUrl: string | null; localUrl: string | null } {
  const { data } = useRemoteAccess();
  if (!data || !data.settings.enabled) return { summary: "off", publicUrl: data?.publicUrl ?? null, localUrl: data?.settings.localUrl ?? null };
  const tentacle = remoteVerdict(data.lastCheck).services.find((s) => s.service === "tentacle");
  const summary: RemoteSummary = tentacle?.state === "secure" ? "secure" : tentacle?.state === "exposed_http" ? "exposed" : "unverified";
  return { summary, publicUrl: data.publicUrl, localUrl: data.settings.localUrl };
}

/**
 * « Et maintenant ? » : où déposer les médias (à droite) ; le QR code du
 * serveur, les applications et l'état de l'accès à distance (à gauche).
 */
export function DoneScreen({ wizard, onFinish }: { wizard: Wizard; onFinish: (session: SetupCompleteResponse) => void }) {
  const { t } = useTranslation("setupWizard");
  const { summary, publicUrl, localUrl } = useRemoteSummary();
  const { data } = wizard;
  // Les bibliothèques créées (ou déjà là) : celles que l'installation a vraiment posées.
  const created = new Set((data.outcomes ?? []).filter((o) => o.status !== "failed").map((o) => o.name));
  const names = { movies: t("libraryDefaultMovies"), tvshows: t("libraryDefaultShows") };
  const folders = contentFolders({ context: data.context, plans: data.plans, existing: data.existing, created, names });
  const serverUrl = publicUrl ?? localUrl ?? window.location.origin;
  const session = data.session;

  const aside = (
    <>
      <section aria-labelledby="done-qr" className="flex flex-wrap items-center gap-5 rounded-xl border border-line-subtle bg-fill-faint p-4">
        <QrCode value={serverUrl} label={t("doneQrAlt", { url: serverUrl })} size={136} />
        <div className="min-w-0 flex-1 basis-40">
          <h2 id="done-qr" className="font-semibold text-content-primary">{t("doneQrTitle")}</h2>
          <p className="mt-1">{t("doneQrBody")}</p>
          <p className="mt-1.5 break-all font-mono text-xs text-content-tertiary">{serverUrl}</p>
        </div>
      </section>

      <section aria-labelledby="done-apps">
        <h2 id="done-apps" className="font-semibold text-content-primary">{t("doneAppsTitle")}</h2>
        <ul className="mt-2 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
          {APP_LINKS.map((app) => (
            <li key={app.platform}>
              <a href={app.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-line-subtle bg-fill-faint px-3 text-content-primary transition-colors hover:bg-fill-subtle">
                <span className="truncate">{t(`app_${app.platform}`)}</span>
                <ExternalLink size={14} aria-hidden="true" className="shrink-0 text-content-tertiary" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="done-remote">
        <h2 id="done-remote" className="font-semibold text-content-primary">{t("doneRemoteTitle")}</h2>
        <p className={`mt-1 ${summary === "exposed" ? "text-status-error-fg" : summary === "secure" ? "text-status-success-fg" : ""}`}>{t(`doneRemote_${summary}`)}</p>
      </section>

      {data.context?.webUi === false ? (
        <p role="note" className="rounded-xl border border-line-subtle bg-fill-faint px-4 py-3 text-content-secondary">
          {t(packagedHelpKey("setupWizard", "doneWebUiOff", data.context?.packaging))}
        </p>
      ) : null}
    </>
  );

  return (
    <WizardFrame
      wizard={wizard}
      title={t("doneTitle")}
      subtitle={t("doneSubtitle")}
      aside={aside}
      primary={{ label: t("doneOpen"), onClick: () => session && onFinish(session), disabled: !session }}
    >
      <div className="text-sm leading-relaxed text-content-secondary">
        <AddContentTutorial folders={folders} />
      </div>
    </WizardFrame>
  );
}
