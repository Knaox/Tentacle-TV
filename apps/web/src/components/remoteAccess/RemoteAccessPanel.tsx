import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerCapability } from "@tentacle-tv/api-client";
import { AdminNotice, AdminSection } from "../admin/kit";
import { SectionError, SectionSkeleton } from "../admin/services/SectionParts";
import { ToggleSwitch } from "../settings/ToggleSwitch";
import { CheckStep } from "./CheckStep";
import { DirectPlayRemote } from "./DirectPlayRemote";
import { ExposureModes } from "./ExposureModes";
import { guessLanUrl, isLocalHttp } from "./lanAddress";
import { LanAddressField } from "./LanAddressField";
import { PlanB } from "./PlanB";
import { PortsStep } from "./PortsStep";
import { ProxyChoice } from "./ProxyChoice";
import { ProxyConfig } from "./ProxyConfig";
import { PublicIpCard } from "./PublicIpCard";
import { PublicLinkStep } from "./PublicLinkStep";
import { RemoteAccessGuide } from "./RemoteAccessGuide";
import { usePublicIp, useRemoteAccess, useSaveRemoteAccess } from "./remoteAccessApi";
import { SecurityNotes } from "./SecurityNotes";
import { StepSection } from "./StepSection";

/**
 * L'accès à distance, de bout en bout — le MÊME composant pour la section
 * d'administration (`variant="admin"`, avec le guide au pied) et pour l'étape
 * facultative de l'assistant d'installation (`"wizard"`). Les mêmes règles
 * des deux côtés :
 *
 *  - privé ou public, en deux schémas, et l'adresse de ce serveur sur le
 *    réseau (pré-remplie, modifiable) ;
 *  - « Accès depuis l'extérieur », COUPÉ par défaut : rien n'est publié ;
 *  - allumé : l'adresse publique détectée et sa joignabilité, le mandataire
 *    (facultatif — « Sans mandataire » par défaut), les deux ports de la box,
 *    la lecture directe hors de la maison (facultative), la vérification.
 */
export function RemoteAccessPanel({ variant = "admin" }: { variant?: "admin" | "wizard" }) {
  const { t } = useTranslation("remoteAccess");
  const query = useRemoteAccess();
  // `mutateAsync` est stable d'un rendu à l'autre : les étapes ne se redessinent pas pour rien.
  const { mutateAsync: save } = useSaveRemoteAccess();
  const exposure = useServerCapability("admin.remoteExposure");
  const enabled = query.data?.settings.enabled ?? false;
  const publicIp = usePublicIp(exposure && enabled);
  const [switchFailed, setSwitchFailed] = useState(false);

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
  const ip = publicIp.data?.v4 ?? publicIp.data?.v6 ?? null;
  const toggle = async (next: boolean) => {
    setSwitchFailed(false);
    // Allumé sans adresse enregistrée : celle de cette page, proposée plus haut, devient la cible de la box.
    const guessed = next && !state.settings.localUrl ? guessLanUrl() : null;
    try {
      await save({ enabled: next, ...(guessed ? { localUrl: guessed } : {}) });
    } catch {
      setSwitchFailed(true);
    }
  };
  const total = exposure && state.directPlay ? 4 : 3;

  return (
    <>
      <ExposureModes current={enabled ? "public" : "private"} ip={ip} />
      <AdminSection title={t("lanAddress")}>
        <LanAddressField state={state} save={save} />
      </AdminSection>
      <AdminSection>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-content-primary">{t("switchLabel")}</p>
            <p className="mt-1 text-sm leading-relaxed text-content-tertiary">{enabled ? t("exposureOn") : t("exposureOff")}</p>
            {switchFailed ? (
              <p role="alert" className="mt-2 text-sm text-status-error-fg">
                {t("exposureSaveFailed")}
              </p>
            ) : null}
          </div>
          <ToggleSwitch checked={enabled} onChange={(next) => void toggle(next)} label={t("switchLabel")} />
        </div>
      </AdminSection>

      {enabled ? (
        <>
          {isLocalHttp() ? <AdminNotice tone="info">{t("localHttpNotice")}</AdminNotice> : null}
          {exposure ? (
            <AdminSection>
              <PublicIpCard state={state} report={publicIp.data} loading={publicIp.isPending} />
            </AdminSection>
          ) : null}
          <StepSection n={1} total={total} id="proxy" title={t("step1Title")} description={t("step1Description")}>
            <div className="space-y-5">
              <div className="space-y-1 text-sm leading-relaxed text-content-secondary">
                <p>{t("proxyWhat")}</p>
                <p className="font-medium text-content-primary">{t("proxyNotIncluded")}</p>
              </div>
              <ProxyChoice value={state.settings.proxy} onChange={(proxy) => void save({ proxy })} />
              {state.settings.proxy === "none" ? <PublicLinkStep state={state} publicIp={ip} /> : <ProxyConfig key={state.settings.proxy} state={state} />}
            </div>
          </StepSection>
          <StepSection n={2} total={total} id="ports" title={t("step2Title")} description={t("step2Description")}>
            <PortsStep state={state} save={save} />
          </StepSection>
          {exposure && state.directPlay ? (
            <StepSection n={3} total={total} id="direct" title={t("directTitle")} description={t("directDescription")}>
              <DirectPlayRemote key={state.directPlay.publicUrl ?? ""} state={state} directPlay={state.directPlay} publicIp={ip} />
            </StepSection>
          ) : null}
          <StepSection n={total} total={total} id="check" title={t("step3Title")} description={t("step3Description")}>
            <CheckStep state={state} />
          </StepSection>
          <PlanB showGuideLink={variant === "admin"} />
        </>
      ) : null}

      <SecurityNotes />
      {variant === "admin" ? <RemoteAccessGuide /> : null}
    </>
  );
}
