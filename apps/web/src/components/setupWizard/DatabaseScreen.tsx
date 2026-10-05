import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "../admin/services/Field";
import { cls } from "../../pages/adminUtils";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { WizardFrame } from "./WizardFrame";

/** La base, quand la pile ne la fournit pas (pile « seule », installation native). Le mot de passe n'est jamais renvoyé. */
export function DatabaseScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const [form, setForm] = useState({ host: "host.docker.internal", port: "3306", database: "tentacle", user: "tentacle", password: "" });
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await setupApi.database({ ...form, host: form.host.trim(), port: Number(form.port) });
      wizard.patch({ context: await setupApi.context() });
      wizard.next();
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setPending(false);
    }
  };

  return (
    <WizardFrame title={t("dbTitle")} subtitle={t("dbSubtitle")} position={wizard.position} total={wizard.total} onBack={wizard.back}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <Field label={t("dbHost")} hint={t("dbHostHint")} value={form.host} onChange={set("host")} autoComplete="off" spellCheck={false} required />
          <Field label={t("dbPort")} value={form.port} onChange={set("port")} inputMode="numeric" pattern="[0-9]*" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("dbName")} value={form.database} onChange={set("database")} autoComplete="off" spellCheck={false} required />
          <Field label={t("dbUser")} value={form.user} onChange={set("user")} autoComplete="username" spellCheck={false} required />
        </div>
        <Field label={t("dbPassword")} type="password" value={form.password} onChange={set("password")} autoComplete="new-password" required />
        <SetupErrorLine code={error} />
        <button type="submit" disabled={pending} className={`${cls.bp} w-full sm:w-auto`}>
          {pending ? t("working") : t("dbSubmit")}
        </button>
      </form>
    </WizardFrame>
  );
}
