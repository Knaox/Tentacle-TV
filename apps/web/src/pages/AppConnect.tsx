import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { verifyServer } from "@tentacle-tv/shared";
import { recordFreshInstall } from "../whatsNew/freshInstall";
import { AuthLayout } from "../components/auth/AuthLayout";
import { AuthField } from "../components/auth/AuthField";
import { AuthButton } from "../components/auth/AuthButton";
import { AuthAlert } from "../components/auth/AuthAlert";

interface AppConnectProps {
  onConnected: () => void;
}

/**
 * Le choix du serveur, dans la coquille de bureau (première installation ou
 * « Changer de serveur »). Même cadre que la connexion : c'est la première
 * page que voit l'utilisateur, elle porte la marque.
 */
export function AppConnect({ onConnected }: AppConnectProps) {
  const { t } = useTranslation("auth");
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");

  // Cette page n'existe qu'à la première installation : l'écran de nouveautés
  // note la version courante ici, pour ne s'imposer qu'à la suivante.
  useEffect(() => {
    void recordFreshInstall();
  }, []);

  const handleConnect = async () => {
    setError("");
    setTesting(true);
    try {
      const result = await verifyServer(url);
      if (result.success) {
        localStorage.setItem("tentacle_server_url", result.url);
        onConnected();
      } else {
        const key = result.errorKey ?? "serverNotFoundRetry";
        setError(t(key, result.errorParams));
      }
    } catch {
      setError(t("serverNotFoundRetry"));
    } finally {
      setTesting(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && !testing) void handleConnect();
  };

  return (
    <AuthLayout title={t("welcomeToTentacle")} subtitle={t("enterServerUrl")}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <AuthField
          id="server-url"
          type="url"
          inputMode="url"
          label={t("serverAddress")}
          icon={Globe}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("serverUrlPlaceholder")}
          hint={t("serverUrlHint")}
          autoComplete="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />

        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <AuthButton type="submit" loading={testing} loadingLabel={t("connecting")} disabled={!url}>
          {t("connectServer")}
        </AuthButton>
      </form>
    </AuthLayout>
  );
}
