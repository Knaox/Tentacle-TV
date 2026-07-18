import { useEffect, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useStreamingConfig, useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";

/**
 * Bandeau discret « jumelage expiré » : le backend signale `tokenExpired` quand
 * le token Jellyfin de l'appareil est mort côté serveur ET que le self-healing
 * (token d'un appareil frère) n'a rien pu re-fournir. La sauvegarde de
 * progression est alors en pause (playstate impossible via le proxy — clé admin
 * sans contexte user, Jellyfin 10.11) : sans ce bandeau, la position se perdait
 * en silence. Informatif, non focusable ; disparaît seul dès qu'un token frais
 * revient (poll 5 min ou re-jumelage).
 */
export function PairingExpiredBanner() {
  const { t } = useTranslation("pairing");
  const { storage } = useTentacleConfig();
  // Token réactif (même pattern que DirectStreamingSync) : le composant est
  // monté avant le login/re-jumelage. La query streaming-config est partagée
  // avec DirectStreamingSync (même queryKey) → aucune requête supplémentaire.
  const [token, setToken] = useState<string | null>(storage.getItem("tentacle_token"));
  useEffect(() => {
    const id = setInterval(() => {
      const cur = storage.getItem("tentacle_token");
      setToken((prev) => (cur !== prev ? cur : prev));
    }, 2000);
    return () => clearInterval(id);
  }, [storage]);
  const { data } = useStreamingConfig(token);

  if (!data?.tokenExpired) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Text style={styles.text}>{t("pairingExpiredBanner")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", top: 24, alignSelf: "center",
    backgroundColor: "rgba(24, 18, 6, 0.92)",
    borderColor: "rgba(251, 191, 36, 0.55)", borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10,
    maxWidth: 900,
  },
  text: { color: "#fbbf24", fontSize: 18, fontWeight: "600", textAlign: "center" },
});
