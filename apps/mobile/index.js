// Step-by-step entry with explicit error logging + theme bootstrap.
import { AppRegistry, View, Text } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sanitizeThemeMode, setBootThemeMode } from "./src/theme/themeMode";
import { setBootLiquidGlassEnabled } from "./src/theme/liquidGlass";

// Miroir des jetons de l'ancien thème d'administrateur (presets saisonniers
// compris) : plus jamais appliqué, effacé s'il traîne encore. Nom de clé
// conservé tel quel — c'est une clé de stockage.
const THEME_KEY = "tentacle_theme_tokens";
const THEME_MODE_KEY = "tentacle_theme_mode";
const LIQUID_GLASS_KEY = "tentacle_liquid_glass";

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

  // Pourquoi cette attente : <ExpoRoot> ne se monte qu'une fois AsyncStorage
  // lu, pour que le mode d'apparence (clair, sombre, auto) soit posé par
  // setBootThemeMode AVANT le premier rendu — Appearance.setColorScheme est
  // appliqué, useColorScheme() et les éléments natifs sont justes dès la
  // première image (de même pour la préférence Liquid Glass).
  RootApp = function App() {
    const [themed, setThemed] = useState(false);
    useEffect(() => {
      let done = false;
      AsyncStorage.multiGet([THEME_KEY, THEME_MODE_KEY, LIQUID_GLASS_KEY])
        .then((pairs) => {
          let staleTokens = false;
          let modeRaw = null;
          let liquidRaw = null;
          for (const [key, value] of pairs) {
            if (key === THEME_KEY) staleTokens = value != null;
            else if (key === THEME_MODE_KEY) modeRaw = value;
            else if (key === LIQUID_GLASS_KEY) liquidRaw = value;
          }
          if (staleTokens) AsyncStorage.removeItem(THEME_KEY).catch(() => {});
          setBootThemeMode(sanitizeThemeMode(modeRaw));
          setBootLiquidGlassEnabled(liquidRaw);
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
