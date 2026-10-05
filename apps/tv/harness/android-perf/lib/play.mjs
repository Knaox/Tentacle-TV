// Jouer un scénario du banc sur l'appareil : jeux du faux backend, lancement
// à froid, mise en place, geste mesuré (fenêtres `[perf-json]`, temps
// processeur par fil, gfxinfo, trace et capture au besoin) — et préparer une
// APK (installée, profil compilé comme par le Play Store, échauffée).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { PACKAGE, sleep } from "./device.mjs";
import { cpuDelta, summarizeRound } from "./report.mjs";
import { startTrace, stopTrace, summarizeTrace } from "./trace.mjs";

export class SetupError extends Error {}

/** La charge du Mac (moyenne sur une minute) : une passe mesurée sous une
 *  autre machine virtuelle ou un build voisin ne vaut rien. */
const hostLoad = () => Math.round(os.loadavg()[0] * 10) / 10;

export function createPlayer({ device, backendPort, host }) {
  const applyFixtures = (sets) =>
    execFileSync("curl", ["-s", "-X", "POST", `http://127.0.0.1:${backendPort}/__fixtures`, "-d", JSON.stringify({ sets })], { stdio: "ignore" });

  async function playScenario(scenario, { traceFile = null, shotFile = null } = {}) {
    applyFixtures(scenario.fixtures ?? ["base/vigie-off"]);
    device.forceStop();
    device.clearLog();
    const loadBefore = hostLoad();
    if (scenario.cold) {
      // Le démarrage à froid se mesure du lancement au repos.
      return host.measuring(async () => {
        const launchMs = device.launch();
        if (!(await device.waitReady("accueil", 45_000))) throw new Error("l'accueil ne s'est jamais dit prêt (session ? faux backend ? mode de mesure ?)");
        await device.waitQuiet(1500);
        const round = summarizeRound(device.perfRecords(), cpuDelta({}, device.threadCpu()));
        return { ...round, launchMs, hostLoad: [loadBefore, hostLoad()] };
      });
    }
    device.launch();
    const ready = await device.waitReady("accueil", 45_000);
    if (!ready) throw new Error("l'accueil ne s'est jamais dit prêt (session ? faux backend ? mode de mesure ?)");
    await sleep(3000);
    device.keys(...(scenario.setup ?? []));
    await device.waitQuiet(1200);
    if (scenario.expectReady && !device.perfRecords().some((record) => record.ready === scenario.expectReady)) {
      throw new SetupError(`la mise en place n'a pas mené à « ${scenario.expectReady} »`);
    }
    if (shotFile) device.screencap(shotFile);
    device.clearLog();
    device.gfxReset();
    const before = device.threadCpu();
    const loadAtGesture = hostLoad();
    if (traceFile) startTrace(device, PACKAGE);
    await host.measuring(async () => {
      device.keys(...scenario.gesture);
      // La fin du geste : ses animations, puis le repos — au plus 6 s. Sur un
      // émulateur lent, de petits blocages (décodage, ramasse-miettes)
      // repoussaient le repos jusqu'au plafond de 15 s : la passe doublait, et
      // la mesure comptait ce qui n'était plus le geste.
      await device.waitQuiet(1500, 6000);
    });
    const after = device.threadCpu();
    const round = { ...summarizeRound(device.perfRecords(), cpuDelta(before, after)), gfx: device.gfxStats(), hostLoad: [loadAtGesture, hostLoad()] };
    if (!traceFile) return round;
    const pid = device.pid();
    const text = stopTrace(device);
    fs.writeFileSync(traceFile, text);
    return { ...round, trace: summarizeTrace(text, pid) };
  }

  /** Une passe, rejouée une fois si sa mise en place a dérapé (`expectReady`). */
  async function playChecked(scenario, files) {
    try {
      return await playScenario(scenario, files);
    } catch (error) {
      if (!(error instanceof SetupError)) throw error;
      console.log(`\n${scenario.id} : ${error.message} — passe rejouée`);
      return playScenario(scenario, files);
    }
  }

  /** L'APK mesurée : installée sur la session en place, son profil écrit par
   *  un premier lancement puis compilé (ce qu'aurait fait le Play Store). */
  async function prepareApk(apk) {
    device.install(apk);
    device.setPerf(true);
    device.forceStop();
    device.clearLog();
    device.launch();
    await device.waitReady("accueil", 60_000);
    device.forceStop();
    device.compileProfile();
  }

  /** Chaque scénario joué une fois sans mesure : le relais retaille les images
   *  à la taille que CETTE version demande, l'app remplit son cache disque. */
  async function warmup(scenarios) {
    for (const scenario of scenarios) {
      await playChecked(scenario).catch((error) => console.log(`\néchauffement ${scenario.id} : ${error.message}`));
    }
  }

  return { playScenario, playChecked, prepareApk, warmup };
}
