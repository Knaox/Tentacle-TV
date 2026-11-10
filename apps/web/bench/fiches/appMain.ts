// Ce que `src/main.tsx` exporte, SANS son amorçage : des modules des écrans (hors ligne,
// extensions) importent `backendUrl` de `main`, et l'importer tel quel monterait toute
// l'application dans la page du banc. `vite.config.ts` détourne cet import ici — comme le
// client LG le fait pour sa propre coquille.
export const backendUrl = "";
export function configureBackendUrls(_url: string): void {}
