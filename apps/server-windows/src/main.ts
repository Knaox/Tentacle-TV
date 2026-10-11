/**
 * Tentacle Server pour Windows — l'hôte.
 *
 * Le `node.exe` officiel, renommé `Tentacle Server.exe` et passé en
 * sous-système GUI (aucune console), lance ce fichier. Il fait ce que font le
 * `Dockerfile`, tini et l'entrypoint de l'image, rien de plus : une seule
 * instance, le dossier de données et ses droits, les shared-deps, un
 * environnement en liste blanche, le serveur `apps/backend/dist/index.js`
 * supervisé, ses journaux — et l'icône de la zone de notification.
 *
 * Hors paquet (prototype) : `node apps/server-windows/dist/main.js` depuis un
 * dépôt construit, ou `--app-root <dossier>` vers un autre arbre `/app`.
 */
import { existsSync, readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { appLayout, resolveAppRoot, type AppLayout } from "./appLayout";
import { cliArguments, isCliInvocation } from "./cli/cliMode";
import { runCli } from "./cli/runCli";
import { deleteDataFolder, prepareDataFolder } from "./data/dataFolder";
import { dataLayout, type DataLayout } from "./data/dataLayout";
import { readHostState, writeHostState } from "./data/hostState";
import { refreshSharedDeps } from "./data/sharedDeps";
import { buildServerEnv } from "./env/serverEnv";
import { HostController } from "./host/hostController";
import { STRINGS, format, languageFromLangId } from "./i18n/strings";
import { acquireInstance } from "./instance/singleInstance";
import { LogFiles } from "./logging/logFiles";
import { defaultRouteAddress, interfaceOf, pickLanAddress, serverUrl } from "./net/lanAddress";
import { isPublic, readProfiles } from "./net/networkProfile";
import { isPortFree, suggestPorts } from "./net/ports";
import { startupRegistration } from "./startup/startupRegistration";
import { runCommand } from "./startup/runKey";
import { Supervisor } from "./supervisor/supervisor";
import { WindowsJob, hasPackageIdentity, userInterfaceLangId, waitProcessBlocking } from "./win32/kernel32";
import { showPopupMenu } from "./win32/popupMenu";
import { confirm, programDataFolder, shellOpen, showError, showInfo } from "./win32/shell";
import { TrayWindow } from "./win32/trayWindow";
import { attachParentConsole, stdoutRedirected } from "./win32/console";

/** La commande `tentacle` (alias du paquet) : rien de l'hôte ne démarre. */
async function runCommandLine(app: AppLayout, data: DataLayout): Promise<number> {
  return runCli(
    {
      execPath: process.execPath,
      entry: app.cliEntry,
      cwd: app.backendDir,
      args: cliArguments(process.argv),
      env: buildServerEnv({
        source: process.env,
        port: readHostState(data.hostState).port,
        dataDir: data.root,
        cacheDir: data.cache,
        ...(app.python !== null ? { python: app.python, extraPath: [app.root + "\\python"] } : {}),
        ...(app.ytDlp !== null ? { ytDlpPinned: app.ytDlp } : {}),
      }),
    },
    {
      stdoutRedirected,
      attachParentConsole,
      showOutput: (text, failed) => (failed ? showError : showInfo)("tentacle", text),
    },
  );
}

function readSetupCode(tokenFile: string, completeFile: string): string | null {
  if (existsSync(completeFile)) return null;
  try {
    const code = readFileSync(tokenFile, "utf8").trim();
    return code === "" ? null : code;
  } catch {
    return null;
  }
}

async function publicNetwork(systemRoot: string): Promise<boolean> {
  const nics = networkInterfaces();
  const alias = interfaceOf(pickLanAddress(await defaultRouteAddress(), nics), nics);
  return isPublic(await readProfiles(systemRoot), alias);
}

async function main(): Promise<void> {
  const strings = STRINGS[languageFromLangId(userInterfaceLangId())];
  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  const app = appLayout(resolveAppRoot(process.argv, process.env, __dirname));
  const data = dataLayout(programDataFolder(process.env.ProgramData));
  if (isCliInvocation(process.argv, process.argv0)) {
    process.exit(await runCommandLine(app, data));
  }
  const hostVersion = app.packageVersion ?? "dev";

  // Avant tout le reste : une seconde instance passe la main et s'en va.
  let controller: HostController | null = null;
  const instance = await acquireInstance(() => void controller?.openAdmin());
  if (!instance.primary) {
    process.exit(0);
  }

  const prepared = await prepareDataFolder(data, systemRoot);
  if (!prepared.ok) {
    showError(
      strings.appName,
      prepared.reason === "other_account"
        ? strings.otherAccount
        : format(strings.dataFolderFailed, { dir: data.root, detail: prepared.detail }),
    );
    process.exit(1);
  }

  const logs = new LogFiles(data.logs);
  const log = (line: string): void => logs.host(line);
  log(`hôte ${hostVersion} — Node ${process.version}, racine ${app.root}, données ${data.root}${prepared.created ? " (créées)" : ""}`);
  process.on("uncaughtException", (error) => log(`erreur non rattrapée : ${error.stack ?? error.message}`));
  process.on("unhandledRejection", (reason) => log(`promesse rejetée : ${String(reason)}`));

  if (!existsSync(app.serverEntry)) {
    log(`serveur introuvable : ${app.serverEntry}`);
    showError(strings.appName, format(strings.dataFolderFailed, { dir: app.serverEntry, detail: "dist/index.js" }));
    process.exit(1);
  }
  const copied = refreshSharedDeps(app.sharedDepsSeed, data.sharedDeps);
  log(copied === null ? "shared-deps : aucune semence" : `shared-deps : ${copied} fichier(s) recopié(s)`);

  const job = new WindowsJob(log);
  const supervisor = new Supervisor({
    spec: () => {
      const port = controller?.port ?? readHostState(data.hostState).port;
      return {
        execPath: process.execPath,
        entry: app.serverEntry,
        cwd: app.backendDir,
        env: buildServerEnv({
          source: process.env,
          port,
          dataDir: data.root,
          cacheDir: data.cache,
          ...(app.python !== null ? { python: app.python, extraPath: [app.root + "\\python"] } : {}),
          ...(app.ytDlp !== null ? { ytDlpPinned: app.ytDlp } : {}),
        }),
        port,
        hostVersion,
        hostMethods: [],
      };
    },
    job,
    log,
    output: (chunk) => logs.server(chunk),
    onState: (state) => controller?.onServerState(state),
  });

  const tray = new TrayWindow(
    app.trayIcon,
    {
      onMenu: (x, y) => void controller?.openMenu(x, y),
      onBalloonClick: () => void controller?.openMenu(0, 0),
      onQueryEndSession: () => void supervisor.stop("session-end"),
      onEndSession: () => {
        // Plus de boucle d'évènements après ce message : on attend en bloquant.
        const pid = supervisor.process?.pid ?? null;
        if (pid !== null && !waitProcessBlocking(pid, 9_000)) job.terminate();
        log("fermeture de session : serveur arrêté");
      },
      onEndSessionCancelled: () => void controller?.startServer(),
    },
    strings.appName,
  );
  const exit = (code: number): void => {
    tray.dispose();
    instance.server.close();
    process.exit(code);
  };

  controller = new HostController({
    strings,
    dataDir: data.root,
    ui: {
      setTooltip: (text) => tray.setTooltip(text),
      notify: (title, text, level) => tray.notify(title, text, level),
      showMenu: (entries, x, y) => showPopupMenu(tray.handle, entries, x, y),
      open: (target) => {
        if (!shellOpen(target)) log(`ouverture refusée : ${target}`);
      },
      info: (text) => showInfo(strings.appName, text),
      error: (text) => showError(strings.appName, text),
      confirm: (text) => confirm(strings.appName, text),
    },
    supervisor: () => supervisor,
    startup: await startupRegistration({
      packaged: hasPackageIdentity(),
      systemRoot,
      command: runCommand(process.execPath, __filename, app.root),
    }),
    log,
    logFile: () => logs.currentFile(),
    isPortFree,
    suggestPorts: (current) => suggestPorts(current),
    serverUrl,
    state: { read: () => readHostState(data.hostState), write: (state) => writeHostState(data.hostState, state) },
    setupCode: () => readSetupCode(data.setupToken, data.setupComplete),
    setupPending: () => !existsSync(data.setupComplete),
    deleteData: () => deleteDataFolder(data),
    publicNetwork: () => publicNetwork(systemRoot),
    exit,
  });

  tray.show(`${strings.appName} : ${strings.stateStarting}`);
  log(`icône de la zone de notification : ${tray.visible ? "posée" : "refusée par l'Explorateur"}`);
  await controller.startServer();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  try {
    showError("Tentacle Server", message);
  } finally {
    process.exit(1);
  }
});
