import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { useServerCapability } from "@tentacle-tv/api-client";
import { REMOTE_ACCESS_GUIDE_ANCHOR, type PublicIpReport, type RemoteAccessSettingsPatch, type RemoteAccessState } from "@tentacle-tv/shared";
import { AdminSection } from "../admin/kit";
import { CheckStep } from "./CheckStep";
import { ExposureModes } from "./ExposureModes";
import { LanAddressField } from "./LanAddressField";
import { PlanB } from "./PlanB";
import { PortsStep } from "./PortsStep";
import { ProxyChoice } from "./ProxyChoice";
import { ProxyConfig } from "./ProxyConfig";
import { PublicIpCard } from "./PublicIpCard";
import { PublicLinkStep } from "./PublicLinkStep";
import { RemoteAccessGuide } from "./RemoteAccessGuide";
import { SecurityNotes } from "./SecurityNotes";

/** Les ancres qui visent ce qu'il contient l'ouvrent d'emblée (`/admin/remote-access#proxy`, `#guide` : le guide écrit). */
const GUIDE_ANCHORS = new Set(["#learn-more", "#proxy", "#ports", "#check", `#${REMOTE_ACCESS_GUIDE_ANCHOR}`]);

interface RemoteGuideProps {
  state: RemoteAccessState;
  publicIp: { report: PublicIpReport | undefined; loading: boolean };
  save: (patch: RemoteAccessSettingsPatch) => Promise<unknown>;
  variant: "admin" | "wizard";
  onOpenChange: (open: boolean) => void;
}

/**
 * « En savoir plus » : tout ce qui n'est PAS à régler — comment ça marche, le
 * mandataire (choisi seulement pour obtenir son exemple de configuration), les
 * ports de la box, la vérification depuis Internet, le plan B, la sécurité —
 * et, dans l'administration, le guide écrit.
 * Replié par défaut et monté à la demande : rien n'y est exigé, rien n'y
 * coûte tant qu'on ne l'ouvre pas.
 */
export function RemoteGuide({ state, publicIp, save, variant, onOpenChange }: RemoteGuideProps) {
  const { t } = useTranslation("remoteAccess");
  const exposure = useServerCapability("admin.remoteExposure");
  const [open, setOpen] = useState(() => GUIDE_ANCHORS.has(window.location.hash));
  const id = useId();
  const ip = publicIp.report?.v4 ?? publicIp.report?.v6 ?? null;
  const toggle = () => {
    setOpen(!open);
    onOpenChange(!open);
  };

  return (
    <section id="learn-more" className="scroll-mt-24">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-line-subtle bg-fill-faint px-5 py-3 text-left text-sm font-semibold text-content-primary transition-colors duration-150 hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        {t("moreLabel")}
        <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-content-tertiary transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={id} hidden={!open} className="mt-4 space-y-6">
        {open ? (
          <>
            <p className="text-sm leading-relaxed text-content-tertiary">{t("moreIntro")}</p>
            <ExposureModes current={state.publicUrl ? "public" : "private"} ip={ip} />
            <AdminSection id="proxy" title={t("proxyTitle")} description={t("proxyDescription")}>
              <div className="space-y-5">
                <div className="space-y-1 text-sm leading-relaxed text-content-secondary">
                  <p>{t("proxyWhat")}</p>
                  <p className="font-medium text-content-primary">{t("proxyNotIncluded")}</p>
                </div>
                <ProxyChoice value={state.settings.proxy} onChange={(proxy) => void save({ proxy })} />
                {state.settings.proxy === "none" ? <PublicLinkStep state={state} publicIp={ip} /> : <ProxyConfig key={state.settings.proxy} state={state} />}
              </div>
            </AdminSection>
            <AdminSection id="ports" title={t("portsSectionTitle")} description={t("portsSectionDescription")}>
              <div className="space-y-6">
                <LanAddressField state={state} save={save} />
                <PortsStep state={state} save={save} />
              </div>
            </AdminSection>
            <AdminSection id="check" title={t("checkSectionTitle")} description={t("step3Description")}>
              <div className="space-y-5">
                {exposure ? <PublicIpCard state={state} report={publicIp.report} loading={publicIp.loading} /> : null}
                <CheckStep state={state} />
              </div>
            </AdminSection>
            <PlanB showGuideLink={variant === "admin"} />
            <SecurityNotes />
            {variant === "admin" ? <RemoteAccessGuide /> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
