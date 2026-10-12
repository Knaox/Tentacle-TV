import { useTranslation } from "react-i18next";
import type { JellyfinProbeResult, SetupSelection } from "@tentacle-tv/shared";
import { AdminNotice } from "../admin/kit";
import { JellyfinInstallSteps } from "./JellyfinInstallSteps";
import type { ServerState } from "./jellyfinChoice";
import type { LocalJellyfinView } from "./localJellyfinModel";

interface Props {
  /** Le Jellyfin coché, s'il y en a un, et ce qu'il est. */
  chosen: JellyfinProbeResult | null;
  state: ServerState | null;
  /** Le parcours tient déjà un AUTRE Jellyfin : en choisir un autre l'oublie. */
  previous: SetupSelection | null;
  /** Le Jellyfin de CE PC (app Windows) ; `null` sans hôte qui le gère. */
  local: LocalJellyfinView | null;
}

/**
 * La colonne de GAUCHE de l'écran Jellyfin, jamais vide : pendant (ou avant)
 * l'installation guidée, ses trois étapes et ses consignes ; un Jellyfin
 * coché, ce que ce choix entraîne et ses mises en garde ; sinon, la
 * différence entre un Jellyfin neuf et un Jellyfin déjà configuré — ce que
 * la liste distingue.
 */
export function JellyfinStepAside({ chosen, state, previous, local }: Props) {
  const { t } = useTranslation("setupWizard");
  if (!chosen && local?.kind === "install") return <JellyfinInstallSteps stage={local.progress.stage} />;
  if (!chosen && local?.kind === "installOffer") return <JellyfinInstallSteps stage={null} />;
  if (chosen && state) {
    return (
      <>
        <p aria-live="polite" className="text-content-primary">
          {state === "blank" ? t("jfNextBlank") : t("jfNextConfigured")}
        </p>
        {chosen.inStack && state === "configured" ? <AdminNotice tone="warning">{t("jfStackConfigured")}</AdminNotice> : null}
        {previous ? <AdminNotice tone="info">{t("jfChangeNotice", { name: previous.serverName || t("jfUnnamed") })}</AdminNotice> : null}
      </>
    );
  }
  return (
    <div className="space-y-3" data-testid="jellyfin-kinds">
      <p className="font-semibold text-content-primary">{t("jfKindsTitle")}</p>
      <ul className="space-y-3 border-l-2 border-line-subtle pl-4">
        <li>{t("jfNextBlank")}</li>
        <li>{t("jfNextConfigured")}</li>
      </ul>
    </div>
  );
}
