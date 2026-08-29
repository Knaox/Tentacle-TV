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
interface Target {
  adapterId: { LowPart: number; HighPart: number };
  id: number;
}

/** Cibles d'affichage actives. Tableau vide si l'énumération échoue. */
function activeTargets(): Target[] {
  const pathCount = [0];
  const modeCount = [0];
  if (GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, pathCount, modeCount) !== ERROR_SUCCESS) {
    return [];
  }
  const paths = Array.from({ length: pathCount[0] ?? 0 }, () => ({}));
  const modes = Array.from({ length: modeCount[0] ?? 0 }, () => ({}));
  if (
    QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, pathCount, paths, modeCount, modes, null) !==
    ERROR_SUCCESS
  ) {
    return [];
  }
  return (paths as { targetInfo?: Target }[])
    .map((p) => p.targetInfo)
    .filter((t): t is Target => t !== undefined);
}

export interface HdrState {
  supported: boolean;
  active: boolean;
}

/** État HDR d'une cible. */
function readState(target: Target): HdrState | null {
  const info = {
    header: {
      type: GET_ADVANCED_COLOR_INFO,
      size: 32,
      adapterId: target.adapterId,
      id: target.id,
    },
    value: 0,
    colorEncoding: 0,
    bitsPerColorChannel: 0,
  };
  if (DisplayConfigGetDeviceInfo(info) !== ERROR_SUCCESS) return null;
  // Champs de bits : 0 = supporté, 1 = activé.
  return { supported: (info.value & 1) !== 0, active: (info.value & 2) !== 0 };
}

function writeState(target: Target, active: boolean): boolean {
  const set = {
    header: {
      type: SET_ADVANCED_COLOR_STATE,
      size: HEADER_SIZE + 4,
      adapterId: target.adapterId,
      id: target.id,
    },
    value: active ? 1 : 0,
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
let before: Array<{ target: Target; active: boolean }> | null = null;

/** Avons-nous basculé l'écran nous-mêmes, et devons-nous le rendre ? */
export function toggleInProgress(): boolean {
  return before !== null;
}

/** L'écran principal est-il en HDR ? `false` si l'information est indisponible. */
export function hdrActive(): boolean {
  const targets = activeTargets();
  for (const c of targets) {
    const e = readState(c);
    if (e?.active) return true;
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
export function hdrSupported(): boolean {
  return activeTargets().some((c) => readState(c)?.supported === true);
}

/**
 * Active le HDR sur les écrans qui le savent faire, en retenant leur état.
 *
 * ⚠️ La mémoire de l'état d'origine n'est écrite qu'à la PREMIÈRE bascule, mais
 * l'activation, elle, est retentée à chaque appel. Une version antérieure
 * sortait immédiatement dès que la mémoire existait : si une lecture
 * précédente ne l'avait pas rendue — sortie sans `mpv_destroy`, application
 * tuée — la fonction répondait « ok » sans jamais rien basculer, et le HDR ne
 * revenait plus jamais de la session.
 */
export function enableHdr(): boolean {
  const targets = activeTargets();
  if (targets.length === 0) return false;

  const first = before === null;
  const memory = before ?? [];
  let atLeastOne = false;

  for (const target of targets) {
    const state = readState(target);
    if (!state?.supported) continue;
    if (first) memory.push({ target, active: state.active });
    if (state.active) atLeastOne = true;
    else if (writeState(target, true)) atLeastOne = true;
  }

  if (memory.length === 0) return false;
  before = memory;
  return atLeastOne;
}

/** Rend les écrans à l'état où on les a trouvés. Idempotent. */
export function restoreHdr(): void {
  if (before === null) return;
  for (const { target, active } of before) {
    const state = readState(target);
    if (state && state.active !== active) writeState(target, active);
  }
  before = null;
}
