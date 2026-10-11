/**
 * Une console pour la commande `tentacle`, alors que l'exe est en sous-système
 * GUI (il n'en reçoit aucune de Windows).
 *
 * Trois cas, dans l'ordre :
 * 1. la sortie est déjà un fichier ou un tube (`tentacle setup token > x.txt`,
 *    `| more`) : on la garde ;
 * 2. sinon, on S'ATTACHE à la console du shell parent (`AttachConsole`) et
 *    l'hôte y recopie la sortie de la commande (`WriteConsoleW`) ;
 * 3. sinon (lancé hors de tout shell), il n'y a pas de console : la sortie est
 *    recueillie et montrée dans une boîte.
 *
 * Limite connue du cas 2 : le shell n'attend pas un exe GUI, son invite peut
 * reparaître AVANT la sortie de la commande — le texte reste juste.
 *
 * ⚠️ Ne se charge que sous Windows : `koffi.load` s'exécute à l'import.
 */
import koffi from "koffi";

const kernel32 = koffi.load("kernel32.dll");

const GetStdHandle = kernel32.func("void *GetStdHandle(uint32 which)");
const GetFileType = kernel32.func("uint32 GetFileType(void *handle)");
const AttachConsole = kernel32.func("int AttachConsole(uint32 processId)");
const WriteConsoleW = kernel32.func(
  "int WriteConsoleW(void *handle, const char16_t *text, uint32 length, void *written, void *reserved)",
);

/** `STD_OUTPUT_HANDLE` = (DWORD)-11. */
const STD_OUTPUT_HANDLE = 0xfffffff5;
/** `ATTACH_PARENT_PROCESS` = (DWORD)-1. */
const ATTACH_PARENT_PROCESS = 0xffffffff;
const FILE_TYPE_UNKNOWN = 0;
const FILE_TYPE_CHAR = 2;
const INVALID_HANDLE_VALUE = BigInt.asUintN(64, -1n);

/**
 * La sortie standard reçue de Windows est-elle un fichier ou un tube ?
 *
 * Une CONSOLE ne compte pas : lancé depuis cmd ou PowerShell, l'exe GUI hérite
 * bien du descripteur de la console (`FILE_TYPE_CHAR`, relevé sur ce PC), mais
 * n'y est pas attaché — rien de ce qui s'y écrit ne paraît. Il faut alors
 * `AttachConsole`, puis `CONOUT$`.
 */
export function stdoutRedirected(): boolean {
  const handle = GetStdHandle(STD_OUTPUT_HANDLE);
  if (!handle) return false;
  const address = BigInt(koffi.address(handle));
  if (address === 0n || address === INVALID_HANDLE_VALUE) return false;
  const type = GetFileType(handle) as number;
  return type !== FILE_TYPE_UNKNOWN && type !== FILE_TYPE_CHAR;
}

/**
 * S'attache à la console du processus parent (le shell qui a tapé `tentacle`)
 * et rend de quoi y écrire, ou `null`.
 *
 * `WriteConsoleW`, en UTF-16 : des octets UTF-8 écrits dans `CONOUT$` sortent
 * en mojibake sous la page de code de la console (850 en français, relevé sur
 * ce PC), et changer cette page la changerait pour tout le shell.
 */
export function attachParentConsole(): ((text: string) => void) | null {
  if ((AttachConsole(ATTACH_PARENT_PROCESS) as number) === 0) return null;
  // Après `AttachConsole`, le descripteur standard est celui de la console du shell.
  const handle = GetStdHandle(STD_OUTPUT_HANDLE);
  if (!handle) return null;
  return (text) => {
    const crlf = text.replace(/\r?\n/g, "\r\n");
    WriteConsoleW(handle, crlf, crlf.length, null, null);
  };
}
