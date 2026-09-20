import { defineConfig } from "vitest/config";

// Les modules PURS du lecteur (routeur de moteur, correspondance des pistes)
// se testent sans React Native : ils n'importent ni `react-native` ni `expo`.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
