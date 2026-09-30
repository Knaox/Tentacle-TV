import { useEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BRAND, TEXT } from "@tentacle-tv/shared/theme";
import { TV_OVERSCAN_PT } from "@tentacle-tv/theme";
import { patchBench, signalReady, type BenchState } from "../control/benchRemote";
import { useBenchLoad } from "../data/benchData";
import { SCENES } from "../scenes";
import { BenchButton } from "./BenchButton";

/**
 * Le catalogue : toutes les scènes, rangées par écran, et les trois
 * interrupteurs globaux. Au clavier du simulateur : flèches, Entrée ; Échap
 * (Menu) revient ici depuis une scène.
 */
export function Catalogue({ state }: { state: BenchState }) {
  const load = useBenchLoad();
  const groups = useMemo(() => {
    const byGroup = new Map<string, typeof SCENES>();
    for (const scene of SCENES) byGroup.set(scene.group, [...(byGroup.get(scene.group) ?? []), scene]);
    return [...byGroup.entries()];
  }, []);

  // Le catalogue est une révision comme une autre : la capture l'attend aussi.
  // Seulement quand c'est bien lui qu'on demande : pendant qu'une scène
  // s'ouvre, il reste monté sous elle et ne doit pas répondre à sa place.
  useEffect(() => {
    if (load.status === "loading" || state.scene !== null) return;
    const timer = setTimeout(() => signalReady(state.rev), 500);
    return () => clearTimeout(timer);
  }, [state.rev, state.scene, load.status]);

  const snapshot = load.status === "loading" ? null : load.data.snapshot;
  const source = !snapshot
    ? "Chargement de l'instantané…"
    : load.status === "missing"
      ? "Aucun instantané : les scènes montrent leurs états vides."
      : `${snapshot.account} · ${Object.keys(snapshot.items).length} éléments · ${snapshot.capturedAt.slice(0, 10)}`;

  return (
    <View style={styles.root}>
      <View style={styles.side}>
        <Text style={styles.title}>Banc UI</Text>
        <Text style={styles.subtitle}>Refonte Apple TV · {SCENES.length} scènes</Text>
        <Text style={styles.source}>{source}</Text>
        <View style={styles.toggles}>
          <BenchButton
            preferred
            label={`Liquid Glass : ${state.glass ? "activé" : "coupé"}`}
            active={!state.glass}
            onPress={() => patchBench({ glass: !state.glass })}
          />
          <BenchButton
            label={`Langue : ${state.lang === "fr" ? "français" : "anglais"}`}
            active={state.lang !== "fr"}
            onPress={() => patchBench({ lang: state.lang === "fr" ? "en" : "fr" })}
          />
        </View>
        <Text style={styles.hint}>
          Échap (Menu) : revenir ici.{"\n"}Lecture/Pause dans une scène : figer le focus sur l'élément suivant.
        </Text>
      </View>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {groups.map(([group, scenes]) => (
          <View key={group} style={styles.group}>
            <Text style={styles.groupTitle}>{group}</Text>
            <View style={styles.chips}>
              {scenes.map((scene) => (
                <BenchButton
                  key={scene.id}
                  label={scene.label}
                  detail={scene.focusKeys?.length ? `${scene.focusKeys.length} focus` : undefined}
                  onPress={() => patchBench({ scene: scene.id, focus: null })}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: "#07070c" },
  side: {
    width: 600,
    paddingLeft: TV_OVERSCAN_PT.x,
    paddingRight: 40,
    paddingTop: TV_OVERSCAN_PT.y + 20,
    gap: 18,
    backgroundColor: "rgba(139, 92, 246, 0.07)",
  },
  title: { color: TEXT.primary, fontSize: 56, fontWeight: "800" },
  subtitle: { color: BRAND.light, fontSize: 28, fontWeight: "600" },
  source: { color: TEXT.secondary, fontSize: 24, lineHeight: 32 },
  toggles: { marginTop: 24, gap: 16, alignItems: "flex-start" },
  hint: { marginTop: 24, color: TEXT.tertiary, fontSize: 22, lineHeight: 32 },
  list: { flex: 1 },
  listContent: { paddingTop: TV_OVERSCAN_PT.y + 20, paddingBottom: 200, paddingLeft: 56, paddingRight: TV_OVERSCAN_PT.x, gap: 44 },
  group: { gap: 18 },
  groupTitle: { color: TEXT.primary, fontSize: 36, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
});
