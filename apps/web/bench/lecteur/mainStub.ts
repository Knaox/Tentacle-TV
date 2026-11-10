// `src/main.tsx` démarre toute l'application ; les modules du lecteur n'en lisent que l'adresse
// du serveur. Le banc leur rend celle-ci — même origine, où le faux serveur répond.
export const backendUrl = "";
export function configureBackendUrls(): void {}
