import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";
import { cls } from "../../../pages/adminUtils";
import { AdminSection } from "../kit";
import { Field } from "./Field";
import { ResultLine, SectionBadges, SectionError, SectionFooter, SectionSkeleton } from "./SectionParts";
import { servicesApi } from "./servicesApi";
import type { AdminKeyState } from "../../../lib/adminKeyHealth";
import { SERVICES_KEYS, type JellyfinService } from "./servicesModel";
import { isHttpUrl, summarizeJellyfin, type Summary, type Tone } from "./serviceSummary";
import { useExplainFailure, useKeyHealth, useServicesStatus } from "./useServicesData";
import { useUnsavedGuard } from "./useUnsavedGuard";

/**
 * Jellyfin : l'adresse que le serveur Tentacle joint, et la clé
 * d'administration.
 *
 * La clé ne redescend jamais du serveur : le champ reste vide, et vide veut
 * dire « garder celle qui est enregistrée » — changer d'adresse ou revérifier
 * ne demande plus de la ressortir. Un serveur d'avant cette règle
 * (`apiKeyConfigured === null`) l'exige encore : le formulaire s'y plie.
 */

interface Frame {
  id: string;
  title: string;
  description: string;
}

export function JellyfinSection() {
  const { t } = useTranslation("adminServices");
  const status = useServicesStatus();
  const keyHealth = useKeyHealth();
  const jellyfin = status.data?.jellyfin;
  const keyState = keyHealth.data?.state ?? null;
  const frame: Frame = { id: "jellyfin", title: t("jellyfinTitle"), description: t("jellyfinDescription") };

  if (!jellyfin) {
    return (
      <AdminSection {...frame}>
        {status.isError ? <SectionError onRetry={() => void status.refetch()} /> : <SectionSkeleton />}
      </AdminSection>
    );
  }
  // La clé remonte le formulaire sur ce que le serveur vient de confirmer.
  return (
    <JellyfinForm
      key={jellyfin.url}
      frame={frame}
      jellyfin={jellyfin}
      keyState={keyState}
      summary={summarizeJellyfin(jellyfin, keyState)}
    />
  );
}

const KEY_HEALTH: Partial<Record<AdminKeyState, { tone: Tone; label: string }>> = {
  ok: { tone: "success", label: "keyHealthOk" },
  revoquee: { tone: "error", label: "keyHealthRevoked" },
  sansDroits: { tone: "warning", label: "keyHealthNoRights" },
  absente: { tone: "warning", label: "keyHealthMissing" },
};

const TONE_TEXT: Record<Tone, string> = {
  success: "text-status-success-fg",
  warning: "text-status-warning-fg",
  error: "text-status-error-fg",
  neutral: "text-content-tertiary",
};

/** Qui répond, et ce que Jellyfin pense de la clé. */
function JellyfinFacts({ jellyfin, keyState }: { jellyfin: JellyfinService; keyState: AdminKeyState | null }) {
  const { t } = useTranslation("adminServices");
  const { version, serverName: name } = jellyfin;
  // « Injoignable » ne dit rien de la clé : Jellyfin était seulement muet.
  const health = keyState ? KEY_HEALTH[keyState] : undefined;
  if (!version && !health) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
      {version && (
        <span className="font-medium text-content-secondary">
          {name ? t("jellyfinServer", { name, version }) : t("jellyfinVersionOnly", { version })}
        </span>
      )}
      {health && (
        <span className={`flex items-center gap-1.5 ${TONE_TEXT[health.tone]}`}>
          <KeyRound size={14} aria-hidden="true" />
          {t(health.label)}
        </span>
      )}
    </div>
  );
}

interface FormProps {
  frame: Frame;
  jellyfin: JellyfinService;
  keyState: AdminKeyState | null;
  summary: Summary;
}

function JellyfinForm({ frame, jellyfin, keyState, summary }: FormProps) {
  const { t } = useTranslation("adminServices");
  const { show } = useToast();
  const queryClient = useQueryClient();
  const explain = useExplainFailure();
  const formId = useId();
  const [url, setUrl] = useState(jellyfin.url);
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const typedUrl = url.trim().replace(/\/+$/, "");
  const typedKey = apiKey.trim();
  const urlError = typedUrl !== "" && !isHttpUrl(typedUrl) ? t("urlInvalid") : null;
  const keyReady = typedKey !== "" || jellyfin.apiKeyConfigured === true;
  const dirty = typedUrl !== jellyfin.url || typedKey !== "";
  const ready = typedUrl !== "" && !urlError && keyReady;
  const body = typedKey ? { url: typedUrl, apiKey: typedKey } : { url: typedUrl };
  useUnsavedGuard(dirty);

  const test = useMutation({
    mutationFn: servicesApi.testJellyfin,
    onMutate: () => setResult(null),
    onSuccess: ({ version, serverName }) =>
      setResult({
        ok: true,
        text: serverName ? t("jellyfinTestOk", { name: serverName, version }) : t("jellyfinVersionOnly", { version }),
      }),
    onError: (error) => setResult({ ok: false, text: explain(error) }),
  });
  const save = useMutation({
    mutationFn: servicesApi.saveJellyfin,
    onMutate: () => setResult(null),
    onSuccess: () => {
      setApiKey("");
      show("success", t("jellyfinSaved"));
      void queryClient.invalidateQueries({ queryKey: SERVICES_KEYS.status });
      // Le serveur a oublié son verdict sur l'ancienne clé : le bandeau
      // d'alerte le redemande, et s'efface si la nouvelle est la bonne.
      void queryClient.invalidateQueries({ queryKey: SERVICES_KEYS.jellyfinKey });
    },
    onError: (error) => setResult({ ok: false, text: explain(error) }),
  });
  const busy = test.isPending || save.isPending;
  const canSave = dirty && ready && !busy;

  const edit = (apply: () => void) => {
    apply();
    setResult(null);
  };

  return (
    <AdminSection {...frame} badges={<SectionBadges summary={summary} dirty={dirty} />}>
      <div className="space-y-5">
        <JellyfinFacts jellyfin={jellyfin} keyState={keyState} />
        <form
          id={formId}
          // Nos messages, pas les bulles du navigateur.
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) save.mutate(body);
          }}
          className="grid gap-4 md:grid-cols-2"
        >
          <Field
            label={t("jellyfinUrlLabel")}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="http://localhost:8096"
            value={url}
            onChange={(event) => edit(() => setUrl(event.target.value))}
            error={urlError}
            hint={t("jellyfinUrlHint")}
          />
          <Field
            label={t("jellyfinKeyLabel")}
            type="password"
            // « new-password » : sans lui, le navigateur propose d'y verser le
            // mot de passe de connexion qu'il a retenu pour Tentacle.
            autoComplete="new-password"
            spellCheck={false}
            placeholder={jellyfin.apiKeyConfigured ? t("jellyfinKeyKeep") : t("jellyfinKeyPaste")}
            value={apiKey}
            onChange={(event) => edit(() => setApiKey(event.target.value))}
            hint={t("jellyfinKeyHint")}
            data-hash-focus=""
          />
        </form>
        <SectionFooter status={result && <ResultLine ok={result.ok}>{result.text}</ResultLine>}>
          {dirty && (
            <button
              type="button"
              onClick={() => edit(() => {
                setUrl(jellyfin.url);
                setApiKey("");
              })}
              disabled={busy}
              className={cls.bs}
            >
              {t("cancel")}
            </button>
          )}
          <button type="button" onClick={() => test.mutate(body)} disabled={!ready || busy} className={cls.bs}>
            {test.isPending ? t("testing") : t("test")}
          </button>
          <button type="submit" form={formId} disabled={!canSave} className={cls.bp}>
            {save.isPending ? t("saving") : t("save")}
          </button>
        </SectionFooter>
      </div>
    </AdminSection>
  );
}
