// Construction de PRODUCTION de la page du banc (comme `bench/glass-gpu`) :
// le serveur de développement fausserait les temps de rendu.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react()],
  logLevel: "warn",
  build: { emptyOutDir: true, sourcemap: false },
});
