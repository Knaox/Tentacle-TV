/**
 * Ouvrir (navigateur, journal, Paramètres), questionner l'utilisateur
 * (`MessageBoxW`), et trouver `ProgramData`.
 *
 * ⚠️ Ne se charge que sous Windows : `koffi.load` s'exécute à l'import.
 *
 * Une boîte de message BLOQUE le fil de l'hôte le temps de la réponse : la
 * sortie du serveur attend dans son tube, les minuteries attendent. C'est
 * acceptable pour une confirmation, et c'est ce qui la rend modale.
 */
import koffi from "koffi";

const shell32 = koffi.load("shell32.dll");
const user32 = koffi.load("user32.dll");
const ole32 = koffi.load("ole32.dll");

koffi.struct("SHELL_GUID", { Data1: "uint32", Data2: "uint16", Data3: "uint16", Data4: "uint8[8]" });

const ShellExecuteW = shell32.func(
  "void *ShellExecuteW(void *hwnd, const char16_t *verb, const char16_t *file, const char16_t *params, const char16_t *dir, int show)",
);
const SHGetKnownFolderPath = shell32.func(
  "long SHGetKnownFolderPath(const SHELL_GUID *id, uint32 flags, void *token, _Out_ void **path)",
);
const CoTaskMemFree = ole32.func("void CoTaskMemFree(void *memory)");
const MessageBoxW = user32.func("int MessageBoxW(void *hwnd, const char16_t *text, const char16_t *caption, uint32 type)");

const SW_SHOWNORMAL = 1;
const MB_OK = 0x0;
const MB_YESNO = 0x4;
const MB_ICONERROR = 0x10;
const MB_ICONWARNING = 0x30;
const MB_ICONINFORMATION = 0x40;
const MB_DEFBUTTON2 = 0x100;
const MB_SETFOREGROUND = 0x10000;
const MB_TOPMOST = 0x40000;
const IDYES = 6;

/** {62AB5D82-FDC1-4DC3-A9DD-070D1D495D97} — `knownfolders.h`. */
const FOLDERID_PROGRAM_DATA = {
  Data1: 0x62ab5d82,
  Data2: 0xfdc1,
  Data3: 0x4dc3,
  Data4: [0xa9, 0xdd, 0x07, 0x0d, 0x1d, 0x49, 0x5d, 0x97],
};

/** Ouvre une URL, un fichier ou un `ms-settings:` comme un double-clic. */
export function shellOpen(target: string): boolean {
  const result = ShellExecuteW(null, "open", target, null, null, SW_SHOWNORMAL);
  // ShellExecute rend un « HINSTANCE » qui vaut un code > 32 en cas de succès.
  return Number(koffi.address(result)) > 32;
}

/** `%ProgramData%` lu au système ; la variable d'environnement en repli. */
export function programDataFolder(fallback: string | undefined): string {
  const out: unknown[] = [null];
  try {
    if ((SHGetKnownFolderPath(FOLDERID_PROGRAM_DATA, 0, null, out) as number) === 0 && out[0]) {
      return koffi.decode(out[0], "char16_t", -1) as string;
    }
  } finally {
    if (out[0]) CoTaskMemFree(out[0]);
  }
  return fallback ?? "C:\\ProgramData";
}

const STYLE = MB_SETFOREGROUND | MB_TOPMOST;

export function showInfo(caption: string, text: string): void {
  MessageBoxW(null, text, caption, MB_OK | MB_ICONINFORMATION | STYLE);
}

export function showError(caption: string, text: string): void {
  MessageBoxW(null, text, caption, MB_OK | MB_ICONERROR | STYLE);
}

/** Oui / Non, « Non » par défaut : un Entrée machinal ne détruit rien. */
export function confirm(caption: string, text: string): boolean {
  return MessageBoxW(null, text, caption, MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2 | STYLE) === IDYES;
}
