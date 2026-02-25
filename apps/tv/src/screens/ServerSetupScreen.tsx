import { useState } from "react";
import { View, Text, TextInput, ActivityIndicator } from "react-native";
import { useTentacleConfig } from "@tentacle/api-client";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { Focusable } from "../components/focus/Focusable";

type Props = NativeStackScreenProps<RootStackParamList, "ServerSetup">;

export function ServerSetupScreen({ navigation }: Props) {
  const { storage } = useTentacleConfig();
  const [serverUrl, setServerUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const normalizeUrl = (url: string): string => {
    let normalized = url.trim().replace(/\/+$/, "");
    if (normalized && !normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "http://" + normalized;
    }
    return normalized;
  };

  const handleTest = async () => {
    const url = normalizeUrl(serverUrl);
    if (!url) return;

    setTesting(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`${url}/api/health`, {
        method: "GET",
        headers: { "Accept": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }

      // Health check passed — save the URL and show choice
      storage.setItem("tentacle_server_url", url);
      setSuccess(true);
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("Network")) {
        setError("Impossible de joindre le serveur. Verifiez l'adresse et votre connexion reseau.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erreur de connexion au serveur.");
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header */}
        <Text style={styles.logo}>Tentacle</Text>
        <Text style={styles.title}>Bienvenue sur Tentacle</Text>
        <Text style={styles.subtitle}>
          Entrez l'adresse de votre serveur Tentacle pour commencer.
        </Text>

        {/* Server URL Input */}
        <TextInput
          value={serverUrl}
          onChangeText={(text) => {
            setServerUrl(text);
            setError(null);
            setSuccess(false);
          }}
          placeholder="http://192.168.1.100:3000"
          placeholderTextColor="rgba(255,255,255,0.3)"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={styles.input}
        />

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Success message */}
        {success && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>Serveur connecte avec succes !</Text>
          </View>
        )}

        {!success ? (
          <>
            {/* Connect button */}
            <View style={{ marginTop: 24 }}>
              <Focusable onPress={handleTest} hasTVPreferredFocus>
                <View
                  style={[
                    styles.button,
                    (testing || !serverUrl.trim()) && styles.buttonDisabled,
                  ]}
                >
                  {testing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Verifier le serveur</Text>
                  )}
                </View>
              </Focusable>
            </View>
            <Text style={styles.helpText}>
              Utilisez la telecommande pour saisir l'adresse de votre serveur.
            </Text>
          </>
        ) : (
          <>
            {/* After successful health check: choose auth method */}
            <Text style={styles.choiceTitle}>Comment souhaitez-vous vous connecter ?</Text>
            <View style={{ marginTop: 16 }}>
              <Focusable onPress={() => navigation.replace("PairCode")} hasTVPreferredFocus>
                <View style={styles.button}>
                  <Text style={styles.buttonText}>Jumeler avec un code</Text>
                  <Text style={styles.choiceHint}>
                    Entrez un code sur votre telephone ou ordinateur
                  </Text>
                </View>
              </Focusable>
            </View>
            <View style={{ marginTop: 12 }}>
              <Focusable onPress={() => navigation.replace("Login")}>
                <View style={styles.buttonOutline}>
                  <Text style={styles.buttonText}>Se connecter manuellement</Text>
                  <Text style={styles.choiceHint}>Saisir identifiant et mot de passe</Text>
                </View>
              </Focusable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "#0a0a0f",
  },
  card: {
    width: 500,
    padding: 48,
    backgroundColor: "#12121a",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1e1e2e",
  },
  logo: {
    color: "#8b5cf6",
    fontSize: 42,
    fontWeight: "800" as const,
    textAlign: "center" as const,
    marginBottom: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700" as const,
    textAlign: "center" as const,
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 16,
    textAlign: "center" as const,
    marginBottom: 32,
    lineHeight: 22,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "#1e1e2e",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: "#fff",
    fontSize: 18,
  },
  errorContainer: {
    marginTop: 16,
    backgroundColor: "rgba(239,68,68,0.1)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center" as const,
  },
  successContainer: {
    marginTop: 16,
    backgroundColor: "rgba(34,197,94,0.1)",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
  },
  successText: {
    color: "#22c55e",
    fontSize: 14,
    textAlign: "center" as const,
  },
  button: {
    backgroundColor: "#8b5cf6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center" as const,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonSuccess: {
    backgroundColor: "#22c55e",
  },
  buttonOutline: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: "#8b5cf6",
    backgroundColor: "transparent",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  choiceTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    textAlign: "center" as const,
    marginTop: 24,
    fontWeight: "600" as const,
  },
  choiceHint: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
    marginTop: 4,
  },
  helpText: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 13,
    textAlign: "center" as const,
    marginTop: 24,
  },
};
