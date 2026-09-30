import { useEffect, useSyncExternalStore } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { DarkTheme, NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { i18n, initI18n } from "@tentacle-tv/shared";
import { FocusPreviewProvider } from "../../src/redesign/focus/focusPreview";
import { LiquidGlassProvider } from "../../src/redesign/glass/liquidGlassMode";
import { Catalogue } from "./chrome/Catalogue";
import { FrameMeter } from "./chrome/FrameMeter";
import { SceneHost } from "./chrome/SceneHost";
import {
  getBenchState,
  patchBench,
  publishScenes,
  startBenchPolling,
  subscribeBench,
} from "./control/benchRemote";
import { BenchDataProvider, useBenchData } from "./data/benchData";
import { SCENES } from "./scenes";

/**
 * Le banc UI de la refonte TV : les VUES de `src/redesign/`, sur un
 * instantané du compte Knaoxtest, sans compte, sans navigation de l'app et
 * sans lecteur. Servi à la place de l'app par le relais — voir `README.md`.
 */

initI18n({ lng: "fr" });
startBenchPolling();
publishScenes(SCENES.map(({ id, group, label, focusKeys }) => ({ id, group, label, focusKeys: focusKeys ?? [] })));

const useBench = () => useSyncExternalStore(subscribeBench, getBenchState);

type Routes = { Catalogue: undefined; Scene: undefined };
const Stack = createNativeStackNavigator<Routes>();

function CatalogueScreen() {
  return <Catalogue state={useBench()} />;
}

function SceneScreen() {
  const state = useBench();
  const data = useBenchData();
  if (!data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }
  return <SceneHost state={state} data={data} />;
}

export function UiBench() {
  const state = useBench();
  const nav = useNavigationContainerRef<Routes>();

  useEffect(() => {
    void i18n.changeLanguage(state.lang);
  }, [state.lang]);

  // La pile suit l'état : une scène demandée (menu ou ligne de commande)
  // pousse l'écran de scène ; plus de scène, on revient au catalogue.
  const syncStack = () => {
    if (!nav.isReady()) return;
    const onScene = nav.getCurrentRoute()?.name === "Scene";
    const wanted = getBenchState().scene !== null;
    if (wanted && !onScene) nav.navigate("Scene");
    if (!wanted && onScene) nav.goBack();
  };
  useEffect(syncStack, [state.scene, nav]);

  // Et l'inverse : Menu dépile nativement — l'état doit le savoir.
  const onStackChange = () => {
    if (nav.getCurrentRoute()?.name === "Catalogue" && getBenchState().scene !== null) {
      patchBench({ scene: null, focus: null });
    }
  };

  return (
    <BenchDataProvider>
      <FrameMeter request={state.meter} />
      <LiquidGlassProvider enabled={state.glass} allowNative={state.nativeGlass !== false}>
        <FocusPreviewProvider forcedKey={state.focus}>
          <NavigationContainer ref={nav} theme={DarkTheme} onReady={syncStack} onStateChange={onStackChange}>
            <Stack.Navigator screenOptions={{ headerShown: false, animation: "none", contentStyle: styles.screen }}>
              <Stack.Screen name="Catalogue" component={CatalogueScreen} />
              <Stack.Screen name="Scene" component={SceneScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </FocusPreviewProvider>
      </LiquidGlassProvider>
    </BenchDataProvider>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#07070c" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#07070c" },
});
