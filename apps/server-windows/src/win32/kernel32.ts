/**
 * Ce que l'hôte demande à `kernel32.dll` : l'objet Job du serveur, la langue
 * de l'interface, l'identité de paquet, et l'attente SYNCHRONE d'un processus
 * (fermeture de session, où la boucle d'évènements n'a plus la main).
 *
 * ⚠️ Ne se charge que sous Windows : `koffi.load` s'exécute à l'import.
 */
import koffi from "koffi";
import type { ProcessJob } from "../supervisor/serverProcess";

const kernel32 = koffi.load("kernel32.dll");

koffi.struct("JOBOBJECT_BASIC_LIMIT_INFORMATION", {
  PerProcessUserTimeLimit: "int64",
  PerJobUserTimeLimit: "int64",
  LimitFlags: "uint32",
  MinimumWorkingSetSize: "uintptr_t",
  MaximumWorkingSetSize: "uintptr_t",
  ActiveProcessLimit: "uint32",
  Affinity: "uintptr_t",
  PriorityClass: "uint32",
  SchedulingClass: "uint32",
});
koffi.struct("IO_COUNTERS", {
  ReadOperationCount: "uint64",
  WriteOperationCount: "uint64",
  OtherOperationCount: "uint64",
  ReadTransferCount: "uint64",
  WriteTransferCount: "uint64",
  OtherTransferCount: "uint64",
});
const EXTENDED_LIMIT = koffi.struct("JOBOBJECT_EXTENDED_LIMIT_INFORMATION", {
  BasicLimitInformation: "JOBOBJECT_BASIC_LIMIT_INFORMATION",
  IoInfo: "IO_COUNTERS",
  ProcessMemoryLimit: "uintptr_t",
  JobMemoryLimit: "uintptr_t",
  PeakProcessMemoryUsed: "uintptr_t",
  PeakJobMemoryUsed: "uintptr_t",
});

const CreateJobObjectW = kernel32.func("void *CreateJobObjectW(void *attributes, const char16_t *name)");
const SetInformationJobObject = kernel32.func(
  "int SetInformationJobObject(void *job, int infoClass, JOBOBJECT_EXTENDED_LIMIT_INFORMATION *info, uint32 length)",
);
const AssignProcessToJobObject = kernel32.func("int AssignProcessToJobObject(void *job, void *process)");
const TerminateJobObject = kernel32.func("int TerminateJobObject(void *job, uint32 exitCode)");
const OpenProcess = kernel32.func("void *OpenProcess(uint32 access, int inherit, uint32 pid)");
const CloseHandle = kernel32.func("int CloseHandle(void *handle)");
const WaitForSingleObject = kernel32.func("uint32 WaitForSingleObject(void *handle, uint32 milliseconds)");
const GetUserDefaultUILanguage = kernel32.func("uint16 GetUserDefaultUILanguage()");
const GetCurrentPackageFullName = kernel32.func("long GetCurrentPackageFullName(_Inout_ uint32 *length, char16_t *name)");

const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION = 9;
const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
const PROCESS_TERMINATE = 0x0001;
const PROCESS_SET_QUOTA = 0x0100;
const SYNCHRONIZE = 0x00100000;
const APPMODEL_ERROR_NO_PACKAGE = 15700;

/**
 * L'objet Job du serveur, `KILL_ON_JOB_CLOSE` : le rôle de tini. Les enfants
 * du serveur (ffmpeg, python, les `fork`) y entrent d'eux-mêmes ; tout meurt
 * avec `terminate()`, et avec l'hôte s'il tombe — jamais un serveur orphelin
 * qui garderait le port.
 */
export class WindowsJob implements ProcessJob {
  private readonly handle: unknown;

  constructor(private readonly log: (line: string) => void) {
    this.handle = CreateJobObjectW(null, null);
    const info = {
      BasicLimitInformation: { LimitFlags: JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE },
      IoInfo: {},
    };
    const ok = SetInformationJobObject(this.handle, JOB_OBJECT_EXTENDED_LIMIT_INFORMATION, info, koffi.sizeof(EXTENDED_LIMIT));
    if (!ok) log("objet Job : KILL_ON_JOB_CLOSE refusé");
  }

  assign(pid: number): void {
    const process = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
    if (!process) {
      this.log(`objet Job : processus ${pid} introuvable`);
      return;
    }
    try {
      if (!AssignProcessToJobObject(this.handle, process)) this.log(`objet Job : rattachement de ${pid} refusé`);
    } finally {
      CloseHandle(process);
    }
  }

  terminate(): void {
    TerminateJobObject(this.handle, 1);
  }
}

/**
 * Attend la fin d'un processus en BLOQUANT le fil : seulement pour
 * `WM_ENDSESSION`, où Windows nous accorde quelques secondes et où rendre la
 * main revient à être tué. Rend `true` si le processus est sorti.
 */
export function waitProcessBlocking(pid: number, timeoutMs: number): boolean {
  const process = OpenProcess(SYNCHRONIZE, 0, pid);
  if (!process) return true;
  try {
    return WaitForSingleObject(process, timeoutMs) === 0;
  } finally {
    CloseHandle(process);
  }
}

export function userInterfaceLangId(): number {
  return GetUserDefaultUILanguage() as number;
}

/** L'app tourne-t-elle avec une identité de paquet (MSIX installé) ? */
export function hasPackageIdentity(): boolean {
  const length = [0];
  return (GetCurrentPackageFullName(length, null) as number) !== APPMODEL_ERROR_NO_PACKAGE;
}
