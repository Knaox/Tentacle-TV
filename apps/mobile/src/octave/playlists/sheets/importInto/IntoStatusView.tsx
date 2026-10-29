/**
 * Octave mobile — où en est l'import d'un album ou de fichiers vers une playlist : l'envoi (la vue de la chaîne des
 * sorties : fichier par fichier, pause, « Reprendre »), l'ajout des titres, puis la fin — ce qui est entré, ce qui
 * arrive encore dans la bibliothèque, ce qui a été refusé — et « Ouvrir la playlist ».
 */

import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ImportIntoState, ReleaseFlowState } from "@tentacle-tv/api-client";
import { typography, useTheme } from "@/theme";
import { OctavePlayButton } from "../../../layout/OctavePlayButton";
import { ReleaseProgressView } from "../../../releases/ReleaseProgressView";

interface Props {
  state: ImportIntoState;
  release: ReleaseFlowState | null;
  onHide: () => void;
  onCancel: () => void;
  onResume: () => void;
  onOpen: (playlistId: string) => void;
  onRetry: () => void;
}

const noop = () => undefined;

export function IntoStatusView({ state, release, onHide, onCancel, onResume, onOpen, onRetry }: Props) {
  const { t } = useTranslation("musicImport");
  const { t: tr } = useTranslation("musicReleases");
  const theme = useTheme();

  if ((state.phase === "files" || state.phase === "paused") && release) {
    return <ReleaseProgressView state={release} onHide={onHide} onCancel={onCancel} onResume={onResume} onOpen={noop} onAnother={noop} />;
  }
  if (state.phase === "files" || state.phase === "paused" || state.phase === "filling") {
    return (
      <View style={styles.waiting} accessibilityLiveRegion="polite">
        <ActivityIndicator color={theme.colors.text.tertiary} />
        <View style={styles.flex}>
          <Text style={[typography.bodyBold, { color: theme.colors.text.primary }]}>{t(state.phase === "filling" ? "filling" : "sending")}</Text>
          {state.label ? <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary }]}>{state.label}</Text> : null}
        </View>
      </View>
    );
  }
  const result = state.result;
  if (state.phase === "done" && result) {
    return (
      <>
        <Text accessibilityLiveRegion="polite" style={[typography.subtitle, { color: theme.colors.text.primary }]}>{t("doneTitle", { name: result.name })}</Text>
        <Text style={[typography.body, { color: theme.colors.text.secondary }]}>{t("intoDone", { count: result.added, name: result.name })}</Text>
        {result.pending > 0 ? <Text style={[typography.body, { color: theme.colors.text.tertiary }]}>{t("intoPending", { count: result.pending })}</Text> : null}
        {result.refused > 0 ? <Text style={[typography.body, { color: theme.colors.statusPairs.warning.fg }]}>{t("intoRefused", { count: result.refused })}</Text> : null}
        <OctavePlayButton label={t("open")} Icon={null} onPress={() => onOpen(result.playlistId)} style={styles.primary} />
      </>
    );
  }
  // Un refus de la chaîne des sorties a ses mots là-bas ; ceux de l'ajout, ici.
  const failure = state.failure ?? "failed";
  const message = failure === "empty" || failure === "failed" || failure === "network" ? t(`intoFailure.${failure}`) : tr(`refusal.${failure}`);
  return (
    <>
      <Text accessibilityRole="alert" style={[typography.body, { color: theme.colors.status.error }]}>{message}</Text>
      <OctavePlayButton label={t("retry")} Icon={null} onPress={onRetry} style={styles.primary} />
    </>
  );
}

const styles = StyleSheet.create({
  waiting: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  flex: { flex: 1, minWidth: 0 },
  primary: { marginTop: 4 },
});
