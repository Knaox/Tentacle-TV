// Provisoire — à retirer quand Android TV aura basculé sur la refonte (A5).
//
// `pnpm tv:refonte:android [--rebuild] [--journal] [--sans-backend]` : l'UI TV (la refonte,
// seule UI d'Android TV depuis la bascule) sur l'émulateur Android TV, en une
// commande — backend de dev, Metro dédié, émulateur sous
// verrou, build debug installée, `adb reverse`, app ouverte.
// `--journal` : chaque touche et l'intention qu'elle porte, dans la console de
// l'app — logcat `ReactNativeJS` (`TENTACLE_TV_REMOTE_LOG=1`). `--sans-backend` : ni réutilisé ni
// lancé (l'app s'ouvre sur son écran de configuration). `pnpm tv:stop` éteint tout.
import { awaitFirstBundle, BACKEND_URL, ensureBackend, ensureMetro, logSize, pairingPageServed } from "./services.mjs";
import { ensureEmulator, requireAndroidSdk, AVD_NAME, LOCK_DIR, stopEmulator } from "./androidEmulator.mjs";
import { ensureAndroidApp, launchApp, reversePorts } from "./androidApp.mjs";
import { note, say, shortPath, step, warn } from "./runtime.mjs";

/** Le Metro de la refonte Android : à part de celui de l'Apple TV (8081). */
const ANDROID_METRO_BASE_PORT = 8091;

export async function refonteAndroid(args, header) {
  const force = args.includes("--rebuild");
  const journal = args.includes("--journal");
  header("Refonte de l'UI TV — Android TV");
  requireAndroidSdk();
  const withoutBackend = args.includes("--sans-backend");
  const backendUp = withoutBackend ? false : await ensureBackend();
  if (withoutBackend) step("Backend de dev", "laissé de côté (--sans-backend)");
  const env = journal ? { TENTACLE_TV_REMOTE_LOG: "1" } : {};
  const metro = await ensureMetro({ key: "metroAndroid", basePort: ANDROID_METRO_BASE_PORT, env, label: "Metro (Android)" });
  await ensureEmulator();
  await ensureAndroidApp({ force });
  reversePorts(metro.port);
  const since = logSize(metro.record);
  launchApp();
  step("App", `ouverte sur l'émulateur « ${AVD_NAME} », code JavaScript servi par le Metro du port ${metro.port}`);
  const bundle = await awaitFirstBundle(metro.record, since);
  if (bundle?.ok) note("code JavaScript chargé depuis Metro");
  else if (bundle) warn(`Metro signale une erreur : ${bundle.line} — journal : ${shortPath(metro.record.log)}`);
  else note("le premier chargement du code prend jusqu'à une minute ; la fenêtre de l'émulateur le montre");

  say();
  say("Jumeler la TV (une fois, avec VOTRE compte — le lanceur n'y touche pas) :");
  if (!backendUp) say("  (pas de backend de dev : voir l'avertissement plus haut)");
  say(`  1. Sur la TV : « Configurer manuellement », adresse ${BACKEND_URL} (l'émulateur la voit par adb reverse).`);
  if (await pairingPageServed()) say(`  2. Un code s'affiche : ouvrez ${BACKEND_URL}/pair-device, connectez-vous, saisissez-le.`);
  else say("  2. Un code s'affiche : saisissez-le dans « Jumeler un appareil » d'un client Tentacle connecté à ce backend.");
  say();
  say("Télécommande (fenêtre de l'émulateur) : flèches = croix, Entrée = OK, Échap = Retour ;");
  say("  OK maintenu : garder Entrée enfoncée ; Lecture/Pause : « adb -s emulator-5584 shell input keyevent 85 ».");
  if (journal) say("Journal des touches : adb -s emulator-5584 logcat -s ReactNativeJS (lignes « [remote] »).");
  say("Build debug : Menu ouvre le menu de développement de React Native (Retour le ferme).");
  say("Une retouche JavaScript se voit aussitôt ; une retouche native se reconstruit au prochain « pnpm tv:refonte:android ».");
  say(`L'émulateur tient le verrou ${shortPath(LOCK_DIR)} tant qu'il tourne. Tout arrêter : pnpm tv:stop`);
}

/** Pour `pnpm tv:stop` : l'émulateur (par son PID) et son verrou. */
export async function stopAndroid() {
  const stopped = await stopEmulator();
  if (stopped) step("Émulateur Android", `« ${AVD_NAME} » éteint, verrou rendu`);
  return stopped;
}
