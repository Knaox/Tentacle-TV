import { useState } from "react";
import { useTranslation } from "react-i18next";
import { verifyServer } from "@tentacle-tv/shared";
import { AuthScreenFrame } from "../components/auth/AuthScreenFrame";
import { AuthTextField } from "../components/auth/AuthTextField";
import { AuthNotice, AuthPrimaryButton } from "../components/auth/AuthControls";

interface ServerSetupScreenProps {
  onServerValidated: (url: string) => void;
}

/**
 * Le choix du serveur, premier écran de l'app. La marque (logo « l'Étreinte »)
 * remplace l'ancien pictogramme de serveur : c'est la première chose que voit
 * l'utilisateur, et un relecteur de boutique.
 */
export function ServerSetupScreen({ onServerValidated }: ServerSetupScreenProps) {
  const { t } = useTranslation("auth");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!url.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const result = await verifyServer(url);
      if (result.success) {
        onServerValidated(result.url);
      } else {
        const key = result.errorKey ?? "serverNotFoundRetry";
        setError(t(key, result.errorParams));
      }
    } catch {
      setError(t("serverNotFoundRetry"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenFrame title={t("welcomeToTentacle")} subtitle={t("enterServerUrl")} showLanguage logoSize={88}>
      <AuthTextField
        label={t("serverAddress")}
        icon="globe"
        value={url}
        onChangeText={setUrl}
        placeholder={t("serverUrlPlaceholder")}
        hint={t("serverUrlHint")}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        textContentType="URL"
        returnKeyType="go"
        onSubmitEditing={handleConnect}
        editable={!loading}
      />

      {error && <AuthNotice tone="error" style={{ marginTop: 16 }}>{error}</AuthNotice>}

      <AuthPrimaryButton
        label={t("connectServer")}
        loadingLabel={t("connecting")}
        loading={loading}
        disabled={!url.trim()}
        onPress={handleConnect}
        style={{ marginTop: 22 }}
      />
    </AuthScreenFrame>
  );
}
