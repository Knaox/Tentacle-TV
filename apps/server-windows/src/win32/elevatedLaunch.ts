/**
 * Lancer l'installateur officiel de Jellyfin, EN INTERACTIF (jamais `/S`, qui
 * poserait le service que Jellyfin déconseille) et HORS du conteneur MSIX.
 *
 * `ShellExecuteExW` avec le verbe `runas` : l'installateur exige les droits
 * d'administrateur (`RequestExecutionLevel admin`), et un processus élevé est
 * créé par le service AppInfo, pas comme enfant de notre paquet — ses
 * écritures (`HKCU\…\Run`, raccourcis, `ProgramData`) ne sont donc pas
 * virtualisées ni effacées avec Tentacle. À éprouver sur un Windows installé
 * (diagnostic § 6.4). C'est l'utilisateur qui accepte l'élévation : Windows la
 * lui demande, jamais nous à sa place.
 *
 * L'attente de la fin se fait en SONDANT le code de sortie : la boucle
 * d'évènements de l'hôte (icône, journaux du serveur) ne s'arrête jamais.
 *
 * ⚠️ Ne se charge que sous Windows : `koffi.load` s'exécute à l'import.
 */
import koffi from "koffi";

const shell32 = koffi.load("shell32.dll");
const kernel32 = koffi.load("kernel32.dll");

const SHELLEXECUTEINFOW = koffi.struct("TENTACLE_SHELLEXECUTEINFOW", {
  cbSize: "uint32",
  fMask: "uint32",
  hwnd: "void *",
  lpVerb: "const char16_t *",
  lpFile: "const char16_t *",
  lpParameters: "const char16_t *",
  lpDirectory: "const char16_t *",
  nShow: "int",
  hInstApp: "void *",
  lpIDList: "void *",
  lpClass: "const char16_t *",
  hkeyClass: "void *",
  dwHotKey: "uint32",
  hIconOrMonitor: "void *",
  hProcess: "void *",
});

const ShellExecuteExW = shell32.func("int ShellExecuteExW(_Inout_ TENTACLE_SHELLEXECUTEINFOW *info)");
const GetLastError = kernel32.func("uint32 GetLastError()");
const GetExitCodeProcess = kernel32.func("int GetExitCodeProcess(void *process, _Out_ uint32 *code)");
const CloseHandle = kernel32.func("int CloseHandle(void *handle)");

const SEE_MASK_NOCLOSEPROCESS = 0x40;
const SEE_MASK_NOASYNC = 0x100;
const SEE_MASK_FLAG_NO_UI = 0x400;
const SW_SHOWNORMAL = 1;
const STILL_ACTIVE = 259;
const ERROR_CANCELLED = 1223;
const POLL_MS = 1_000;

/** `cancelled` : l'élévation a été refusée ; `blocked` : Windows a refusé de lancer le fichier. */
export type LaunchOutcome = { ok: true; exitCode: number } | { ok: false; reason: "cancelled" | "blocked"; error: number };

/** Lance `file` élevé, puis attend sa fin sans bloquer la boucle. */
export async function launchElevatedAndWait(file: string, directory: string): Promise<LaunchOutcome> {
  const info = {
    cbSize: koffi.sizeof(SHELLEXECUTEINFOW),
    fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC | SEE_MASK_FLAG_NO_UI,
    hwnd: null,
    lpVerb: "runas",
    lpFile: file,
    lpParameters: null,
    lpDirectory: directory,
    nShow: SW_SHOWNORMAL,
    hInstApp: null,
    lpIDList: null,
    lpClass: null,
    hkeyClass: null,
    dwHotKey: 0,
    hIconOrMonitor: null,
    hProcess: null as unknown,
  };
  if (!ShellExecuteExW(info)) {
    const error = GetLastError() as number;
    return { ok: false, reason: error === ERROR_CANCELLED ? "cancelled" : "blocked", error };
  }
  const process = info.hProcess;
  if (!process) return { ok: true, exitCode: 0 };
  try {
    for (;;) {
      const code = [0];
      if (!GetExitCodeProcess(process, code)) return { ok: true, exitCode: -1 };
      if (code[0] !== STILL_ACTIVE) return { ok: true, exitCode: code[0] ?? 0 };
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  } finally {
    CloseHandle(process);
  }
}
