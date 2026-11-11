// Quelle coquille livre une version du bureau : Electron jusqu'à la 1.49.x, CEF à partir de la
// 1.50.0 (la première version livrée en CEF, apps/desktop-cef). Zéro dépendance, testée hors ligne
// (test/desktop-shell.test.mjs).
//
// POURQUOI UNE GARDE. desktop.yml construit encore Electron. Une 1.50.0 livrée par lui partirait
// sous le numéro réservé à CEF : Electron 1.50.0 sur les boutiques, puis un CEF qui devrait passer
// par-dessus (le Microsoft Store exige un paquet STRICTEMENT plus grand ; les appareils Electron
// croiraient être à jour). La règle vaut dans les deux sens : la chaîne CEF ne livre jamais un
// numéro de l'ère Electron.
import { compareVersions, isVersion } from './versions.mjs';

export const FIRST_CEF_VERSION = '1.50.0';
export const SHELLS = ['electron', 'cef'];

/** La coquille qui livre `version` (« X.Y.Z »). */
export function desktopShellFor(version) {
  if (!isVersion(version)) throw new Error(`version du bureau illisible : ${version}`);
  return compareVersions(version, FIRST_CEF_VERSION) >= 0 ? 'cef' : 'electron';
}

/**
 * Le refus d'un workflow qui construit `shell`, ou null s'il peut tourner.
 *   current : versions.json → desktop au commit visé ;  bump : la version demandée (vide = aucune).
 * Un bump vers l'autre coquille est toujours refusé (il pousserait le numéro sur main et poserait
 * le tag). Sans bump, le cran `build` reste permis : rien ne part, on construit pour voir.
 */
export function shellRefusal({ shell, channel, current, bump = '' }) {
  if (!SHELLS.includes(shell)) return `coquille inconnue : ${shell}`;
  const target = bump || current;
  if (!isVersion(target)) return `version du bureau illisible : « ${target} » (versions.json → desktop)`;
  const wanted = desktopShellFor(target);
  if (wanted === shell) return null;
  if (!bump && channel === 'build') return null;
  const workflow = shell === 'electron' ? 'desktop.yml construit Electron' : 'cette chaîne construit CEF';
  const rule = `la ${FIRST_CEF_VERSION} est la première version CEF : < ${FIRST_CEF_VERSION} = Electron, ≥ ${FIRST_CEF_VERSION} = CEF`;
  return bump
    ? `bump du bureau en ${bump} refusé : ${workflow}, et ${rule}. Rien n'a été poussé.`
    : `bureau ${target} au cran ${channel} refusé : ${workflow}, et ${rule}. Rien ne part (le cran build reste permis).`;
}
