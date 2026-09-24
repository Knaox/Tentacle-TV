import { resolve } from "path";

/**
 * Le dossier de données du serveur : base configurée au setup, plugins,
 * dépendances partagées des plugins. `TENTACLE_DATA_DIR` le déplace — le banc
 * de bout en bout des notifications y installe ses propres plugins, sans
 * toucher ceux du dépôt.
 */
export const DATA_ROOT = process.env.TENTACLE_DATA_DIR
  ? resolve(process.env.TENTACLE_DATA_DIR)
  : resolve(__dirname, "../../data");
