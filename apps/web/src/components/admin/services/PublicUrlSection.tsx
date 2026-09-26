import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../../contexts/ToastContext";
import { cls } from "../../../pages/adminUtils";
import { AdminNotice, AdminSection } from "../kit";
import { Field } from "./Field";
import { ResultLine, SectionBadges, SectionError, SectionFooter, SectionSkeleton } from "./SectionParts";
import { servicesApi } from "./servicesApi";
import { SERVICES_KEYS, type PublicUrlConfig } from "./servicesModel";
import { isHttpUrl, summarizePublicUrl } from "./serviceSummary";
import { useExplainFailure, usePublicUrlConfig } from "./useServicesData";
import { useUnsavedGuard } from "./useUnsavedGuard";

/**
 * L'adresse publique du serveur — celle que les téléviseurs reçoivent au
 * jumelage. Enregistrée en base, prioritaire ; vide, le serveur retombe sur
 * la variable d'environnement TENTACLE_PUBLIC_URL.
 *
 * Son ancre `#publicurl` est visée par le verrou de jumelage TV
 * (`PairingLockedNotice`) : elle ne change pas.
 */

interface Frame {
  id: string;
  title: string;
  description: string;
}

export function PublicUrlSection() {
  const { t } = useTranslation("adminServices");
  const query = usePublicUrlConfig();
  const config = query.data;
  const frame: Frame = { id: "publicurl", title: t("publicUrlTitle"), description: t("publicUrlDescription") };

  if (!config) {
    return (
      <AdminSection {...frame}>
        {query.isError ? <SectionError onRetry={() => void query.refetch()} /> : <SectionSkeleton lines={1} />}
      </AdminSection>
    );
  }
  return <PublicUrlForm key={config.publicUrl} frame={frame} config={config} />;
}

function PublicUrlForm({ frame, config }: { frame: Frame; config: PublicUrlConfig }) {
  const { t } = useTranslation("adminServices");
  const { show } = useToast();
  const queryClient = useQueryClient();
  const explain = useExplainFailure();
  const formId = useId();
  const [value, setValue] = useState(config.publicUrl);
  const [failure, setFailure] = useState<string | null>(null);

  const typed = value.trim().replace(/\/+$/, "");
  const error = typed !== "" && !isHttpUrl(typed) ? t("urlInvalid") : null;
  const dirty = typed !== config.publicUrl;
  useUnsavedGuard(dirty);

  const save = useMutation({
    mutationFn: servicesApi.savePublicUrl,
    onMutate: () => setFailure(null),
    onSuccess: (_saved, url) => {
      show("success", url ? t("publicUrlSaved") : t("publicUrlCleared"));
      void queryClient.invalidateQueries({ queryKey: SERVICES_KEYS.publicUrl });
    },
    onError: (err) => setFailure(explain(err)),
  });
  const canSave = dirty && !error && !save.isPending;

  // Ce qui sert VRAIMENT : la valeur enregistrée, ou à défaut l'environnement.
  const inEffect = config.effectiveUrl;
  const fromEnv = inEffect !== "" && config.publicUrl === "";

  return (
    <AdminSection {...frame} badges={<SectionBadges summary={summarizePublicUrl(config)} dirty={dirty} />}>
      <div className="space-y-5">
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <form
            id={formId}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (canSave) save.mutate(typed);
            }}
          >
            <Field
              label={t("publicUrlLabel")}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={config.envFallback || "https://tentacle.example.com"}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setFailure(null);
              }}
              error={error}
              hint={config.envFallback ? t("publicUrlHintEnv", { url: config.envFallback }) : t("publicUrlHint")}
              data-hash-focus=""
            />
          </form>
          {inEffect ? (
            <AdminNotice tone="success" className="lg:mt-5">
              <span className="break-all">{t("publicUrlInEffect", { url: inEffect })}</span>
              {fromEnv && <span className="text-content-tertiary"> — {t("publicUrlFromEnv")}</span>}
            </AdminNotice>
          ) : (
            <AdminNotice tone="warning" className="lg:mt-5">{t("publicUrlNone")}</AdminNotice>
          )}
        </div>
        <SectionFooter status={failure && <ResultLine ok={false}>{failure}</ResultLine>}>
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setValue(config.publicUrl);
                setFailure(null);
              }}
              disabled={save.isPending}
              className={cls.bs}
            >
              {t("cancel")}
            </button>
          )}
          <button type="submit" form={formId} disabled={!canSave} className={cls.bp}>
            {save.isPending ? t("saving") : t("save")}
          </button>
        </SectionFooter>
      </div>
    </AdminSection>
  );
}
