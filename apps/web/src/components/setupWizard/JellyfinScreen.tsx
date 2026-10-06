import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck } from "lucide-react";
import type { JellyfinProbeResult } from "@tentacle-tv/shared";
import { AdminNotice } from "../admin/kit";
import { cls } from "../../pages/adminUtils";
import { hostAndPort } from "./jellyfinChoice";
import { JellyfinPicker } from "./JellyfinPicker";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { WizardFrame } from "./WizardFrame";

/** Une nouvelle sonde toutes les quelques secondes, tant que le Jellyfin de la pile démarre. */
const POLL_MS = 4000;
const WAITING: ReadonlySet<WizardErrorCode> = new Set(["jf_unreachable", "jf_timeout", "jf_claim_pending", "jf_not_jellyfin", "network"]);

/**
 * Jellyfin, selon l'installation : celui de la pile complète (le seul
 * possible, verrouillé dès le démarrage), ou la liste des Jellyfin joignables
 * (pile sans Jellyfin, installation native). Vierge, il sera configuré ; déjà
 * configuré, on s'y connecte avec son compte administrateur.
 */
export function JellyfinScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const provisioner = wizard.data.context?.provisioner ?? "existing-instance";
  const subtitle =
    provisioner === "docker-sibling" ? t("jfSubtitleSibling") : provisioner === "native-host" ? t("jfSubtitleNative") : t("jfSubtitleExisting");
  return (
    <WizardFrame title={t("jfTitle")} subtitle={subtitle} position={wizard.position} total={wizard.total} onBack={wizard.back}>
      {provisioner === "docker-sibling" ? <StackJellyfin wizard={wizard} /> : <JellyfinPicker wizard={wizard} />}
    </WizardFrame>
  );
}

/**
 * Le Jellyfin de la pile complète, joint par son adresse interne : aucun choix,
 * aucune adresse à taper — le serveur ignore d'ailleurs toute autre adresse.
 * On le sonde jusqu'à ce qu'il réponde (premier démarrage, verrouillage).
 */
function StackJellyfin({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const context = wizard.data.context;
  const [probe, setProbe] = useState<JellyfinProbeResult | null>(wizard.data.probe);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const prepared = useRef(false);
  const { patch } = wizard;
  const claimed = !!context?.jellyfin.claimed;

  const check = useCallback(async () => {
    setPending(true);
    try {
      const result = await setupApi.probe(context?.jellyfin.suggestedUrl ?? "http://jellyfin:8096");
      setProbe(result);
      setError(result.compatible ? null : "jf_incompatible_version");
      // Verrouillé par Tentacle, il n'est plus « vierge » pour Jellyfin : c'est pourtant le compte choisi ici qui le prendra.
      patch({ probe: result, jellyfinUrl: result.url, mode: result.blank || claimed ? "initialize" : "connect", clientUrl: result.clientUrl ?? "" });
    } catch (err) {
      const code = err instanceof SetupApiError ? err.code : "internal";
      setProbe(null);
      setError(code);
      // Pas encore verrouillé (il démarrait) : on relance sa préparation, une fois.
      if (code === "jf_claim_pending" && !prepared.current) {
        prepared.current = true;
        void setupApi.prepare().catch(() => undefined);
      }
    } finally {
      setPending(false);
    }
  }, [context?.jellyfin.suggestedUrl, claimed, patch]);

  const waiting = !probe && (error === null || WAITING.has(error));
  useEffect(() => {
    if (!probe && !pending && error === null) void check();
  }, [probe, pending, error, check]);
  useEffect(() => {
    if (!waiting || error === null) return;
    const timer = setTimeout(() => void check(), POLL_MS);
    return () => clearTimeout(timer);
  }, [waiting, error, check]);

  const configured = probe !== null && !probe.blank && !claimed;
  const ready = probe !== null && probe.compatible;

  return (
    <div className="space-y-4">
      {waiting ? (
        <p className="text-sm text-content-tertiary" aria-live="polite">
          {error === "jf_claim_pending" ? t("jfPreparing") : t("jfChecking")}
        </p>
      ) : null}
      {probe ? (
        <div className="flex items-start gap-2 rounded-xl bg-status-success-bg px-4 py-3 text-sm text-status-success-fg" aria-live="polite">
          <CircleCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <p>
            {t("jfFound", { version: probe.version, name: probe.serverName })} {configured ? t("jfFoundConfigured") : t("jfFoundBlank")}
            <span className="mt-0.5 block text-xs text-content-secondary">{t("jfStackAddress", hostAndPort(probe.url))}</span>
          </p>
        </div>
      ) : null}
      {configured ? <AdminNotice tone="warning">{t("jfStackConfigured")}</AdminNotice> : null}
      {error && !WAITING.has(error) ? <SetupErrorLine code={error} onRetry={() => void check()} /> : null}
      <button type="button" onClick={wizard.next} disabled={!ready} className={`${cls.bp} w-full sm:w-auto`}>
        {configured ? t("jfUseConfigured") : t("next")}
      </button>
    </div>
  );
}
