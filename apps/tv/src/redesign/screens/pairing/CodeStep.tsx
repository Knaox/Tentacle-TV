import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { ArtworkHalo } from "../../background/ArtworkHalo";
import { FocusGroup } from "../../focus/FocusGroup";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { PillButton } from "../../controls/PillButton";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon } from "../../icons/Icon";
import { colors, fonts, text } from "../../theme/tokens";
import { CARD_HEIGHT, CARD_RADIUS, CARD_WIDTH, CodeCard } from "./CodeCard";
import type { CodeState } from "./pairingTypes";

/**
 * L'écran du code — celui du relais comme celui du serveur saisi à la main.
 * À gauche, ce qu'il faut faire, en trois gestes numérotés — et, pour le
 * serveur, « Changer de serveur » (la sortie du relais est la croix Retour,
 * posée par `PairingView`) ; à droite, la carte du code.
 *
 * Branchement : relais → `useRelayGenerate` / `useRelayStatus` ; serveur →
 * `useDevicePairGenerate` / `useDevicePairStatus`. Le compte à rebours
 * (5 min) est tenu par l'intégration, qui passe `remainingSeconds`.
 *
 * Groupes de focus : `pairing:side` (la colonne de gauche et « Changer de
 * serveur » — une colonne sans rien de focalisable, celle du relais, n'est
 * pas un groupe : son guide serait une cible vide) et `pairing:card` (la
 * carte du code). Leurs boutons ne sont pas alignés : l'intégration y pose
 * des guides pour que GAUCHE et DROITE passent de l'un à l'autre.
 */

const STEPS = ["pairing:tvStepOpenApp", "pairing:tvStepPairTv", "pairing:tvStepEnterCode"];

export const CodeStep = memo(function CodeStep({ source, code, serverUrl, palette, onRetry, onManualSetup, onChangeServer }: {
  source: "relay" | "server";
  code: CodeState;
  /** La lumière qui déborde de la carte du code. */
  palette: ArtworkPalette;
  serverUrl?: string;
  onRetry?: () => void;
  onManualSetup?: () => void;
  onChangeServer?: () => void;
}) {
  const { t } = useTranslation(["pairing", "common"]);
  const relay = source === "relay";
  const side = (
    <>
      <Text style={styles.title}>{t("pairing:tvPairTitle")}</Text>
      {serverUrl ? (
        <View style={styles.server}>
          <Icon name="server" size={26} color={colors.textTertiary} />
          <Text style={styles.serverLabel}>{t("pairing:tvServeur")}</Text>
          <Text style={styles.serverUrl} numberOfLines={1}>{serverUrl}</Text>
        </View>
      ) : null}
      <View style={styles.steps}>
        {STEPS.map((step, index) => (
          <View key={step} style={styles.step}>
            <GlassSurface radius={32} tone="clear" style={styles.number}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </GlassSurface>
            <Text style={styles.stepText}>{t(step)}</Text>
          </View>
        ))}
      </View>
      {relay ? null : (
        <View style={styles.exit}>
          <PillButton icon="server" label={t("pairing:changeServer")} focusKey="pairing:changeServer" onPress={onChangeServer} />
        </View>
      )}
    </>
  );
  return (
    <View style={styles.row}>
      {relay ? (
        <View style={styles.left}>{side}</View>
      ) : (
        <FocusGroup focusKey="pairing:side" style={styles.left}>
          {side}
        </FocusGroup>
      )}
      <FocusGroup focusKey="pairing:card">
        <ArtworkHalo width={CARD_WIDTH} height={CARD_HEIGHT} radius={CARD_RADIUS} palette={palette} opacity={0.3} spread={18} />
        <CodeCard
          code={code}
          onRetry={onRetry}
          fallback={relay ? { label: t("pairing:configureManually"), onPress: onManualSetup } : undefined}
        />
      </FocusGroup>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: TV_STAGE.safe.x + 40,
    paddingRight: TV_STAGE.safe.x,
  },
  left: { width: 760, gap: 40 },
  title: { ...text.title, fontSize: 64, lineHeight: 72, letterSpacing: -1.2 },
  server: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: -16 },
  serverLabel: { ...fonts.bold, fontSize: 22, letterSpacing: 2, textTransform: "uppercase", color: colors.textTertiary },
  serverUrl: { ...fonts.semibold, fontSize: 26, color: colors.textSecondary, flexShrink: 1 },
  steps: { gap: 26 },
  step: { flexDirection: "row", alignItems: "center", gap: 24 },
  number: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  numberText: { ...fonts.extrabold, fontSize: 28, color: colors.text },
  stepText: { ...fonts.medium, flex: 1, fontSize: 30, lineHeight: 40, color: colors.textSecondary },
  exit: { flexDirection: "row", marginTop: 12 },
});
