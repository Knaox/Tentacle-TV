// Step-by-step entry with explicit error logging + theme bootstrap.
import { AppRegistry, View, Text } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyThemeOverride } from "@tentacle-tv/shared";

const THEME_KEY = "tentacle_theme_tokens";

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
  // at *module evaluation time*. Many screens reference `BRAND.violet`,
  // `colors.accentPurple`, etc. at the top level — once captured, those
  // values cannot react to a later `applyThemeOverride()` call. By delaying
  // <ExpoRoot> mount until after AsyncStorage has been read + tokens
  // applied, the first import of any screen sees the *admin-configured*
  // colors and bakes them into its StyleSheet. Subsequent admin changes
  // still require a cold restart, but boot now picks up the live theme.
  RootApp = function App() {
    const [themed, setThemed] = useState(false);
    useEffect(() => {
      let done = false;
      AsyncStorage.getItem(THEME_KEY)
        .then((json) => {
          if (json) {
            try { applyThemeOverride(JSON.parse(json)); }
            catch (e) { console.warn("[index.js] bad theme tokens cache:", e?.message); }
          }
        })
        .catch((e) => console.warn("[index.js] theme cache read failed:", e?.message))
        .finally(() => { if (!done) setThemed(true); });
      return () => { done = true; };
    }, []);
    if (!themed) {
      // Tiny black splash — bridges the ~5ms it takes to read AsyncStorage.
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
