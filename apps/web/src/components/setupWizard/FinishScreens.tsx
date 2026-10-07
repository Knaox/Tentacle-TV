import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { APP_LINKS, remoteVerdict, type SetupCompleteResponse } from "@tentacle-tv/shared";
import { cls } from "../../pages/adminUtils";
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
    <WizardFrame help={wizard} title={t("remoteTitle")} subtitle={t("remoteSubtitle")} position={wizard.position} total={wizard.total} width="full">
      <div className="space-y-6">
        <RemoteAccessPanel variant="wizard" />
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={wizard.next} className={`${cls.bp} w-full sm:w-auto`}>
            {t("next")}
          </button>
          <button type="button" onClick={wizard.next} className={`${cls.bs} w-full sm:w-auto`}>
            {t("remoteSkip")}
          </button>
        </div>
      </div>
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

/** « Et maintenant ? » : où déposer les médias, les applications, le QR code du serveur, l'état de l'accès à distance. */
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

  return (
    <WizardFrame help={wizard} title={t("doneTitle")} subtitle={t("doneSubtitle")} position={wizard.position} total={wizard.total}>
      <div className="space-y-6 text-sm leading-relaxed text-content-secondary">
        <AddContentTutorial folders={folders} />

        <section aria-labelledby="done-qr" className="flex flex-wrap items-center gap-5">
          <QrCode value={serverUrl} label={t("doneQrAlt", { url: serverUrl })} />
          <div className="min-w-0 flex-1 basis-48">
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

        <button type="button" onClick={() => session && onFinish(session)} disabled={!session} className={`${cls.bp} w-full sm:w-auto`}>
          {t("doneOpen")}
        </button>
      </div>
    </WizardFrame>
  );
}
