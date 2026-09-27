import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, User } from "lucide-react";
import { AuthField, PasswordField } from "../auth/AuthField";
import { AuthButton } from "../auth/AuthButton";
import { AuthAlert } from "../auth/AuthAlert";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- contrat d'origine de `ServerSetup.onComplete`
type OnComplete = (token: string, user: any) => void;

/** Étape 3 de l'installation : le compte administrateur Jellyfin existant. */
export function AdminStep({ onComplete }: { onComplete: OnComplete }) {
  const { t } = useTranslation("setup");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating || !username || !password) return;
    setError(""); setCreating(true);
    try {
      const r = await fetch("/api/setup/create-admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      onComplete(d.token, d.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setCreating(false); }
  };

  return (
    <form onSubmit={handleCreate} className="space-y-4">
      <AuthField
        id="setup-admin-username"
        label={t("adminUsername")}
        icon={User}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
      />
      <PasswordField
        id="setup-admin-password"
        label={t("adminPassword")}
        icon={Lock}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />

      {error && <AuthAlert tone="error">{error}</AuthAlert>}

      <AuthButton type="submit" loading={creating} loadingLabel={t("adminVerifying")} disabled={!username || !password}>
        {t("adminVerifyCreate")}
      </AuthButton>
    </form>
  );
}
