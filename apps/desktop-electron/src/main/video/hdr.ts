/**
 * Bascule du mode HDR de l'écran, le temps d'une lecture.
 *
 * # Pourquoi c'est indispensable, et pas un confort
 *
 * Deux mesures faites sur le poste de test le disent :
 *
 *  - Écran en **SDR**, film HDR avec `target-colorspace-hint=yes` : mpv
 *    transmet le signal PQ tel quel et l'image est **quasi noire**.
 *  - Écran laissé en **HDR** en permanence : Windows remappe tout le contenu
 *    SDR — le bureau, le navigateur, l'application hors lecture — qui paraît
 *    **délavé**.
 *
 * Aucun des deux états n'est bon en permanence. On active donc le HDR à
 * l'entrée du lecteur si le média en a besoin, et on rend l'écran à son état
 * d'origine en sortant.
 *
 * # L'API
 *
 * `DisplayConfigSetDeviceInfo` avec `SET_ADVANCED_COLOR_STATE` : c'est la voie
 * documentée, celle qu'emploient les utilitaires de bascule HDR. Elle demande
 * de retrouver l'identifiant de la cible d'affichage via `QueryDisplayConfig`,
 * d'où les structures ci-dessous.
 */

import koffi from "koffi";

koffi.struct("LUID", { LowPart: "uint32", HighPart: "int32" });
koffi.struct("DISPLAYCONFIG_RATIONAL", { Numerator: "uint32", Denominator: "uint32" });

koffi.struct("DISPLAYCONFIG_PATH_SOURCE_INFO", {
  adapterId: "LUID",
  id: "uint32",
  modeInfoIdx: "uint32",
  statusFlags: "uint32",
});

koffi.struct("DISPLAYCONFIG_PATH_TARGET_INFO", {
  adapterId: "LUID",
  id: "uint32",
  modeInfoIdx: "uint32",
  outputTechnology: "int32",
  rotation: "int32",
  scaling: "int32",
  refreshRate: "DISPLAYCONFIG_RATIONAL",
  scanLineOrdering: "int32",
  targetAvailable: "int32",
  statusFlags: "uint32",
});

koffi.struct("DISPLAYCONFIG_PATH_INFO", {
  sourceInfo: "DISPLAYCONFIG_PATH_SOURCE_INFO",
  targetInfo: "DISPLAYCONFIG_PATH_TARGET_INFO",
  flags: "uint32",
});

// Le contenu des modes ne nous sert pas : seule leur TAILLE compte, l'appel
// exigeant un tampon correctement dimensionné. 64 octets par entrée.
koffi.struct("DISPLAYCONFIG_MODE_INFO", { raw: koffi.array("uint8", 64) });

koffi.struct("DISPLAYCONFIG_DEVICE_INFO_HEADER", {
  type: "int32",
  size: "uint32",
  adapterId: "LUID",
  id: "uint32",
});

koffi.struct("DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO", {
  header: "DISPLAYCONFIG_DEVICE_INFO_HEADER",
  value: "uint32",
  colorEncoding: "int32",
  bitsPerColorChannel: "uint32",
});

koffi.struct("DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE", {
  header: "DISPLAYCONFIG_DEVICE_INFO_HEADER",
  value: "uint32",
});

const user32 = koffi.load("user32.dll");

const GetDisplayConfigBufferSizes = user32.func(
  "int32 GetDisplayConfigBufferSizes(uint32 flags, _Inout_ uint32* numPaths, _Inout_ uint32* numModes)",
);
const QueryDisplayConfig = user32.func(
  "int32 QueryDisplayConfig(uint32 flags, _Inout_ uint32* numPaths, _Out_ DISPLAYCONFIG_PATH_INFO* paths," +
    " _Inout_ uint32* numModes, _Out_ DISPLAYCONFIG_MODE_INFO* modes, void* topology)",
);
const DisplayConfigGetDeviceInfo = user32.func(
  "int32 DisplayConfigGetDeviceInfo(_Inout_ DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO* p)",
);
const DisplayConfigSetDeviceInfo = user32.func(
  "int32 DisplayConfigSetDeviceInfo(DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE* p)",
);

const QDC_ONLY_ACTIVE_PATHS = 0x00000002;
const GET_ADVANCED_COLOR_INFO = 9;
const SET_ADVANCED_COLOR_STATE = 10;
const ERROR_SUCCESS = 0;
const HEADER_SIZE = 20;

/** Une cible d'affichage active, désignée par son adaptateur et son identifiant. */
interface Cible {
  adapterId: { LowPart: number; HighPart: number };
  id: number;
}

/** Cibles d'affichage actives. Tableau vide si l'énumération échoue. */
function ciblesActives(): Cible[] {
  const nbPaths = [0];
  const nbModes = [0];
  if (GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, nbPaths, nbModes) !== ERROR_SUCCESS) {
    return [];
  }
  const paths = Array.from({ length: nbPaths[0] ?? 0 }, () => ({}));
  const modes = Array.from({ length: nbModes[0] ?? 0 }, () => ({}));
  if (
    QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, nbPaths, paths, nbModes, modes, null) !==
    ERROR_SUCCESS
  ) {
    return [];
  }
  return (paths as { targetInfo?: Cible }[])
    .map((p) => p.targetInfo)
    .filter((t): t is Cible => t !== undefined);
}

export interface EtatHdr {
  supporte: boolean;
  actif: boolean;
}

/** État HDR d'une cible. */
function lireEtat(cible: Cible): EtatHdr | null {
  const info = {
    header: {
      type: GET_ADVANCED_COLOR_INFO,
      size: 32,
      adapterId: cible.adapterId,
      id: cible.id,
    },
    value: 0,
    colorEncoding: 0,
    bitsPerColorChannel: 0,
  };
  if (DisplayConfigGetDeviceInfo(info) !== ERROR_SUCCESS) return null;
  // Champs de bits : 0 = supporté, 1 = activé.
  return { supporte: (info.value & 1) !== 0, actif: (info.value & 2) !== 0 };
}

function ecrireEtat(cible: Cible, actif: boolean): boolean {
  const set = {
    header: {
      type: SET_ADVANCED_COLOR_STATE,
      size: HEADER_SIZE + 4,
      adapterId: cible.adapterId,
      id: cible.id,
    },
    value: actif ? 1 : 0,
  };
  return DisplayConfigSetDeviceInfo(set) === ERROR_SUCCESS;
}

/**
 * État d'origine, retenu pour être rendu tel quel.
 *
 * Retenu par cible et non globalement : un poste à plusieurs écrans peut très
 * bien en avoir un en HDR et un autre non, et les rendre tous les deux dans le
 * même état serait pire que de n'avoir rien fait.
 */
let avant: Array<{ cible: Cible; actif: boolean }> | null = null;

/** Avons-nous basculé l'écran nous-mêmes, et devons-nous le rendre ? */
export function basculeEnCours(): boolean {
  return avant !== null;
}

/** L'écran principal est-il en HDR ? `false` si l'information est indisponible. */
export function hdrActif(): boolean {
  const cibles = ciblesActives();
  for (const c of cibles) {
    const e = lireEtat(c);
    if (e?.actif) return true;
  }
  return false;
}

/**
 * Au moins un écran sait-il faire du HDR ?
 *
 * Sert à n'offrir la préférence que là où elle change quelque chose : proposer
 * une bascule à qui n'a pas d'écran compatible, c'est promettre un effet qui
 * n'arrivera jamais.
 */
export function hdrSupporte(): boolean {
  return ciblesActives().some((c) => lireEtat(c)?.supporte === true);
}

/**
 * Active le HDR sur les écrans qui le savent faire, en retenant leur état.
 * Sans effet — et sans mémoire écrasée — si c'est déjà fait.
 */
export function activerHdr(): boolean {
  if (avant !== null) return true;
  const cibles = ciblesActives();
  if (cibles.length === 0) return false;

  const memoire: Array<{ cible: Cible; actif: boolean }> = [];
  let uneAuMoins = false;
  for (const cible of cibles) {
    const etat = lireEtat(cible);
    if (!etat?.supporte) continue;
    memoire.push({ cible, actif: etat.actif });
    if (!etat.actif && ecrireEtat(cible, true)) uneAuMoins = true;
    else if (etat.actif) uneAuMoins = true;
  }
  if (memoire.length === 0) return false;
  avant = memoire;
  return uneAuMoins;
}

/** Rend les écrans à l'état où on les a trouvés. Idempotent. */
export function restaurerHdr(): void {
  if (avant === null) return;
  for (const { cible, actif } of avant) {
    const etat = lireEtat(cible);
    if (etat && etat.actif !== actif) ecrireEtat(cible, actif);
  }
  avant = null;
}
