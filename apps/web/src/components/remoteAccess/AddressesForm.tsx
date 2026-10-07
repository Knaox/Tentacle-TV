import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../contexts/ToastContext";
import { cls } from "../../pages/adminUtils";
import { AdminSection } from "../admin/kit";
import { Field } from "../admin/services/Field";
import { ResultLine, SectionError, SectionFooter, SectionSkeleton } from "../admin/services/SectionParts";
import { servicesApi } from "../admin/services/servicesApi";
import { SERVICES_KEYS, type DirectStreamingConfig, type DirectStreamingTest, type PublicUrlConfig } from "../admin/services/servicesModel";
import { isHttpUrl, isMixedContent } from "../admin/services/serviceSummary";
import { useDirectStreamingConfig, useExplainFailure, usePublicUrlConfig } from "../admin/services/useServicesData";
import { useUnsavedGuard } from "../admin/services/useUnsavedGuard";
import { SERVER_LINKS_KEY } from "../serverLinks/useServerLinks";
import { ToggleSwitch } from "../settings/ToggleSwitch";
import { AddressTestResults } from "./AddressTestResults";
import { REMOTE_ACCESS_KEY } from "./remoteAccessApi";

/**
 * Les adresses — les SEULES choses à régler de l'accès à distance, dans un
 * seul formulaire : le lien public de Tentacle, la lecture directe et les
 * deux adresses de Jellyfin. Les mêmes clés et les mêmes routes qu'en 1.23.0
 * (`/api/admin/public-url`, `/api/admin/direct-streaming`) : ce qui était
 * réglé arrive prérempli, et rien d'autre n'est exigé. Les CorsHosts de
 * Jellyfin suivent seuls, côté serveur.
 *
 * Dans l'assistant, l'adresse de Jellyfin sur le réseau n'est posée qu'à la
 * fin de l'installation : seul le lien public s'y règle.
 */

const FRAME_ID = "addresses";
const clean = (url: string) => url.trim().replace(/\/+$/, "");

export function AddressesForm({ variant }: { variant: "admin" | "wizard" }) {
  const { t } = useTranslation("remoteAccess");
  const publicQuery = usePublicUrlConfig();
  const directQuery = useDirectStreamingConfig();
  const frame = { id: FRAME_ID, title: t("addressesTitle"), description: t("addressesDescription") };

  if (!publicQuery.data || !directQuery.data) {
    const failed = publicQuery.isError || directQuery.isError;
    return (
      <AdminSection {...frame}>
        {failed ? (
          <SectionError onRetry={() => void Promise.all([publicQuery.refetch(), directQuery.refetch()])} />
        ) : (
          <SectionSkeleton lines={3} />
        )}
      </AdminSection>
    );
  }
  const { publicUrl } = publicQuery.data;
  const { enabled, privateUrl, publicUrl: jellyfinPublic } = directQuery.data;
  return (
    <AdminSection {...frame}>
      <AddressesFormBody
        key={`${publicUrl}|${enabled}|${privateUrl}|${jellyfinPublic}`}
        publicConfig={publicQuery.data}
        direct={directQuery.data}
        variant={variant}
      />
    </AdminSection>
  );
}

interface BodyProps {
  publicConfig: PublicUrlConfig;
  direct: DirectStreamingConfig;
  variant: "admin" | "wizard";
}

function AddressesFormBody({ publicConfig, direct, variant }: BodyProps) {
  const { t } = useTranslation("remoteAccess");
  const { show } = useToast();
  const queryClient = useQueryClient();
  const explain = useExplainFailure();
  const formId = useId();
  const [publicUrl, setPublicUrl] = useState(publicConfig.publicUrl);
  const [enabled, setEnabled] = useState(direct.enabled);
  const [privateUrl, setPrivateUrl] = useState(direct.privateUrl);
  const [jellyfinPublic, setJellyfinPublic] = useState(direct.publicUrl);
  const [tested, setTested] = useState<DirectStreamingTest | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const wizard = variant === "wizard";

  const draft = { publicUrl: clean(publicUrl), privateUrl: clean(privateUrl), jellyfinPublic: clean(jellyfinPublic) };
  const invalid = (url: string) => (url !== "" && !isHttpUrl(url) ? t("urlInvalid") : null);
  const mixed = (url: string) => (isMixedContent(window.location.protocol, url) ? t("mixedContent") : null);
  const errors = { publicUrl: invalid(draft.publicUrl), privateUrl: invalid(draft.privateUrl), jellyfinPublic: invalid(draft.jellyfinPublic) };
  const hasError = Object.values(errors).some(Boolean);
  const missingLan = !wizard && enabled && draft.privateUrl === "";
  const publicDirty = draft.publicUrl !== publicConfig.publicUrl;
  const directDirty = !wizard && (enabled !== direct.enabled || draft.privateUrl !== direct.privateUrl || draft.jellyfinPublic !== direct.publicUrl);
  const dirty = publicDirty || directDirty;
  useUnsavedGuard(dirty);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: SERVICES_KEYS.publicUrl }),
      queryClient.invalidateQueries({ queryKey: SERVICES_KEYS.directStreaming }),
      queryClient.invalidateQueries({ queryKey: REMOTE_ACCESS_KEY }),
      queryClient.invalidateQueries({ queryKey: SERVER_LINKS_KEY }),
    ]);

  const save = useMutation({
    mutationFn: async () => {
      if (publicDirty) await servicesApi.savePublicUrl(draft.publicUrl);
      // Vide, l'adresse publique de Jellyfin est effacée : hors de chez soi, on lit par Tentacle.
      if (directDirty) await servicesApi.saveDirectStreaming({ enabled, privateUrl: draft.privateUrl, publicUrl: draft.jellyfinPublic || null });
    },
    onMutate: () => setFailure(null),
    onSuccess: () => {
      show("success", t("addressesSaved"));
      void refresh();
    },
    onError: (error) => setFailure(explain(error)),
  });
  const test = useMutation({
    mutationFn: () => servicesApi.testDirectStreaming({ publicUrl: draft.jellyfinPublic, privateUrl: draft.privateUrl }),
    onMutate: () => {
      setTested(null);
      setFailure(null);
    },
    onSuccess: (result) => {
      setTested(result);
      // Le serveur vient de compléter les CorsHosts : l'état en tête de page le dit.
      void queryClient.invalidateQueries({ queryKey: REMOTE_ACCESS_KEY });
    },
    onError: (error) => setFailure(explain(error)),
  });
  const busy = save.isPending || test.isPending;
  const canSave = dirty && !hasError && !missingLan && !busy;
  const canTest = !wizard && (draft.privateUrl !== "" || draft.jellyfinPublic !== "") && !hasError && !busy;

  const edit = (apply: () => void) => {
    apply();
    setFailure(null);
  };
  const cancel = () =>
    edit(() => {
      setPublicUrl(publicConfig.publicUrl);
      setEnabled(direct.enabled);
      setPrivateUrl(direct.privateUrl);
      setJellyfinPublic(direct.publicUrl);
    });
  const urlField = { type: "url", inputMode: "url", autoComplete: "off", spellCheck: false } as const;

  return (
    <div className="space-y-5">
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) save.mutate();
        }}
        className="space-y-5"
      >
        <Field
          {...urlField}
          label={t("publicLinkLabel")}
          placeholder={publicConfig.envFallback || "https://tentacle.example.com"}
          value={publicUrl}
          onChange={(event) => edit(() => setPublicUrl(event.target.value))}
          error={errors.publicUrl}
          hint={publicConfig.envFallback ? `${t("publicLinkHint")} ${t("publicLinkHintEnv", { url: publicConfig.envFallback })}` : t("publicLinkHint")}
          data-hash-focus=""
        />
        {wizard ? (
          <p className="text-sm leading-relaxed text-content-tertiary">{t("wizardJellyfinLater")}</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 rounded-xl bg-fill-subtle p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-content-primary">{t("directLabel")}</p>
                <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{t("directHint")}</p>
              </div>
              <ToggleSwitch checked={enabled} onChange={(next) => edit(() => setEnabled(next))} label={t("directLabel")} />
            </div>
            <div className="grid items-start gap-4 md:grid-cols-2">
              <Field
                {...urlField}
                label={t("jellyfinLanLabel")}
                placeholder="http://192.168.1.50:8096"
                value={privateUrl}
                onChange={(event) => edit(() => setPrivateUrl(event.target.value))}
                error={errors.privateUrl ?? (missingLan ? t("jellyfinLanRequired") : null)}
                warning={mixed(draft.privateUrl)}
                hint={t("jellyfinLanHint")}
              />
              <Field
                {...urlField}
                label={t("jellyfinPublicLabel")}
                placeholder="https://jellyfin.example.com"
                value={jellyfinPublic}
                onChange={(event) => edit(() => setJellyfinPublic(event.target.value))}
                error={errors.jellyfinPublic}
                warning={mixed(draft.jellyfinPublic)}
                hint={t("jellyfinPublicHint")}
              />
            </div>
          </>
        )}
      </form>
      {tested ? <AddressTestResults result={tested} /> : null}
      <SectionFooter status={failure ? <ResultLine ok={false}>{failure}</ResultLine> : null}>
        {dirty ? (
          <button type="button" onClick={cancel} disabled={busy} className={cls.bs}>
            {t("addressesCancel")}
          </button>
        ) : null}
        {!wizard ? (
          <button type="button" onClick={() => test.mutate()} disabled={!canTest} className={cls.bs}>
            {test.isPending ? t("addressesTesting") : t("addressesTest")}
          </button>
        ) : null}
        <button type="submit" form={formId} disabled={!canSave} className={cls.bp}>
          {save.isPending ? t("saving") : t("save")}
        </button>
      </SectionFooter>
    </div>
  );
}
