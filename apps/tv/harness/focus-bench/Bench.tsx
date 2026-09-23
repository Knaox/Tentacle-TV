import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { JellyfinClientContext, TentacleConfigContext } from "@tentacle-tv/api-client";
import { initI18n } from "@tentacle-tv/shared";
import { Focusable } from "../../src/components/focus/Focusable";
import { TVNavProvider } from "../../src/context/TVNavContext";
import { Colors } from "../../src/theme/colors";
import { createBenchClient } from "./fixtures";
import { EpisodesScene, FiltersScene, RowsScene } from "./scenes";

/**
 * Le banc de focus : les composants de l'app, sans compte ni serveur, pour
 * éprouver le D-pad sur un émulateur Android TV jamais jumelé. Servi à la
 * place de l'app par un relais devant Metro — voir `README.md`.
 */

initI18n({ lng: "fr" });

type Scene = "rows" | "episodes" | "filters";

const SCENES: Array<{ id: Scene; label: string }> = [
  { id: "rows", label: "Carrousels" },
  { id: "episodes", label: "Panneau des épisodes" },
  { id: "filters", label: "Filtres de bibliothèque" },
];

/** Ce que `useUserId` lit : un identifiant factice, aucun jeton. */
const benchStorage = {
  getItem: (key: string) => (key === "tentacle_user" ? JSON.stringify({ Id: "bench-user" }) : null),
  setItem: () => undefined,
  removeItem: () => undefined,
};
const benchUuid = { randomUUID: () => `bench-${Math.random().toString(36).slice(2)}` };

const Stack = createNativeStackNavigator();

function BenchScreen() {
  const [scene, setScene] = useState<Scene | null>(null);
  const exit = () => setScene(null);

  if (scene === "rows") return <RowsScene onExit={exit} />;
  if (scene === "episodes") return <EpisodesScene onExit={exit} />;
  if (scene === "filters") return <FiltersScene onExit={exit} />;

  return (
    <View style={{ flex: 1, padding: 80, gap: 20 }}>
      <Text style={{ color: "#fff", fontSize: 32, fontWeight: "700" }}>Banc de focus</Text>
      {SCENES.map((s, i) => (
        <Focusable key={s.id} variant="button" focusRadius={12} style={{ alignSelf: "flex-start" }} onPress={() => setScene(s.id)} hasTVPreferredFocus={i === 0}>
          <View style={{ paddingHorizontal: 24, paddingVertical: 14, backgroundColor: Colors.ctaGhostBg, borderRadius: 12 }}>
            <Text style={{ color: "#fff", fontSize: 20 }}>{s.label}</Text>
          </View>
        </Focusable>
      ))}
    </View>
  );
}

export function Bench() {
  const queryClient = useMemo(() => new QueryClient(), []);
  const client = useMemo(() => createBenchClient(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <TentacleConfigContext.Provider value={{ storage: benchStorage, uuid: benchUuid }}>
        <JellyfinClientContext.Provider value={client}>
          <TVNavProvider>
            <NavigationContainer theme={DarkTheme}>
              <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bgDeep } }}>
                <Stack.Screen name="Bench" component={BenchScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </TVNavProvider>
        </JellyfinClientContext.Provider>
      </TentacleConfigContext.Provider>
    </QueryClientProvider>
  );
}
