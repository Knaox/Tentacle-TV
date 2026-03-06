// Step-by-step entry with explicit error logging
import { AppRegistry, View, Text } from "react-native";

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

  RootApp = function App() {
    console.log("[index.js] Step 5: Rendering ExpoRoot...");
    return <ExpoRoot context={ctx} />;
  };
  console.log("[index.js] Step 6: App component ready");
} catch (e) {
  console.error("[index.js] FATAL ERROR:", e.message, e.stack);
}

AppRegistry.registerComponent("main", () => RootApp);
console.log("[index.js] Step 7: Component registered");
