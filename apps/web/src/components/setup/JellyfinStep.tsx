import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, KeyRound } from "lucide-react";
import { AuthField } from "../auth/AuthField";
import { AuthButton } from "../auth/AuthButton";
import { AuthAlert } from "../auth/AuthAlert";

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Étape 2 de l'installation : le serveur Jellyfin et sa clé d'administration. */
export function JellyfinStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation("setup");
  const { t: tCommon } = useTranslation("common");
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState("");
  const [saved, setSaved] = useState(false);

  const handleTest = async () => {
    setError(""); setTesting(true); setVersion("");
    try {
      const r = await fetch("/api/setup/test-jellyfin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.replace(/\/$/, ""), apiKey }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setVersion(d.version);
    } catch (err) { setError(errorMessage(err)); } finally { setTesting(false); }
  };

  const handleSave = async () => {
    try {
      const r = await fetch("/api/setup/save-jellyfin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.replace(/\/$/, ""), apiKey }),
      });
      if (!r.ok) throw new Error("Echec");
      setSaved(true);
    } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <div className="space-y-4">
      <AuthField
        id="setup-jellyfin-url"
        type="url"
        inputMode="url"
        label={t("jellyfinUrl")}
        icon={Globe}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={t("jellyfinUrlPlaceholder")}
        spellCheck={false}
        autoCapitalize="none"
      />
      <AuthField
        id="setup-jellyfin-key"
        label={t("jellyfinApiKey")}
        icon={KeyRound}
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        className="font-mono"
        spellCheck={false}
        autoCapitalize="none"
        autoComplete="off"
      />

      {version && <AuthAlert tone="success">{t("jellyfinDetected", { version })}</AuthAlert>}
      {error && <AuthAlert tone="error">{error}</AuthAlert>}

      <div className="flex flex-col-reverse gap-3 pt-1 xs:flex-row">
        <AuthButton variant="secondary" fullWidth={false} onClick={handleTest} loading={testing} loadingLabel={t("dbTesting")} disabled={!url || !apiKey}>
          {t("jellyfinTest")}
        </AuthButton>
        {version && !saved && (
          <AuthButton variant="secondary" fullWidth={false} onClick={handleSave}>
            {t("jellyfinSave")}
          </AuthButton>
        )}
        <AuthButton fullWidth={false} onClick={onNext} disabled={!saved} className="xs:ml-auto">
          {tCommon("next")}
        </AuthButton>
      </div>
    </div>
  );
}
