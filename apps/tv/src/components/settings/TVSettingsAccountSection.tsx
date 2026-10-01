import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import LinearGradient from "react-native-linear-gradient";
import { useAccountActions } from "../../hooks/useAccountActions";
import { usePairedAccount } from "../../hooks/usePairedAccount";
import { Focusable } from "../focus/Focusable";
import { Colors, brandAlpha } from "../../theme/colors";
import { Button } from "../../theme/buttons";

/** Le portrait, à la taille d'une dalle regardée de loin (parité LG : 132). */
const PORTRAIT_SIZE = 132;

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
 * La déconnexion passe par le déjumelage commun (`unpairDevice`) — purge
 * complète, révocation côté serveur — et non par une purge locale recopiée :
 * `useAccountActions`, commun aux deux téléviseurs.
 */
export function TVSettingsAccountSection() {
  const { t } = useTranslation(["pairing", "nav", "common"]);
  const { serverUrl } = usePairedAccount(PORTRAIT_SIZE);
  const { logout: handleLogout, changeServer: handleChangeServer } = useAccountActions();

  return (
    <View>
      <Profile />

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
function Profile() {
  const { t } = useTranslation("pairing");
  const { name, portraitUrl } = usePairedAccount(PORTRAIT_SIZE);
  const [failed, setFailed] = useState(false);

  const url = portraitUrl && !failed ? portraitUrl : null;
  const initial = (name ?? "?").charAt(0).toUpperCase();

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 28 }}>
      <View
        style={{
          width: PORTRAIT_SIZE,
          height: PORTRAIT_SIZE,
          borderRadius: PORTRAIT_SIZE / 2,
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
              onError={() => setFailed(true)}
            />
          ) : (
            <Text style={{ color: "#ffffff", fontSize: 48, fontWeight: "700" }}>{initial}</Text>
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
          {name ?? "—"}
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
  const [armed, setArmed] = useState(false);

  return (
    <Focusable
      variant="button"
      focusRadius={Button.pill.borderRadius}
      onPress={() => {
        if (!armed) { setArmed(true); return; }
        setArmed(false);
        onConfirmed();
      }}
      onBlur={() => setArmed(false)}
      accessibilityLabel={armed ? confirmLabel : label}
    >
      <View
        style={{
          paddingHorizontal: 26,
          paddingVertical: 14,
          ...Button.pill,
          backgroundColor: armed
            ? (danger ? "rgba(239, 68, 68, 0.22)" : brandAlpha(0.22))
            : Colors.ctaGhostBg,
          borderWidth: 1,
          borderColor: armed
            ? (danger ? "rgba(239, 68, 68, 0.6)" : brandAlpha(0.6))
            : Colors.ctaGhostBorder,
        }}
      >
        <Text
          style={{
            color: armed && danger ? "#fca5a5" : Colors.textPrimary,
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          {armed ? `${confirmLabel} — ${label}` : label}
        </Text>
      </View>
    </Focusable>
  );
}
