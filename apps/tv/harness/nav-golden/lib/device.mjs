// L'Apple TV PHYSIQUE (« Chambre ») : l'app de test `com.tentacle.mobile.navtest`
// — même natif que le simulateur, un AUTRE identifiant —, installée À CÔTÉ de
// l'app de l'utilisateur (`com.tentacle.mobile`, sa vraie session, sa build
// Release), qu'on ne touche jamais : on vérifie qu'elle est là avant et après.
// Le JS vient du Metro de la place, sur l'IP du Mac ; l'état de l'app de test
// se remet à zéro par la sonde, sur arguments de lancement (`-navGolden…`).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { BenchError, CACHE_DIR, capture, duration, note, step } from "./config.mjs";
import { withLock } from "./checkout.mjs";
import { nativeFingerprint } from "./nativeApp.mjs";

export const TEST_BUNDLE = "com.tentacle.mobile.navtest";
export const USER_BUNDLE = "com.tentacle.mobile";
const PRODUCT = "Build/Products/Debug-appletvos/TentacleTV.app";

/** Les deux identifiants de l'appareil : xcodebuild veut l'UDID, devicectl l'identifiant CoreDevice. */
export function deviceIds() {
  return {
    udid: process.env.NAV_GOLDEN_DEVICE_UDID ?? "00008110-0015181621EB601E",
    coredevice: process.env.NAV_GOLDEN_DEVICE_COREDEVICE ?? "DA96352F-A2B7-55A9-86B0-D087B44828B8",
  };
}

/** L'IP du Mac sur le réseau local (Wi-Fi, sinon Ethernet). */
export function macIp() {
  const ip = process.env.NAV_GOLDEN_MAC_IP ?? capture("ipconfig", ["getifaddr", "en0"])?.trim() ?? capture("ipconfig", ["getifaddr", "en1"])?.trim();
  if (!ip) throw new BenchError("IP du Mac introuvable (en0/en1) : NAV_GOLDEN_MAC_IP=<ip>");
  return ip;
}

function devicectl(args, { json = false } = {}) {
  const out = json ? path.join(os.tmpdir(), `nav-golden-devicectl-${process.pid}-${Date.now()}.json`) : null;
  try {
    execFileSync("xcrun", ["devicectl", ...args, ...(out ? ["--json-output", out] : [])], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 180_000 });
    return out ? JSON.parse(fs.readFileSync(out, "utf8")) : true;
  } catch (error) {
    const reason = String(error.stderr || error.stdout || error.message).trim().split("\n").slice(-3).join(" ");
    throw new BenchError(`devicectl ${args.slice(0, 2).join(" ")} a échoué : ${reason}`);
  } finally {
    if (out) fs.rmSync(out, { force: true });
  }
}

/** Les identifiants des apps installées (toutes, App Store / TestFlight comprises). */
export function installedApps() {
  const { coredevice } = deviceIds();
  const reply = devicectl(["device", "info", "apps", "--device", coredevice, "--include-all-apps"], { json: true });
  return (reply?.result?.apps ?? []).map((app) => app.bundleIdentifier);
}

/** L'app de l'utilisateur doit être là — avant toute installation, et après. */
export function checkUserApp(moment) {
  const apps = installedApps();
  if (!apps.includes(USER_BUNDLE)) throw new BenchError(`${moment} : l'app de l'utilisateur (${USER_BUNDLE}) n'est PAS sur l'appareil — on s'arrête`);
  note(`${moment} : app de l'utilisateur présente (${USER_BUNDLE}), app de test ${apps.includes(TEST_BUNDLE) ? "présente" : "absente"}`);
  return apps;
}

export function describePhysical() {
  const { coredevice } = deviceIds();
  try {
    const info = devicectl(["device", "info", "details", "--device", coredevice], { json: true })?.result;
    return { kind: "appareil", name: info?.deviceProperties?.name ?? "Apple TV", model: info?.hardwareProperties?.productType ?? "?", runtime: `tvOS-${info?.deviceProperties?.osVersionNumber ?? "?"}` };
  } catch {
    return { kind: "appareil", name: "Apple TV", model: "?", runtime: "?" };
  }
}

/** L'app de test pour l'appareil, une fois par empreinte du natif (signature auto, équipe du compte). */
export async function ensureDeviceApp(checkout) {
  const fingerprint = `${nativeFingerprint(checkout)}-navtest`;
  const app = path.join(CACHE_DIR, "apps-device", fingerprint, "TentacleTV.app");
  if (fs.existsSync(path.join(app, "Info.plist"))) return { fingerprint, app };
  await withLock(`build-device-${fingerprint}`, async () => {
    if (fs.existsSync(path.join(app, "Info.plist"))) return;
    const derived = path.join(CACHE_DIR, "dd-device", fingerprint.replace(/-navtest$/, ""));
    const log = path.join(CACHE_DIR, "builds", `device-${fingerprint}.log`);
    step("App de test (appareil)", `build Debug ${TEST_BUNDLE} depuis ${checkout.label} (10 à 15 min la première fois)`);
    const start = Date.now();
    fs.mkdirSync(path.dirname(log), { recursive: true });
    try {
      execFileSync("xcodebuild", [
        "-workspace", "TentacleTV.xcworkspace", "-scheme", "TentacleTV", "-configuration", "Debug", "-destination", "generic/platform=tvOS",
        "-derivedDataPath", derived, `PRODUCT_BUNDLE_IDENTIFIER=${TEST_BUNDLE}`, `DEVELOPMENT_TEAM=${process.env.NAV_GOLDEN_TEAM ?? "96K3M57W49"}`,
        "CODE_SIGN_STYLE=Automatic", "SKIP_BUNDLING=1", "COMPILER_INDEX_STORE_ENABLE=NO", "-allowProvisioningUpdates", "build",
      ], { cwd: path.join(checkout.dir, "apps/tv/ios"), env: { ...process.env, LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" }, stdio: ["ignore", fs.openSync(log, "w"), "pipe"], maxBuffer: 1 << 26 });
    } catch {
      throw new BenchError(`build appareil en échec — journal : ${log}`);
    }
    fs.mkdirSync(path.dirname(app), { recursive: true });
    fs.cpSync(path.join(derived, PRODUCT), app, { recursive: true, verbatimSymlinks: true });
    note(`build appareil réussie en ${duration(Date.now() - start)}`);
  });
  return { fingerprint, app };
}

/** Installe l'app de test si l'appareil n'a pas celle de cette empreinte. */
export function ensureDeviceInstalled(app, fingerprint, state) {
  const { coredevice } = deviceIds();
  if (state.installedDevice === fingerprint && installedApps().includes(TEST_BUNDLE)) return false;
  devicectl(["device", "install", "app", "--device", coredevice, app]);
  state.installedDevice = fingerprint;
  note(`app de test installée sur l'appareil (${fingerprint})`);
  return true;
}

/**
 * Lance (relance) l'app de test : Metro et faux backend sur l'IP du Mac, et la
 * remise à zéro par la sonde (`-navGoldenSession`, `-navGoldenServer`,
 * `-navGoldenStorage`) — dans le domaine de l'app de TEST seulement.
 */
export function launchOnDevice(ctx, { session = "paired", storage = {} }) {
  const { coredevice } = deviceIds();
  const ip = macIp();
  const args = ["-RCT_jsLocation", `${ip}:${ctx.ports.metro}`, "-navGoldenSession", session, "-navGoldenServer", `http://${ip}:${ctx.ports.backend}`];
  if (Object.keys(storage).length) args.push("-navGoldenStorage", Buffer.from(JSON.stringify(storage)).toString("base64"));
  // `--` : sans lui, devicectl lit `-navGolden…` comme ses propres options courtes.
  devicectl(["device", "process", "launch", "--device", coredevice, "--terminate-existing", TEST_BUNDLE, "--", ...args]);
}

/** La commande que T8 passe à la fin du lot : l'app de test retirée, celle de l'utilisateur intacte. */
export const UNINSTALL_COMMAND = `xcrun devicectl device uninstall app --device ${deviceIds().coredevice} ${TEST_BUNDLE}`;
