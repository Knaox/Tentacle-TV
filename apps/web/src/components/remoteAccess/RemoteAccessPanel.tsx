import { useTranslation } from "react-i18next";
import { AdminNotice, AdminSection } from "../admin/kit";
import { SectionError, SectionSkeleton } from "../admin/services/SectionParts";
import { ToggleSwitch } from "../settings/ToggleSwitch";
import { CheckStep } from "./CheckStep";
import { isLocalHttp } from "./lanAddress";
import { PlanB } from "./PlanB";
import { PortsStep } from "./PortsStep";
import { ProxyChoice } from "./ProxyChoice";
import { ProxyConfig } from "./ProxyConfig";
import { RemoteAccessGuide } from "./RemoteAccessGuide";
import { useRemoteAccess, useSaveRemoteAccess } from "./remoteAccessApi";
import { StepSection } from "./StepSection";

/**
 * L'accès à distance, de bout en bout — le MÊME composant pour la section
 * d'administration (`variant="admin"` : interrupteur, puis le guide au pied)
 * et pour l'étape facultative de l'assistant d'installation (`"wizard"` : les
 * trois étapes seules). Trois étapes dans l'ordre où on les fait : ce qui
 * reçoit Internet, les ports de la box, la vérification depuis l'extérieur.
 */
export function RemoteAccessPanel({ variant = "admin" }: { variant?: "admin" | "wizard" }) {
  const { t } = useTranslation("remoteAccess");
  const query = useRemoteAccess();
  // `mutateAsync` est stable d'un rendu à l'autre : les étapes ne se redessinent pas pour rien.
  const { mutateAsync: save } = useSaveRemoteAccess();

  if (query.isPending) {
    return (
      <AdminSection>
        <SectionSkeleton lines={4} />
      </AdminSection>
    );
  }
  if (query.isError || !query.data) {
    return (
      <AdminSection>
        <SectionError onRetry={() => void query.refetch()} />
      </AdminSection>
    );
  }

  const state = query.data;
  const open = variant === "wizard" || state.settings.enabled;

  return (
    <>
      {variant === "admin" ? (
        <AdminSection>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-semibold text-content-primary">{t("switchLabel")}</p>
              <p className="mt-1 text-sm leading-relaxed text-content-tertiary">{open ? t("enabledHint") : t("disabledHint")}</p>
            </div>
            <ToggleSwitch checked={state.settings.enabled} onChange={(enabled) => void save({ enabled })} label={t("switchLabel")} />
          </div>
        </AdminSection>
      ) : null}

      {open ? (
        <>
          {isLocalHttp() ? <AdminNotice tone="info">{t("localHttpNotice")}</AdminNotice> : null}
          <StepSection n={1} id="proxy" title={t("step1Title")} description={t("step1Description")}>
            <div className="space-y-5">
              <ProxyChoice value={state.settings.proxy} onChange={(proxy) => void save({ proxy })} />
              <ProxyConfig key={state.settings.proxy} state={state} />
            </div>
          </StepSection>
          <StepSection n={2} id="ports" title={t("step2Title")} description={t("step2Description")}>
            <PortsStep state={state} save={save} />
          </StepSection>
          <StepSection n={3} id="check" title={t("step3Title")} description={t("step3Description")}>
            <CheckStep state={state} />
          </StepSection>
          <PlanB showGuideLink={variant === "admin"} />
        </>
      ) : null}

      {variant === "admin" ? <RemoteAccessGuide /> : null}
    </>
  );
}
