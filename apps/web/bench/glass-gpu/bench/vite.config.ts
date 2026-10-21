// Construction de PRODUCTION de la page du banc GPU (jamais le serveur de
// développement : sa boucle d'images fausserait toute mesure au repos).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react()],
  logLevel: "warn",
  build: { emptyOutDir: true, sourcemap: false },
});
