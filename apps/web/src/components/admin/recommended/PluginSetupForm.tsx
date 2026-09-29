import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PluginSetupMeta } from "@tentacle-tv/shared";
import { useToast } from "../../../contexts/ToastContext";
import { cls } from "../../../pages/adminUtils";
import { ResultLine, SectionFooter } from "../services/SectionParts";
import { localized } from "../jellyfin/compatPresentation";
import { PluginSetupError, usePluginSetupAction, usePluginSetupState } from "./pluginSetupApi";
import { fieldProblem, resultMessage, trimValues, type SetupMessage } from "./pluginSetupModel";
import { SetupInput } from "./SetupInput";

/**
 * Le formulaire qu'une extension déclare pour se brancher (`setup` de son
 * manifeste), rendu tel quel : Tentacle ne connaît aucun de ses champs.
 *
 * « Tester » éprouve la saisie sans rien enregistrer ; « Tester et activer »
 * éprouve, puis enregistre et active l'extension si le test réussit — le
 * SERVEUR joue le test, au nom de l'administrateur, et complète un secret
 * déjà enregistré qu'on a laissé vide.
 */

interface Props {
  pluginId: string;
  meta: PluginSetupMeta;
  name: string;
  onSaved: () => void;
}

export function PluginSetupForm({ pluginId, meta, name, onSaved }: Props) {
  const { t, i18n } = useTranslation("adminRecommended");
  const { show } = useToast();
  const state = usePluginSetupState(pluginId);
  const test = usePluginSetupAction(pluginId, false);
  const save = usePluginSetupAction(pluginId, true);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showProblems, setShowProblems] = useState(false);
  const [serverField, setServerField] = useState<{ field: string; reason: string } | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: SetupMessage } | null>(null);

  if (state.isPending) {
    return <div aria-hidden="true" className="grid gap-4 md:grid-cols-2"><div className="skeleton-shimmer h-20 rounded-lg" /><div className="skeleton-shimmer h-20 rounded-lg" /></div>;
  }
  if (state.isError) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-status-error-bg px-4 py-3">
        <p className="min-w-0 flex-1 text-sm text-status-error-fg">{t("setupLoadError")}</p>
        <button type="button" onClick={() => void state.refetch()} className="text-sm font-semibold text-content-primary underline underline-offset-4">
          {t("setupRetry")}
        </button>
      </div>
    );
  }

  const saved = state.data;
  // Les champs non secrets partent de ce qui est enregistré ; les secrets, de vide.
  const values: Record<string, string> = Object.fromEntries(meta.fields.map((field) => [field.key, edits[field.key] ?? saved.values[field.key] ?? ""]));
  const problems = Object.fromEntries(meta.fields.map((field) => [field.key, fieldProblem(field, values[field.key], saved.secrets[field.key] === true)]));
  const blocked = Object.values(problems).some(Boolean);
  const busy = test.isPending || save.isPending;

  const run = (action: "test" | "save") => {
    setShowProblems(true);
    setServerField(null);
    setResult(null);
    if (blocked) return;
    (action === "save" ? save : test).mutate(trimValues(values), {
      onSuccess: (verdict) => {
        setResult({ ok: verdict.ok, message: resultMessage(meta, verdict, i18n.language) });
        if (verdict.saved) {
          show("success", t("setupSaved", { name }));
          onSaved();
        }
      },
      onError: (error) => {
        if (error instanceof PluginSetupError && error.code === "invalid-field" && error.field) {
          setServerField({ field: error.field, reason: error.reason ?? "invalid" });
          return;
        }
        const offline = error instanceof PluginSetupError && error.code === "network";
        setResult({ ok: false, message: { key: offline ? "setupUnreachable" : "setupFailed" } });
      },
    });
  };

  const problemText = (key: string): string | null => {
    const problem = serverField?.field === key ? (serverField.reason === "missing" ? "required" : "invalid") : showProblems ? problems[key] : null;
    return problem === "required" ? t("setupRequired") : problem === "invalid" ? t("setupInvalidUrl") : null;
  };
  const message = result ? ("text" in result.message ? result.message.text : t(result.message.key, result.message.values)) : null;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        run("save");
      }}
      className="space-y-4"
    >
      {(meta.title || meta.description) && (
        <div>
          {meta.title && <p className="text-sm font-semibold text-content-primary">{localized(meta.title, i18n.language)}</p>}
          {meta.description && <p className="mt-0.5 text-xs leading-relaxed text-content-tertiary">{localized(meta.description, i18n.language)}</p>}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {meta.fields.map((field) => (
          <SetupInput
            key={field.key}
            field={field}
            value={values[field.key]}
            storedSecret={saved.secrets[field.key] === true}
            error={problemText(field.key)}
            disabled={busy}
            onChange={(value) => {
              setEdits((previous) => ({ ...previous, [field.key]: value }));
              setResult(null);
              setServerField(null);
            }}
          />
        ))}
      </div>
      <SectionFooter status={message && <ResultLine ok={result?.ok === true}>{message}</ResultLine>}>
        <button type="button" onClick={() => run("test")} disabled={busy} className={cls.bs}>
          {test.isPending ? t("setupTesting") : t("setupTest")}
        </button>
        <button type="submit" disabled={busy} className={cls.bp}>
          {save.isPending ? t("setupSaving") : t("setupSave")}
        </button>
      </SectionFooter>
    </form>
  );
}
