import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthField, PasswordField } from "../auth/AuthField";
import { AuthButton } from "../auth/AuthButton";
import { AuthAlert } from "../auth/AuthAlert";

/** Étape 1 de l'installation : la base MariaDB / MySQL. */
export function DbStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation("setup");
  const { t: tCommon } = useTranslation("common");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("3306");
  const [database, setDatabase] = useState("tentacle");
  const [user, setUser] = useState("tentacle");
  const [password, setPassword] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  // Pre-fill from DATABASE_URL in .env (dev convenience).
  useEffect(() => {
    fetch("/api/setup/db-defaults")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.hasDefaults) return;
        if (d.host) setHost(d.host);
        if (d.port) setPort(String(d.port));
        if (d.database) setDatabase(d.database);
        if (d.user) setUser(d.user);
        if (d.password) setPassword(d.password);
      })
      .catch(() => { /* ignore — user fills manually */ });
  }, []);

  const handleTest = async () => {
    setError(""); setTesting(true); setOk(false);
    try {
      const r1 = await fetch("/api/setup/test-db", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port: Number(port), database, user, password }),
      });
      if (!r1.ok) { const d = await r1.json(); throw new Error(d.message); }
      const r2 = await fetch("/api/setup/migrate", { method: "POST" });
      if (!r2.ok) { const d = await r2.json(); throw new Error(d.message); }
      setOk(true);
    } catch (err) {
      setError((err instanceof Error && err.message) || t("dbConnectionFailed"));
    } finally { setTesting(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xs:grid-cols-3">
        <div className="xs:col-span-2">
          <AuthField id="setup-db-host" label={t("dbHost")} value={host} onChange={(e) => setHost(e.target.value)} spellCheck={false} autoCapitalize="none" />
        </div>
        <AuthField id="setup-db-port" label={t("dbPort")} value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" />
      </div>
      <AuthField id="setup-db-name" label={t("dbName")} value={database} onChange={(e) => setDatabase(e.target.value)} spellCheck={false} autoCapitalize="none" />
      <AuthField id="setup-db-user" label={t("dbUser")} value={user} onChange={(e) => setUser(e.target.value)} spellCheck={false} autoCapitalize="none" autoComplete="off" />
      <PasswordField id="setup-db-password" label={t("dbPassword")} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />

      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      {ok && <AuthAlert tone="success">{t("dbConnectionSuccess")}</AuthAlert>}

      <div className="flex flex-col-reverse gap-3 pt-1 xs:flex-row">
        <AuthButton variant="secondary" fullWidth={false} onClick={handleTest} loading={testing} loadingLabel={t("dbTesting")} disabled={!password}>
          {t("dbTestConnection")}
        </AuthButton>
        <AuthButton fullWidth={false} onClick={onNext} disabled={!ok} className="xs:ml-auto">
          {tCommon("next")}
        </AuthButton>
      </div>
    </div>
  );
}
