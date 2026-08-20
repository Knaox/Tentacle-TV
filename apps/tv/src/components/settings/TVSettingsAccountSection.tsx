import { useCallback, useState } from "react";
import { Image, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import LinearGradient from "react-native-linear-gradient";
import {
  setPreferencesToken,
  useAuth,
  useJellyfinClient,
  useTentacleConfig,
  useUserId,
} from "@tentacle-tv/api-client";
import { navigationRef } from "../../navigation/navigationRef";
import { doLogout } from "../../auth/sessionFlow";
import { Focusable } from "../focus/Focusable";
import { Colors, brandAlpha } from "../../theme/colors";
import { Bouton } from "../../theme/boutons";

/** Le portrait, à la taille d'une dalle regardée de loin (parité LG : 132). */
const TAILLE_PORTRAIT = 132;

/**
 * Le compte : qui regarde, et comment cesser de l'être.
 *
 * Le profil (portrait + nom) vient de la LG (`AccountScreenTv`) ; les deux
 * actions viennent du rail natif, qu'elles quittent — « Changer de serveur »
 * et « Déconnexion » sont des ACQUIS de l'app installée (la LG, servie par son
 * serveur, n'a pas de serveur à changer).
 *
 * La confirmation est une SECONDE pression sur le même bouton, pas une boîte
 * de dialogue (patron LG) : sur une télécommande, un dialogue demande de
 * retrouver le bouton d'annulation. L'état se défait au blur.
 *
 * La déconnexion passe par `doLogout` — qui porte le verrou « lecture en
 * cours » — et non par une purge locale recopiée (l'ancienne modale du rail
 * dupliquait la purge SANS le verrou).
 */
export function TVSettingsAccountSection() {
  const { t } = useTranslation(["pairing", "nav", "common"]);
  const { storage } = useTentacleConfig();
  const queryClient = useQueryClient();
  const jfClient = useJellyfinClient();
  const { changeServer } = useAuth();

  const serverUrl = storage.getItem("tentacle_server_url") || "—";

  const handleLogout = useCallback(() => {
    doLogout(jfClient, storage, queryClient);
  }, [jfClient, storage, queryClient]);

  const handleChangeServer = useCallback(() => {
    changeServer.mutate(undefined, {
      onSettled: () => {
        setPreferencesToken(null);
        navigationRef.reset({ index: 0, routes: [{ name: "PairCode" }] });
      },
    });
  }, [changeServer]);

  return (
    <View>
      <Profil />

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 16, marginTop: 36, marginBottom: 36 }}>
        <Text style={{ color: Colors.textTertiary, fontSize: 14, width: 140 }}>
          {t("pairing:tvServeur")}
        </Text>
        <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: "500", flex: 1 }} numberOfLines={1}>
          {serverUrl}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 16 }}>
        <TwoPressButton label={t("nav:changeServer")} confirmLabel={t("common:confirm")} onConfirmed={handleChangeServer} />
        <TwoPressButton label={t("nav:logout")} confirmLabel={t("common:confirm")} danger onConfirmed={handleLogout} />
      </View>
      <Text style={{ color: Colors.textTertiary, fontSize: 14, lineHeight: 21, maxWidth: 640, marginTop: 14 }}>
        {t("pairing:tvOublierTexte")}
      </Text>
    </View>
  );
}

/** Le portrait et le nom. L'image vient de Jellyfin par le proxy du serveur ;
 *  le repli est l'initiale — 404 (pas de portrait) et échec réseau se
 *  traitent pareil, sans clignoter. */
function Profil() {
  const { t } = useTranslation("pairing");
  const { storage } = useTentacleConfig();
  const client = useJellyfinClient();
  const userId = useUserId();
  const [echoue, setEchoue] = useState(false);

  let nom: string | null = null;
  try {
    const brut = storage.getItem("tentacle_user");
    if (brut) {
      const parsed = JSON.parse(brut) as { Name?: unknown };
      if (typeof parsed.Name === "string" && parsed.Name.length > 0) nom = parsed.Name;
    }
  } catch { /* nom absent : l'initiale de repli suffit */ }

  const url =
    userId && !echoue
      ? `${client.getBaseUrl()}/Users/${userId}/Images/Primary?maxWidth=${TAILLE_PORTRAIT * 2}&quality=90`
      : null;
  const initiale = (nom ?? "?").charAt(0).toUpperCase();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 28 }}>
      <View
        style={{
          width: TAILLE_PORTRAIT,
          height: TAILLE_PORTRAIT,
          borderRadius: TAILLE_PORTRAIT / 2,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: brandAlpha(0.22),
        }}
      >
        <LinearGradient
          colors={[Colors.accentPurple, Colors.accentPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          {url ? (
            <Image
              source={{ uri: url }}
              style={{ width: "100%", height: "100%" }}
              onError={() => setEchoue(true)}
            />
          ) : (
            <Text style={{ color: "#ffffff", fontSize: 48, fontWeight: "700" }}>{initiale}</Text>
          )}
        </LinearGradient>
      </View>

      <View>
        <Text
          style={{
            color: Colors.textTertiary,
            fontSize: 13,
            letterSpacing: 1.1,
            textTransform: "uppercase",
          }}
        >
          {t("tvCompteJumele")}
        </Text>
        <Text style={{ color: Colors.textPrimary, fontSize: 34, fontWeight: "700", marginTop: 6 }}>
          {nom ?? "—"}
        </Text>
      </View>
    </View>
  );
}

/** Un bouton destructif à DEUX appuis : le premier arme (le libellé devient
 *  « Confirmer »), le second exécute, le blur désarme. */
function TwoPressButton({
  label,
  confirmLabel,
  danger,
  onConfirmed,
}: {
  label: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirmed: () => void;
}) {
  const [arme, setArme] = useState(false);

  return (
    <Focusable
      variant="button"
      focusRadius={Bouton.pilule.borderRadius}
      onPress={() => {
        if (!arme) { setArme(true); return; }
        setArme(false);
        onConfirmed();
      }}
      onBlur={() => setArme(false)}
      accessibilityLabel={arme ? confirmLabel : label}
    >
      <View
        style={{
          paddingHorizontal: 26,
          paddingVertical: 14,
          ...Bouton.pilule,
          backgroundColor: arme
            ? (danger ? "rgba(239, 68, 68, 0.22)" : brandAlpha(0.22))
            : Colors.ctaGhostBg,
          borderWidth: 1,
          borderColor: arme
            ? (danger ? "rgba(239, 68, 68, 0.6)" : brandAlpha(0.6))
            : Colors.ctaGhostBorder,
        }}
      >
        <Text
          style={{
            color: arme && danger ? "#fca5a5" : Colors.textPrimary,
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          {arme ? `${confirmLabel} — ${label}` : label}
        </Text>
      </View>
    </Focusable>
  );
}
