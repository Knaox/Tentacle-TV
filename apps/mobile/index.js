// Step-by-step entry with explicit error logging + theme bootstrap.
import { AppRegistry, View, Text } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyThemeOverride } from "@tentacle-tv/shared";
import { sanitizeThemeMode, setBootThemeMode } from "./src/theme/themeMode";

const THEME_KEY = "tentacle_theme_tokens";
const THEME_MODE_KEY = "tentacle_theme_mode";

// Fallback in case everything else fails
function FallbackApp() {
  return (
    <View style={{ flex: 1, backgroundColor: "orange", justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "white", fontSize: 24 }}>FALLBACK - ExpoRoot failed</Text>
    </View>
  );
}

let RootApp = FallbackApp;

try {
  console.log("[index.js] Step 1: Loading expo-router...");
  const { ExpoRoot } = require("expo-router");
  console.log("[index.js] Step 2: ExpoRoot loaded:", typeof ExpoRoot);

  console.log("[index.js] Step 3: Creating require.context...");
  const ctx = require.context("./app");
  console.log("[index.js] Step 4: Context created, keys:", ctx.keys());

  // Why this gate exists: RN `StyleSheet.create` snapshots its color values
  // at *module evaluation time*. Non-migrated screens referencing
  // `BRAND.violet`, `colors.accent`, etc. at the top level bake those values
  // once captured — they cannot react to a later `applyThemeOverride()` call.
  // By delaying <ExpoRoot> mount until after AsyncStorage has been read:
  //  1. brand tokens are applied so the first import of any screen sees the
  //     admin-configured colors (files migrated to useThemedStyles re-render
  //     live and don't depend on this anymore);
  //  2. the appearance mode (light/dark/auto) is posed via setBootThemeMode
  //     BEFORE the first render — Appearance.setColorScheme is applied, so
  //     useColorScheme() and native elements are correct from frame one.
  RootApp = function App() {
    const [themed, setThemed] = useState(false);
    useEffect(() => {
      let done = false;
      AsyncStorage.multiGet([THEME_KEY, THEME_MODE_KEY])
        .then((pairs) => {
          let tokensJson = null;
          let modeRaw = null;
          for (const [key, value] of pairs) {
            if (key === THEME_KEY) tokensJson = value;
            else if (key === THEME_MODE_KEY) modeRaw = value;
          }
          if (tokensJson) {
            try { applyThemeOverride(JSON.parse(tokensJson)); }
            catch (e) { console.warn("[index.js] bad theme tokens cache:", e?.message); }
          }
          setBootThemeMode(sanitizeThemeMode(modeRaw));
        })
        .catch((e) => {
          console.warn("[index.js] theme cache read failed:", e?.message);
          // Fallback : mode par défaut (dark) pour ne pas laisser l'OS en auto.
          setBootThemeMode(sanitizeThemeMode(null));
        })
        .finally(() => { if (!done) setThemed(true); });
      return () => { done = true; };
    }, []);
    if (!themed) {
      // Tiny dark splash — bridges the ~5ms AsyncStorage read. Kept dark to
      // match the (still dark) native splash; adaptive splash is a later
      // polish step.
      return <View style={{ flex: 1, backgroundColor: "#0a0a0f" }} />;
    }
    console.log("[index.js] Step 5: Rendering ExpoRoot...");
    return <ExpoRoot context={ctx} />;
  };
  console.log("[index.js] Step 6: App component ready");
} catch (e) {
  console.error("[index.js] FATAL ERROR:", e.message, e.stack);
}

AppRegistry.registerComponent("main", () => RootApp);
console.log("[index.js] Step 7: Component registered");
