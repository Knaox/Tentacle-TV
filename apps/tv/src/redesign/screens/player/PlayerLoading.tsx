import { memo } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { SoftGradient, STAGE_SIZE } from "../../background/SoftGradient";
import { BACK_TOP, BackButton } from "../../controls/BackButton";
import { PillButton } from "../../controls/PillButton";
import { Icon } from "../../icons/Icon";
import { TitleArt } from "../../hero/TitleArt";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import type { PlayerMedia, PlayerPhase } from "./playerTypes";

/**
 * L'écran d'ouverture du média — il couvre tout, habillage compris, tant que
 * la première image n'est pas là. Le fond de l'œuvre, assombri ; en bas à
 * gauche, son logo, l'épisode, et ce qui se passe :
 * - résolution : le jalon PrismCore (« Indexation (premier visionnage)… »)
 *   et les étapes franchies — la seule attente longue, qui mérite d'être dite ;
 * - démarrage : l'indicateur seul ;
 * - échec : le message et « Réessayer » (pilule blanche).
 * La croix Retour est toujours là, en haut à gauche : une ouverture qui
 * traîne n'enferme personne. Clés : `loading:back`, `loading:retry`.
 */

const SAFE = TV_STAGE.safe;

function Steps({ index, count }: { index: number; count: number }) {
  return (
    <View style={styles.steps}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.step, i < index && styles.stepDone, i === index && styles.stepCurrent]} />
      ))}
    </View>
  );
}

export const PlayerLoading = memo(function PlayerLoading({
  media,
  phase,
  labels,
  onBack,
  onRetry,
}: {
  media: PlayerMedia;
  phase: Exclude<PlayerPhase, { kind: "playing" }>;
  /** « Retour » est dit par la croix elle-même. */
  labels: { retry: string };
  onBack?: () => void;
  onRetry?: () => void;
}) {
  const failed = phase.kind === "failed";
  const step = phase.kind === "resolving" ? phase.step : null;
  return (
    <View style={styles.root}>
      {media.backdropUri ? <Image source={{ uri: media.backdropUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
      <SoftGradient
        {...STAGE_SIZE}
        colors={[scrim(0.94), scrim(0.72), scrim(0.34)]}
        locations={[0, 0.48, 1]}
        start={{ x: 0, y: 0.8 }}
        end={{ x: 1, y: 0.2 }}
      />
      <SoftGradient {...STAGE_SIZE} colors={[scrim(0.45), scrim(0), scrim(0.9)]} locations={[0, 0.36, 1]} />
      <View style={styles.back}>
        <BackButton focusKey="loading:back" onPress={onBack} />
      </View>
      <View style={styles.block}>
        <TitleArt title={media.title} logoUri={media.logoUri} maxWidth={620} maxHeight={140} fontSize={72} />
        {media.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{media.subtitle}</Text> : null}
        {failed ? (
          <View style={styles.failure}>
            <View style={styles.messageRow}>
              <View style={styles.alert}>
                <Icon name="alert" size={28} color={colors.text} strokeWidth={2.2} />
              </View>
              <Text style={styles.message}>{phase.message}</Text>
            </View>
            <View style={styles.actions}>
              <PillButton variant="primary" icon="refresh" label={labels.retry} focusKey="loading:retry" onPress={onRetry} />
            </View>
          </View>
        ) : (
          <View style={styles.progress}>
            <View style={styles.status}>
              <View style={styles.spinner}>
                <ActivityIndicator size="large" color={colors.text} />
              </View>
              {step ? <Text style={styles.stepLabel} numberOfLines={1}>{step.label}</Text> : null}
            </View>
            {step ? <Steps index={step.index} count={step.count} /> : null}
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  back: { position: "absolute", top: BACK_TOP, left: SAFE.x },
  block: { position: "absolute", left: SAFE.x, bottom: SAFE.y + 40, width: 1100, gap: 18 },
  subtitle: { ...fonts.semibold, fontSize: 30, lineHeight: 38, color: white(0.86) },
  progress: { gap: 18, marginTop: 18 },
  status: { flexDirection: "row", alignItems: "center", gap: 18, height: 64 },
  spinner: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  stepLabel: { ...fonts.medium, fontSize: 28, color: white(0.82) },
  steps: { flexDirection: "row", gap: 10 },
  step: { width: 72, height: 8, borderRadius: 4, backgroundColor: white(0.2) },
  stepDone: { backgroundColor: white(0.85) },
  stepCurrent: { backgroundColor: colors.accent },
  failure: { gap: 26, marginTop: 18 },
  messageRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  alert: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.error },
  message: { ...fonts.medium, fontSize: 28, lineHeight: 38, color: white(0.9), maxWidth: 900, flexShrink: 1 },
  actions: { flexDirection: "row", gap: 18 },
});
