import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerCapability } from "@tentacle-tv/api-client";
import { directPlayIssues } from "@tentacle-tv/shared";
import { useToast } from "../../../contexts/ToastContext";
import { cls } from "../../../pages/adminUtils";
import { ToggleSwitch } from "../../settings/ToggleSwitch";
import { AdminSection } from "../kit";
import { DirectStreamingTestResults } from "./DirectStreamingTest";
import { Field } from "./Field";
import { ResultLine, SectionBadges, SectionError, SectionFooter, SectionSkeleton } from "./SectionParts";
import { servicesApi } from "./servicesApi";
import { SERVICES_KEYS, type DirectStreamingConfig, type DirectStreamingTest } from "./servicesModel";
import { isHttpUrl, isMixedContent, summarizeDirectStreaming } from "./serviceSummary";
import { useDirectStreamingConfig, useExplainFailure } from "./useServicesData";
import { useUnsavedGuard } from "./useUnsavedGuard";
import { SERVER_LINKS_KEY } from "../../serverLinks/useServerLinks";

/**
 * La lecture directe : les applications lisent chez Jellyfin sans passer par
 * le serveur Tentacle, qui donne à chacune l'adresse qui lui convient —
 * privée sur le réseau local, publique ailleurs. Avec la capacité
 * `admin.remoteExposure`, les règles de l'accès à distance : l'adresse privée
 * suffit, la publique est FACULTATIVE (un interrupteur ; coupée, elle est
 * effacée et l'extérieur lit par Tentacle). Face à un serveur d'avant, les
 * deux restent exigées.
 */

interface Frame {
  id: string;
  title: string;
  description: string;
}

export function DirectStreamingSection() {
  const { t } = useTranslation("adminServices");
  const query = useDirectStreamingConfig();
  const config = query.data;
  const frame: Frame = { id: "directstreaming", title: t("directTitle"), description: t("directDescription") };

  if (!config) {
    return (
      <AdminSection {...frame}>
        {query.isError ? <SectionError onRetry={() => void query.refetch()} /> : <SectionSkeleton />}
      </AdminSection>
    );
  }
  return <DirectStreamingForm key={`${config.enabled}|${config.publicUrl}|${config.privateUrl}`} frame={frame} config={config} />;
}

const clean = (url: string) => url.trim().replace(/\/+$/, "");

function DirectStreamingForm({ frame, config }: { frame: Frame; config: DirectStreamingConfig }) {
  const { t } = useTranslation("adminServices");
  const { show } = useToast();
  const queryClient = useQueryClient();
  const explain = useExplainFailure();
  const formId = useId();
  const [enabled, setEnabled] = useState(config.enabled);
  const [publicUrl, setPublicUrl] = useState(config.publicUrl);
  const [privateUrl, setPrivateUrl] = useState(config.privateUrl);
  const optionalPublic = useServerCapability("admin.remoteExposure");
  const [publicOn, setPublicOn] = useState(config.publicUrl !== "");
  const [tested, setTested] = useState<DirectStreamingTest | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const draft = { enabled, publicUrl: !optionalPublic || publicOn ? clean(publicUrl) : "", privateUrl: clean(privateUrl) };
  const urlError = (url: string) => (url !== "" && !isHttpUrl(url) ? t("urlInvalid") : null);
  const mixed = (url: string) => (isMixedContent(window.location.protocol, url) ? t("directMixedContent") : null);
  const errors = { public: urlError(draft.publicUrl), private: urlError(draft.privateUrl) };
  const issues = directPlayIssues({ enabled, privateUrl: draft.privateUrl, publicEnabled: !optionalPublic || publicOn, publicUrl: draft.publicUrl });
  const missing = issues.length > 0;
  const missingText = !optionalPublic ? t("directUrlsRequired") : issues.includes("private_missing") ? t("directPrivateRequired") : t("directPublicMissing");
  const dirty = draft.enabled !== config.enabled || draft.publicUrl !== config.publicUrl || draft.privateUrl !== config.privateUrl;
  useUnsavedGuard(dirty);

  const save = useMutation({
    // Coupée, l'adresse publique est effacée (`null`) : l'extérieur lit par Tentacle.
    mutationFn: () => servicesApi.saveDirectStreaming({ ...draft, publicUrl: optionalPublic && !publicOn ? null : draft.publicUrl }),
    onMutate: () => setFailure(null),
    onSuccess: () => {
      show("success", t("directSaved"));
      void queryClient.invalidateQueries({ queryKey: SERVICES_KEYS.directStreaming });
      // La vue d'ensemble resonde ce qui vient de changer.
      void queryClient.invalidateQueries({ queryKey: SERVER_LINKS_KEY });
    },
    onError: (error) => setFailure(explain(error)),
  });
  const test = useMutation({
    mutationFn: servicesApi.testDirectStreaming,
    onMutate: () => {
      setTested(null);
      setFailure(null);
    },
    onSuccess: setTested,
    onError: (error) => setFailure(explain(error)),
  });
  const busy = save.isPending || test.isPending;
  const canSave = dirty && !missing && !errors.public && !errors.private && !busy;
  const canTest = (draft.publicUrl !== "" || draft.privateUrl !== "") && !errors.public && !errors.private && !busy;

  const edit = (apply: () => void) => {
    apply();
    setFailure(null);
  };
  const cancel = () => edit(() => {
    setEnabled(config.enabled);
    setPublicUrl(config.publicUrl);
    setPrivateUrl(config.privateUrl);
    setPublicOn(config.publicUrl !== "");
  });

  const publicField = (
    <Field
      label={t("directPublicLabel")}
      type="url"
      inputMode="url"
      autoComplete="off"
      spellCheck={false}
      placeholder="https://jf.example.com"
      value={publicUrl}
      onChange={(event) => edit(() => setPublicUrl(event.target.value))}
      error={errors.public}
      warning={mixed(draft.publicUrl)}
      hint={t("directPublicHint")}
      data-hash-focus=""
    />
  );
  const privateField = (
    <Field
      label={t("directPrivateLabel")}
      type="url"
      inputMode="url"
      autoComplete="off"
      spellCheck={false}
      placeholder="http://192.168.1.50:8096"
      value={privateUrl}
      onChange={(event) => edit(() => setPrivateUrl(event.target.value))}
      error={errors.private}
      warning={mixed(draft.privateUrl)}
      hint={t("directPrivateHint")}
    />
  );

  return (
    <AdminSection {...frame} badges={<SectionBadges summary={summarizeDirectStreaming(config)} dirty={dirty} />}>
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
          <div className="flex items-start justify-between gap-4 rounded-xl bg-fill-subtle p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-content-primary">{t("directEnable")}</p>
              <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{t("directEnableHint")}</p>
            </div>
            <ToggleSwitch checked={enabled} onChange={(next) => edit(() => setEnabled(next))} label={t("directEnable")} />
          </div>
          {optionalPublic ? (
            <>
              {privateField}
              <div className="flex items-start justify-between gap-4 rounded-xl bg-fill-subtle p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-content-primary">{t("directPublicSwitch")}</p>
                  <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{t("directPublicSwitchHint")}</p>
                </div>
                <ToggleSwitch checked={publicOn} onChange={(next) => edit(() => setPublicOn(next))} label={t("directPublicSwitch")} />
              </div>
              {publicOn ? publicField : null}
            </>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {publicField}
              {privateField}
            </div>
          )}
        </form>
        {tested && <DirectStreamingTestResults result={tested} />}
        <p className="text-xs leading-relaxed text-content-tertiary">{t("directCorsHelp")}</p>
        <SectionFooter
          status={failure ? <ResultLine ok={false}>{failure}</ResultLine>
            : missing ? <p className="text-xs text-status-warning-fg">{missingText}</p>
            : null}
        >
          {dirty && <button type="button" onClick={cancel} disabled={busy} className={cls.bs}>{t("cancel")}</button>}
          <button
            type="button"
            onClick={() => test.mutate({ publicUrl: draft.publicUrl, privateUrl: draft.privateUrl })}
            disabled={!canTest}
            className={cls.bs}
          >
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
