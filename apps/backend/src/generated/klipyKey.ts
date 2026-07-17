/**
 * Clé Klipy de l'application — COMPILÉE dans le build de production par la CI
 * (scripts/bake-klipy-key.mjs, exécuté dans le Dockerfile avec le secret
 * GitHub KLIPY_API_KEY, AVANT `pnpm build`). Ni variable d'environnement de
 * l'image, ni docker-compose : la valeur vit uniquement dans le code compilé
 * et n'est pas modifiable par l'opérateur d'un serveur.
 *
 * Cette version du fichier (vide) est celle du repo : en dev local, le repli
 * process.env.KLIPY_API_KEY prend le relais (voir routes/gifs.ts).
 * NE JAMAIS mettre de clé en dur ici (repo public).
 */
export const BAKED_KLIPY_KEY = "";
