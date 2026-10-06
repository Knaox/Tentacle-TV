import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CopyBlock } from "../remoteAccess/CopyBlock";
import { COMPOSE_SERVICE, NATIVE_TOKEN_COMMAND, TOKEN_COMMAND, type CodeHelpCommands, type CodeHelpTab } from "./codeHelpModel";

/**
 * Le contenu de chaque onglet de « Où trouver le code ? » : des étapes
 * numérotées pour les interfaces (Portainer, NAS), des commandes à copier pour
 * le terminal. Les mots restent ceux d'un utilisateur qui ne connaît pas Docker.
 */
interface PanelProps {
  tab: CodeHelpTab;
  commands: CodeHelpCommands;
  /** L'identifiant court du conteneur, s'il est connu. */
  containerId: string | null;
}

const mono = "rounded bg-fill-subtle px-1.5 py-0.5 font-mono text-[0.8125rem] text-content-primary";

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-[var(--brand-light)]">{children}</ol>;
}

export function CodeHelpPanel({ tab, commands, containerId }: PanelProps) {
  const { t } = useTranslation("setupWizard");
  const pick = containerId ? t("codeHelp_pickContainerId", { id: containerId }) : t("codeHelp_pickContainer");
  const consoleBlock = <CopyBlock label={t("codeHelp_typeThis")} code={TOKEN_COMMAND} />;

  switch (tab) {
    case "docker":
      return (
        <div className="space-y-3">
          <p>{t("codeHelp_dockerIntro")}</p>
          <CopyBlock label={t("codeWhereLogs")} code={commands.dockerLogs} />
          <CopyBlock label={t("codeWhereNew")} code={commands.dockerToken} />
          <p className="text-xs text-content-tertiary">
            {containerId ? t("codeHelp_dockerIdKnown") : t("codeHelp_dockerIdUnknown")} {t("codeHelp_podman")}
          </p>
        </div>
      );
    case "portainer":
      return (
        <div className="space-y-3">
          <Steps>
            <li>{t("codeHelp_portainerStep1")}</li>
            <li>{pick}</li>
            <li>{t("codeHelp_portainerStep3")}</li>
          </Steps>
          <p>{t("codeHelp_portainerConsole")}</p>
          {consoleBlock}
        </div>
      );
    case "compose":
      return (
        <div className="space-y-3">
          <p>{t("codeHelp_composeIntro")}</p>
          <CopyBlock label={t("codeWhereLogs")} code={commands.composeLogs} />
          <CopyBlock label={t("codeWhereNew")} code={commands.composeToken} />
          <p className="text-xs text-content-tertiary">
            {t("codeHelp_composeService", { service: COMPOSE_SERVICE })}
          </p>
        </div>
      );
    case "nas":
      return (
        <div className="space-y-3">
          <Steps>
            <li>{t("codeHelp_nasStep1")}</li>
            <li>{pick}</li>
            <li>{t("codeHelp_nasStep3")}</li>
          </Steps>
          <p>{t("codeHelp_nasConsole")}</p>
          {consoleBlock}
          <p className="text-xs text-content-tertiary">{t("codeHelp_nasExamples")}</p>
        </div>
      );
    case "native":
      return (
        <div className="space-y-3">
          <p>{t("codeHelp_nativeIntro")}</p>
          <CopyBlock label={t("codeWhereNew")} code={NATIVE_TOKEN_COMMAND} />
        </div>
      );
  }
}

/** Ce à quoi ressemble la ligne du code dans un journal. */
export function CodeLineHint() {
  const { t } = useTranslation("setupWizard");
  return (
    <p>
      {t("codeHelp_lookFor")} <span className={`${mono} mt-1 block w-fit max-w-full break-words`}>setup code / code d&apos;installation : XXXX-XXXX-XXXX</span>
    </p>
  );
}
