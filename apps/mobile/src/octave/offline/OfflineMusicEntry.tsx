/**
 * Octave (mobile) — l'entrée vers la musique GARDÉE, dans « Sur l'appareil » de
 * Tentacle (le pendant du bureau) : sans réseau, la musique gardée se retrouve
 * d'ici aussi. Toucher ouvre Octave sur « Sur cet appareil ». Rien sans le droit
 * (`musicEntryRule.ts` : compte de l'appareil, `keepOffline`, Octave sur ce serveur).
 *
 * `OfflineMusicOrEmpty` : rien de gardé côté films, mais de la musique — la carte
 * REMPLACE le message « rien sur l'appareil » (la page ne se contredit pas).
 */

import { memo, useCallback, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { octavePaths } from "@tentacle-tv/shared/octave/mode";
import { KeptGlyph } from "@/components/cards/cardGlyphs";
import { spacing } from "@/theme";
import { PressableScale } from "../layout/PressableScale";
import { setOctaveMode } from "../mode/octaveModeStore";
import { useOctaveModeFacts } from "../mode/useOctaveModeFacts";
import { useOctaveColors } from "../theme/octaveColors";
import { musicEntryVisible } from "./musicEntryRule";
import { useKeptMusic } from "./useKeptMusic";
import { useMusicOfflineSurface } from "./useMusicOfflineSurface";

function usePlayableCount(): number | null {
  const kept = useKeptMusic();
  return kept.loaded ? kept.tracks.filter((k) => k.status === "complete").length : null;
}

/** La porte du hors ligne d'Octave (droit du compte de l'appareil) : rien de plus n'est lu sans elle. */
function useSurfaceVisible(): boolean {
  return useMusicOfflineSurface(null).visible;
}

/** Octave existe-t-il pour ce compte (lu SEULEMENT derrière la porte du droit) ? */
function useEntryVisible(): boolean {
  const facts = useOctaveModeFacts();
  return musicEntryVisible({ surfaceVisible: true, playable: usePlayableCount(), online: !facts.offline, octave: facts.fresh, statusFailed: facts.failed, configKnown: facts.configKnown });
}

export const OfflineMusicEntry = memo(function OfflineMusicEntry() {
  return useSurfaceVisible() ? <EntryGate /> : null;
});

function EntryGate() {
  return useEntryVisible() ? <EntryCard /> : null;
}

export function OfflineMusicOrEmpty({ fallback, topInset = 0 }: { fallback: ReactNode; topInset?: number }) {
  if (!useSurfaceVisible()) return <>{fallback}</>;
  return <EntryOrFallback fallback={fallback} topInset={topInset} />;
}

function EntryOrFallback({ fallback, topInset }: { fallback: ReactNode; topInset: number }) {
  const visible = useEntryVisible();
  if (usePlayableCount() === null) return null;
  return visible ? <View style={{ paddingTop: topInset }}><EntryCard /></View> : <>{fallback}</>;
}

function EntryCard() {
  const { t } = useTranslation("musicOffline");
  const colors = useOctaveColors();
  const router = useRouter();
  const count = usePlayableCount();
  const open = useCallback(() => {
    setOctaveMode(true);
    router.replace(octavePaths.device as Href);
  }, [router]);
  if (!count) return null;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${t("entry.title")}, ${t("entry.subtitle", { count })}`} onPress={open} style={[styles.card, { backgroundColor: colors.raised, borderColor: colors.line }]}>
      <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
        <KeptGlyph size={26} color={colors.accentText} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{t("entry.title")}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>{t("entry.subtitle", { count })}</Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.screenPadding,
    marginVertical: spacing.md,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, fontWeight: "700" },
  subtitle: { fontSize: 14 },
});
