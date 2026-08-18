import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { TentacleLogo } from "../icons/TentacleLogo";
import { TV_PLATFORM_LABEL } from "../../lib/platformLabel";
import { Colors } from "../../theme/colors";

// Source unique des versions : versions.json à la racine du monorepo (champ tv).
const APP_VERSION: string = require("../../../../../versions.json").tv ?? "0.9.2";

/**
 * À propos — ce qu'on vient lire quand quelque chose ne va pas : la version,
 * le serveur, le compte, l'appareil, puis ce que fait l'application. RIEN
 * n'est focusable (parité `AboutScreenTv` webOS) : cette page n'agit pas, la
 * colonne de sections la porte déjà. Les libellés passent par les clés
 * `pairing` — les trois chaînes en dur (« Server », « User », « Platform »)
 * de l'ancien écran n'étaient jamais traduites.
 */
export function TVSettingsAboutSection() {
  const { t } = useTranslation(["about", "pairing"]);
  const { storage } = useTentacleConfig();

  const serverUrl = storage.getItem("tentacle_server_url") || "—";
  const userRaw = storage.getItem("tentacle_user");
  let username = "—";
  if (userRaw) {
    try {
      const parsed = JSON.parse(userRaw) as { Name?: string; username?: string; name?: string };
      username = parsed.Name || parsed.username || parsed.name || "—";
    } catch { username = "—"; }
  }

  const features = [
    t("about:featurePlayer"),
    t("about:featureResume"),
    t("about:featureRequests"),
    t("about:featureAdaptive"),
    t("about:featureNotifications"),
  ];

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 20, marginBottom: 36 }}>
        <TentacleLogo size={64} />
        <View>
          <Text style={{ color: Colors.textPrimary, fontSize: 26, fontWeight: "800" }}>
            Tentacle TV
          </Text>
          <Text style={{ color: Colors.textTertiary, fontSize: 15, marginTop: 4 }}>
            {t("about:version", { version: APP_VERSION })}
          </Text>
        </View>
      </View>

      <View style={{ gap: 14, marginBottom: 36 }}>
        <InfoRow label={t("pairing:tvServeur")} value={serverUrl} />
        <InfoRow label={t("pairing:tvCompteJumele")} value={username} />
        <InfoRow label={t("pairing:tvPlateforme")} value={TV_PLATFORM_LABEL} />
      </View>

      <Text style={{ color: Colors.textSecondary, fontSize: 15, lineHeight: 23, maxWidth: 760, marginBottom: 36 }}>
        {t("about:description")}
      </Text>

      <Text
        style={{
          color: Colors.textTertiary,
          fontSize: 13,
          fontWeight: "600",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 14,
        }}
      >
        {t("about:features")}
      </Text>
      <View style={{ gap: 10, marginBottom: 36 }}>
        {features.map((feature) => (
          <View key={feature} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accentPink }} />
            <Text style={{ color: Colors.textSecondary, fontSize: 15 }}>{feature}</Text>
          </View>
        ))}
      </View>

      <Text style={{ color: Colors.textTertiary, fontSize: 12 }}>
        {t("about:copyright", { version: APP_VERSION, year: new Date().getFullYear() })}
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 16 }}>
      <Text style={{ color: Colors.textTertiary, fontSize: 14, width: 140 }}>{label}</Text>
      <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: "500", flex: 1 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
