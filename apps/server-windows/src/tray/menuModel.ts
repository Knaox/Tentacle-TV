/**
 * Le menu de l'icône, en données : ce qu'il montre selon l'état du serveur.
 * Pur — la couche Win32 (`win32/popupMenu.ts`) ne fait que le dessiner.
 *
 * Première ligne grisée : l'état, en mots. Puis « Ouvrir l'administration »
 * (en gras, l'action du double-clic), les réglages, le journal, et en bas les
 * gestes lourds — supprimer les données, quitter.
 */
import { format, type Strings } from "../i18n/strings";
import type { ServerState } from "../supervisor/supervisor";

export type StartupState =
  | "enabled"
  | "disabled"
  | "disabled-by-user"
  | "disabled-by-policy"
  | "enabled-by-policy"
  | "unavailable";

export type MenuCommand =
  | { kind: "open-admin" }
  | { kind: "toggle-startup" }
  | { kind: "change-port"; port: number }
  | { kind: "setup-code" }
  | { kind: "open-log" }
  | { kind: "restart" }
  | { kind: "install-update" }
  | { kind: "delete-data" }
  | { kind: "quit" };

export type MenuEntry =
  | { kind: "label"; text: string }
  | { kind: "separator" }
  | { kind: "item"; text: string; command: MenuCommand; enabled: boolean; checked: boolean; isDefault: boolean }
  | { kind: "submenu"; text: string; entries: MenuEntry[] };

export interface MenuInput {
  strings: Strings;
  state: ServerState;
  port: number;
  startup: StartupState;
  /** Ports libres proposés (déjà testés). */
  freePorts: readonly number[];
  /** `setup-token.txt` existe et l'installation n'est pas finie. */
  hasSetupCode: boolean;
  /** Une mise à jour du Store attend un geste (`update/updateCoordinator.ts`). */
  updatePending?: boolean;
}

export function stateLabel(strings: Strings, state: ServerState, port: number): string {
  switch (state.kind) {
    case "starting":
      return strings.stateStarting;
    case "running":
      return format(strings.stateRunning, { port: state.port });
    case "stopped":
      return strings.stateStopped;
    case "blocked":
      switch (state.cause) {
        case "port_in_use":
          return format(strings.statePortBusy, { port });
        case "already_running":
          return strings.stateAlreadyRunning;
        case "data_dir_unwritable":
          return strings.stateDataUnwritable;
        case "crash_loop":
          return strings.stateCrashLoop;
      }
  }
}

/** L'infobulle de l'icône (128 caractères au plus, la limite de Windows). */
export function tooltip(strings: Strings, state: ServerState, port: number): string {
  return `${strings.appName} : ${stateLabel(strings, state, port)}`.slice(0, 127);
}

function item(text: string, command: MenuCommand, options: { enabled?: boolean; checked?: boolean; isDefault?: boolean } = {}): MenuEntry {
  return {
    kind: "item",
    text,
    command,
    enabled: options.enabled ?? true,
    checked: options.checked ?? false,
    isDefault: options.isDefault ?? false,
  };
}

export function buildMenu(input: MenuInput): MenuEntry[] {
  const { strings, state, port } = input;
  const running = state.kind === "running";
  const portEntries: MenuEntry[] = [
    item(format(strings.portItem, { port }), { kind: "change-port", port }, { checked: true, enabled: false }),
    ...input.freePorts.map((free) => item(format(strings.portItem, { port: free }), { kind: "change-port", port: free })),
  ];
  if (input.freePorts.length === 0) portEntries.push({ kind: "label", text: strings.noFreePort });

  const startupOn = input.startup === "enabled" || input.startup === "enabled-by-policy";
  const entries: MenuEntry[] = [
    { kind: "label", text: stateLabel(strings, state, port) },
    { kind: "separator" },
    item(strings.openAdmin, { kind: "open-admin" }, { enabled: running, isDefault: true }),
  ];
  if (input.hasSetupCode) entries.push(item(strings.setupCode, { kind: "setup-code" }));
  if (input.updatePending === true) entries.push(item(strings.installUpdate, { kind: "install-update" }));
  entries.push(
    { kind: "separator" },
    item(strings.startWithWindows, { kind: "toggle-startup" }, {
      checked: startupOn,
      enabled: input.startup !== "unavailable" && input.startup !== "enabled-by-policy",
    }),
    { kind: "submenu", text: strings.changePort, entries: portEntries },
    item(strings.openLog, { kind: "open-log" }),
  );
  if (state.kind === "stopped" || state.kind === "blocked") entries.push(item(strings.restartServer, { kind: "restart" }));
  entries.push(
    { kind: "separator" },
    item(strings.deleteData, { kind: "delete-data" }),
    item(strings.quit, { kind: "quit" }),
  );
  return entries;
}
