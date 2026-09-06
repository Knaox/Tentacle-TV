import type { HomeLayoutData, HomeLayoutInput, RecoSettingsData } from "../hooks/useHomeLayout";
import { normalizeProviderFilter } from "../hooks/useRecoPage";
import { reconcileHomeRows, type LibraryRef } from "./homeRows";

/**
 * Sauvegardes « lire avant d'écrire » des préférences du compte — la partie
 * PURE. Le PUT du serveur remplace le bloc entier : deux appareils qui
 * modifient chacun un champ s'écraseraient. On relit donc la copie fraîche,
 * on n'y applique que SON changement, et on renvoie le bloc fusionné.
 *
 * Un patch est un objet partiel, ou une fonction de la copie fraîche (pour
 * les rangées : réordonner PAR CLÉ ce que l'autre appareil vient de laisser).
 */
export type HomeLayoutPatch =
  | Partial<HomeLayoutInput>
  | ((fresh: HomeLayoutData) => Partial<HomeLayoutInput>);
export type RecoSettingsPatch =
  | Partial<RecoSettingsData>
  | ((fresh: RecoSettingsData) => Partial<RecoSettingsData>);

export interface PatchIo<T, B> {
  read: () => Promise<T>;
  write: (body: B) => Promise<unknown>;
}

/**
 * La copie fraîche, réconciliée avec les bibliothèques QUAND elles sont
 * fournies, puis patchée. La réconciliation vient AVANT le patch : sur un
 * compte qui n'a rien enregistré, le serveur sert son catalogue sans les
 * bibliothèques — écrire ce catalogue nu figerait un accueil où tous les
 * « Derniers ajouts » tombent en fin, sur toutes les plateformes. Sans
 * `libraries`, les rangées sont laissées telles quelles (jamais `[]` : cela
 * les supprimerait toutes).
 */
export function applyHomeLayoutPatch(
  fresh: HomeLayoutData,
  patch: HomeLayoutPatch,
  libraries?: readonly LibraryRef[],
): HomeLayoutData {
  const base: HomeLayoutData = libraries
    ? {
        ...fresh,
        rows: reconcileHomeRows(fresh.rows, libraries, {
          anchorNewLibraries: fresh.stored === false,
          catalog: fresh.catalog,
        }),
      }
    : fresh;
  const delta = typeof patch === "function" ? patch(base) : patch;
  return { ...base, ...delta };
}

/** Le corps du PUT : sans les données de lecture (`stored`, `catalog`). */
export function toHomeLayoutBody(layout: HomeLayoutData): HomeLayoutInput {
  const { stored: _stored, catalog: _catalog, ...body } = layout;
  return body;
}

export async function pushHomeLayoutPatch(
  patch: HomeLayoutPatch,
  libraries: readonly LibraryRef[] | undefined,
  io: PatchIo<HomeLayoutData, HomeLayoutInput>,
): Promise<HomeLayoutData> {
  // Lire, PUIS écrire : le bloc envoyé contient ce que les autres appareils
  // viennent d'enregistrer, plus ce seul changement.
  const merged = applyHomeLayoutPatch(await io.read(), patch, libraries);
  await io.write(toHomeLayoutBody(merged));
  return merged;
}

export function applyRecoSettingsPatch(fresh: RecoSettingsData, patch: RecoSettingsPatch): RecoSettingsData {
  const delta = typeof patch === "function" ? patch(fresh) : patch;
  const next = { ...fresh, ...delta };
  return { ...next, providerFilter: normalizeProviderFilter(next.providerFilter) };
}

export async function pushRecoSettingsPatch(
  patch: RecoSettingsPatch,
  io: PatchIo<RecoSettingsData, RecoSettingsData>,
): Promise<RecoSettingsData> {
  const merged = applyRecoSettingsPatch(await io.read(), patch);
  await io.write(merged);
  return merged;
}
