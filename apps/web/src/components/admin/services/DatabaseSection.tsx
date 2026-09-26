import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";
import { cls } from "../../../pages/adminUtils";
import { AdminNotice, AdminSection } from "../kit";
import { Field } from "./Field";
import { ResultLine, SectionBadges, SectionError, SectionFooter, SectionSkeleton } from "./SectionParts";
import { servicesApi } from "./servicesApi";
import { SERVICES_KEYS, type DatabaseService } from "./servicesModel";
import { formatDatabaseVersion, summarizeDatabase } from "./serviceSummary";
import { useExplainFailure, useServicesStatus } from "./useServicesData";
import { useUnsavedGuard } from "./useUnsavedGuard";

/**
 * La base : la connexion EN SERVICE, d'où elle vient, et — quand le serveur
 * la tient de son propre fichier — de quoi en changer.
 *
 * Changer de base est rare et lourd (rien n'est recopié, un redémarrage est
 * nécessaire) : le formulaire reste replié. Et quand c'est la variable
 * d'environnement qui décide — le docker-compose livré —, il n'est pas
 * proposé du tout : l'enregistrement serait écrasé au démarrage suivant.
 */

export function DatabaseSection() {
  const { t } = useTranslation("adminServices");
  const status = useServicesStatus();
  const database = status.data?.database;
  const frame = { id: "database", title: t("databaseTitle"), description: t("databaseDescription") };

  if (!database) {
    return (
      <AdminSection {...frame}>
        {status.isError ? <SectionError onRetry={() => void status.refetch()} /> : <SectionSkeleton />}
      </AdminSection>
    );
  }
  return <DatabasePanel key={JSON.stringify(database.fields)} frame={frame} database={database} />;
}

interface Draft {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
}

function toDraft(database: DatabaseService): Draft {
  const fields = database.fields;
  return {
    host: fields?.host ?? "",
    port: String(fields?.port ?? 3306),
    database: fields?.database ?? "",
    user: fields?.user ?? "",
    password: "",
  };
}

interface PanelProps {
  frame: { id: string; title: string; description: string };
  database: DatabaseService;
}

function DatabasePanel({ frame, database }: PanelProps) {
  const { t } = useTranslation("adminServices");
  const { show } = useToast();
  const queryClient = useQueryClient();
  const explain = useExplainFailure();
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(database));
  const [failure, setFailure] = useState<string | null>(null);

  const initial = toDraft(database);
  const port = Number(draft.port);
  const portError = draft.port.trim() !== "" && !(Number.isInteger(port) && port >= 1 && port <= 65535) ? t("databasePortInvalid") : null;
  const dirty = editing && (Object.keys(initial) as (keyof Draft)[]).some((key) => draft[key].trim() !== initial[key]);
  const valid = !portError && [draft.host, draft.port, draft.database, draft.user, draft.password].every((v) => v.trim() !== "");
  useUnsavedGuard(dirty);

  const close = () => {
    setEditing(false);
    setDraft(toDraft(database));
    setFailure(null);
  };
  const save = useMutation({
    mutationFn: servicesApi.saveDatabase,
    onMutate: () => setFailure(null),
    onSuccess: () => {
      show("success", t("databaseSaved"));
      close();
      void queryClient.invalidateQueries({ queryKey: SERVICES_KEYS.status });
    },
    onError: (error) => setFailure(explain(error)),
  });
  const canSave = dirty && valid && !save.isPending;
  const update = (key: keyof Draft) => (event: { target: { value: string } }) => {
    setDraft((previous) => ({ ...previous, [key]: event.target.value }));
    setFailure(null);
  };

  const facts: Array<[string, string]> = [
    [t("databaseHost"), database.fields?.host || "—"],
    [t("databasePort"), database.fields ? String(database.fields.port) : "—"],
    [t("databaseName"), database.fields?.database || "—"],
    [t("databaseUser"), database.fields?.user || "—"],
    [t("databaseVersion"), formatDatabaseVersion(database.version) || "—"],
  ];

  return (
    <AdminSection {...frame} badges={<SectionBadges summary={summarizeDatabase(database)} dirty={dirty} />}>
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
          {facts.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-content-tertiary">{label}</dt>
              <dd className="mt-0.5 truncate font-mono text-sm text-content-primary" title={value}>{value}</dd>
            </div>
          ))}
        </dl>
        {database.pendingRestart && <AdminNotice tone="warning">{t("databasePending")}</AdminNotice>}
        {database.source === "env" && <AdminNotice tone="info">{t("databaseSourceEnv")}</AdminNotice>}
        {database.source === "file" && !editing && (
          <p className="text-xs text-content-tertiary">{t("databaseSourceFile")}</p>
        )}
        {/* Sans `source` (serveur plus ancien), on ne sait pas qui décide : le formulaire reste offert, comme avant. */}
        {database.source !== "env" && (
          <div>
            <button
              type="button"
              aria-expanded={editing}
              onClick={() => (editing ? close() : setEditing(true))}
              className="flex min-h-11 items-center gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <ChevronRight
                size={16}
                aria-hidden="true"
                className={`shrink-0 text-content-tertiary transition-transform duration-200 motion-reduce:transition-none ${editing ? "rotate-90" : ""}`}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-content-primary">{t("databaseEdit")}</span>
                {!editing && <span className="block text-xs text-content-tertiary">{t("databaseEditSummary")}</span>}
              </span>
            </button>
            {editing && (
              <form
                id={formId}
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!canSave) return;
                  save.mutate({ host: draft.host.trim(), port, database: draft.database.trim(), user: draft.user.trim(), password: draft.password });
                }}
                className="mt-3 space-y-4 md:pl-6"
              >
                <div className="grid gap-4 md:grid-cols-6">
                  <Field className="md:col-span-4" label={t("databaseHost")} value={draft.host} onChange={update("host")} autoComplete="off" spellCheck={false} />
                  <Field className="md:col-span-2" label={t("databasePort")} value={draft.port} onChange={update("port")} inputMode="numeric" error={portError} />
                  <Field className="md:col-span-2" label={t("databaseName")} value={draft.database} onChange={update("database")} autoComplete="off" spellCheck={false} />
                  <Field className="md:col-span-2" label={t("databaseUser")} value={draft.user} onChange={update("user")} autoComplete="off" spellCheck={false} />
                  <Field
                    className="md:col-span-2"
                    label={t("databasePassword")}
                    type="password"
                    autoComplete="new-password"
                    value={draft.password}
                    onChange={update("password")}
                    hint={t("databasePasswordHint")}
                  />
                </div>
                <AdminNotice tone="warning">{t("databaseRestartNote")}</AdminNotice>
              </form>
            )}
          </div>
        )}
        {editing && (
          <SectionFooter status={failure && <ResultLine ok={false}>{failure}</ResultLine>}>
            <button type="button" onClick={close} disabled={save.isPending} className={cls.bs}>{t("cancel")}</button>
            <button type="submit" form={formId} disabled={!canSave} className={cls.bp}>
              {save.isPending ? t("saving") : t("save")}
            </button>
          </SectionFooter>
        )}
      </div>
    </AdminSection>
  );
}
