import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck } from "lucide-react";
import type { JellyfinProbeResult } from "@tentacle-tv/shared";
import { Field } from "../admin/services/Field";
import { cls } from "../../pages/adminUtils";
import { MissingJellyfin } from "./MissingJellyfin";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { WizardFrame } from "./WizardFrame";

/** Une nouvelle sonde toutes les quelques secondes, tant que Jellyfin démarre (voisin) ou s'installe (machine). */
const POLL_MS = 4000;
const UNREACHABLE: ReadonlySet<WizardErrorCode> = new Set(["jf_unreachable", "jf_timeout", "jf_claim_pending", "network"]);

/**
 * Jellyfin, selon l'installation : le voisin de la pile complète (verrouillé
 * dès le démarrage, en attente du compte), celui de la machine (installation
 * native : commande officielle, puis attente), ou un Jellyfin existant dont on
 * donne l'adresse. Vierge, il sera configuré ; déjà configuré, on s'y connecte.
 */
export function JellyfinScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const context = wizard.data.context;
  const provisioner = context?.provisioner ?? "existing-instance";
  const automatic = provisioner === "docker-sibling" || provisioner === "native-host";
  const [url, setUrl] = useState(wizard.data.jellyfinUrl || context?.jellyfin.suggestedUrl || "");
  const [probe, setProbe] = useState<JellyfinProbeResult | null>(wizard.data.probe);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const prepared = useRef(false);
  const { patch } = wizard;

  const check = useCallback(
    async (target: string) => {
      setPending(true);
      try {
        const result = await setupApi.probe(target.trim());
        setProbe(result);
        setError(result.compatible ? null : "jf_incompatible_version");
        // Le voisin verrouillé par Tentacle n'est plus « vierge » pour Jellyfin, mais c'est
        // bien le compte choisi ici qui le prendra.
        const claimedSibling = provisioner === "docker-sibling" && !!context?.jellyfin.claimed;
        patch({ probe: result, jellyfinUrl: result.url, mode: result.blank || claimedSibling ? "initialize" : "connect" });
      } catch (err) {
        const code = err instanceof SetupApiError ? err.code : "internal";
        setProbe(null);
        setError(code);
        // Le voisin n'est pas encore verrouillé (il démarrait) : on relance sa préparation, une fois.
        if (provisioner === "docker-sibling" && code === "jf_claim_pending" && !prepared.current) {
          prepared.current = true;
          void setupApi.prepare().catch(() => undefined);
        }
      } finally {
        setPending(false);
      }
    },
    [provisioner, context?.jellyfin.claimed, patch],
  );

  // Voisin et machine : l'adresse est connue, on sonde d'office, puis de temps en temps tant que rien ne répond.
  const waiting = automatic && !probe && (error === null || UNREACHABLE.has(error));
  useEffect(() => {
    if (!automatic || !url) return;
    if (!probe && !pending && error === null) void check(url);
  }, [automatic, url, probe, pending, error, check]);
  useEffect(() => {
    if (!waiting || error === null) return;
    const timer = setTimeout(() => void check(url), POLL_MS);
    return () => clearTimeout(timer);
  }, [waiting, error, url, check]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void check(url);
  };

  const subtitle =
    provisioner === "docker-sibling" ? t("jfSubtitleSibling") : provisioner === "native-host" ? t("jfSubtitleNative") : t("jfSubtitleExisting");
  const ready = probe !== null && probe.compatible;

  return (
    <WizardFrame title={t("jfTitle")} subtitle={subtitle} position={wizard.position} total={wizard.total} onBack={wizard.back}>
      <form onSubmit={submit} className="space-y-4">
        {provisioner === "existing-instance" || (error && !UNREACHABLE.has(error)) ? (
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label={t("jfUrl")}
              hint={t("jfUrlHint")}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setProbe(null);
              }}
              placeholder="http://192.168.1.20:8096"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 grow basis-72"
              required
            />
            <button type="submit" disabled={pending || !url.trim()} className={`${cls.bs} mb-[1.625rem]`}>
              {pending ? t("jfChecking") : t("jfCheck")}
            </button>
          </div>
        ) : null}

        {pending && automatic && !probe ? <p className="text-sm text-content-tertiary">{t("jfChecking")}</p> : null}
        {provisioner === "docker-sibling" && error === "jf_claim_pending" ? <p className="text-sm text-content-tertiary">{t("jfPreparing")}</p> : null}

        {probe ? (
          <div className="flex items-start gap-2 rounded-xl bg-status-success-bg px-4 py-3 text-sm text-status-success-fg" aria-live="polite">
            <CircleCheck size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            <p>
              {t("jfFound", { version: probe.version, name: probe.serverName })}{" "}
              {wizard.data.mode === "initialize" ? t("jfFoundBlank") : t("jfFoundConfigured")}
            </p>
          </div>
        ) : null}

        {error && !(automatic && UNREACHABLE.has(error)) ? <SetupErrorLine code={error} /> : null}
        {context && !probe && (provisioner === "native-host" ? error !== null : provisioner === "existing-instance") ? (
          <MissingJellyfin guide={context.missingJellyfin} waiting={provisioner === "native-host" && waiting} />
        ) : null}

        <button type="button" onClick={wizard.next} disabled={!ready} className={`${cls.bp} w-full sm:w-auto`}>
          {t("next")}
        </button>
      </form>
    </WizardFrame>
  );
}
