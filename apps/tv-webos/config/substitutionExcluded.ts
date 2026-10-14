import { resolve } from "node:path";
import { WEB } from "./substitutionPaths";

/**
 * La troisième famille de la table de substitution (`substitutionTable.ts`),
 * sortie de son fichier pour qu'il tienne ses 300 lignes : les dossiers
 * d'`apps/web` que le téléviseur ne compile pas du tout. Données pures, comme
 * la table ; ré-exportées par elle, ses importeurs ne bougent pas.
 */

/**
 * Dossiers d'`apps/web` que le téléviseur ne compile pas : sa feuille ne les
 * balaie pas (`tailwind.config.ts`). Tailwind lit des FICHIERS, pas le graphe —
 * sans cette liste, chaque classe d'un écran que la dalle n'affiche jamais
 * entre dans sa feuille, et la garde Chrome 53 la juge. Un dossier n'y entre
 * que si les substitutions de la table ferment TOUTES ses portes : sinon ses
 * classes manqueraient sur la dalle sans un mot, et `excludedDirectoriesGuard`
 * arrête le build.
 */
export const EXCLUDED_WEB_DIRECTORIES: readonly string[] = [
  // L'assistant d'installation : sa seule porte, `pages/ServerSetup.tsx`, mène à « Indisponible ».
  resolve(WEB, "components/setupWizard"),
  // Le moteur de l'aperçu de bande-annonce au survol : sa liaison de racine est
  // substituée, la mini-carte qui l'importe aussi, et son réglage vit dans une
  // page que la dalle ne compile pas (Apparence → À propos). Qu'il entre un jour
  // dans le graphe, et le build s'arrête : la dalle n'a pas d'aperçu au survol.
  resolve(WEB, "trailerPreview"),
  // La mini-carte d'aperçu de bande-annonce : sa seule porte, son `index.ts`, est inerte.
  resolve(WEB, "components/cards/preview"),
  // Le lecteur complet des bandes-annonces : sa seule porte, son `index.ts`, est inerte.
  resolve(WEB, "components/trailerPlayer"),
  // Les profils de la Famille du BUREAU (« Qui regarde ? », « Changer de
  // profil », le réglage) : la porte d'`App.tsx` est substituée
  // (`substitutionTableSession.ts`), les autres vivent dans des écrans que la
  // TV ne compile pas (coquille `AppLayout` et sa barre du haut, Réglages › Famille).
  resolve(WEB, "profiles"),
];
