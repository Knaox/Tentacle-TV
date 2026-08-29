#!/usr/bin/env node
/**
 * Un relevé de lecture sur la vraie dalle, en une passe.
 *
 * Ce que ce script existe pour trancher : pourquoi la lecture se fige au saut
 * et au changement de piste, et pourquoi l'image saccade. Deux questions qu'on
 * ne peut pas poser à un navigateur — le téléviseur lit le HLS avec la pile
 * média de LG, qui ne réessaie jamais et ne dit rien.
 *
 * Il capte en même temps : les capacités du moteur, TOUS les événements du
 * lecteur, l'état échantillonné à 250 ms, ce que le service `videooutput`
 * envoie à la dalle, la console de la page, et les échanges réseau vus par le
 * moteur. Sortie NDJSON, une ligne par observation.
 *
 * ⚠️ Réserve à vérifier dès la première passe : la pile média de LG est
 * probablement HORS de la pile réseau du moteur. Si le journal montre le
 * manifeste et zéro segment, c'est acquis — le proxy du backend est alors la
 * seule vérité réseau (cf. `TENTACLE_JOURNAL_FLUX=1`).
 *
 * Les ordres se lisent sur l'entrée standard, un par ligne, pendant que le
 * relevé tourne :
 *
 *     aller <itemId>      navigue vers /tv/watch/<itemId>
 *     attendre <s>        laisse tourner N secondes
 *     saut <s>            pose la position (court-circuite l'interface)
 *     touche <nom> [n]    envoie n fois une touche au lecteur (geste réel)
 *     js <expression>     échappatoire, évaluée dans la page
 *     note <texte>        marque le journal
 *
 * Exemple — démarrage, trois minutes, puis un saut de quarante minutes :
 *
 *     printf 'aller b79c162e7cd612a4f1dd9add1c50f7f3\\nattendre 180\\nnote saut-avant\\nsaut 2400\\nattendre 90\\n' \\
 *       | node scripts/playbackCapture.mjs --sortie logs/saut-avant.ndjson
 */
import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openInspector, findTarget, connectSession } from "./capture/cdpInspector.mjs";
import { createLog, classifyRequest, effectiveBitrate } from "./capture/ndjsonLog.mjs";
import { probeCode } from "./capture/pageProbe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TAG = "[TTV-RELEVE] ";

function options(argv) {
  const parsed = { device: "tv", application: "com.tentacletv.webos", sortie: null };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (key && parsed[key] !== undefined) parsed[key] = argv[i + 1];
  }
  parsed.sortie = resolve(HERE, "..", parsed.sortie ?? `logs/releve-${timestamp()}.ndjson`);
  return parsed;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const opts = options(process.argv.slice(2));
  const log = createLog(opts.sortie);
  console.error(`relevé → ${opts.sortie}`);

  const inspector = await openInspector(opts);
  const target = await findTarget(inspector.url);
  const session = await connectSession(target.webSocketDebuggerUrl);
  console.error(`session ouverte sur ${target.url}`);

  wireConsole(session, log);
  wireNetwork(session, log);

  await session.send("Runtime.enable");
  await session.send("Log.enable");
  await session.send("Page.enable");
  await session.send("Network.enable", { maxTotalBufferSize: 1_000_000, maxResourceBufferSize: 100_000 });
  // Les deux voies, et il en faut deux : la première couvre la page DÉJÀ
  // chargée, la seconde toute navigation ultérieure — dont `aller`.
  await session.send("Page.addScriptToEvaluateOnNewDocument", { source: probeCode() });
  await evaluate(session, probeCode(), log);

  await runOrders(session, log);

  log.write({ evt: "fin", lines: log.lines });
  console.error(`${log.lines} lignes → ${opts.sortie}`);
  session.close();
  inspector.stopIt();
  await log.close();
}

/** La console de la page : les relevés de la sonde ET les traces du client. */
function wireConsole(session, log) {
  session.on("Runtime.consoleAPICalled", ({ type, args }) => {
    const text = (args ?? []).map((a) => a.value ?? a.description ?? a.unserializableValue ?? "").join(" ");
    if (text.startsWith(TAG)) {
      try {
        log.write(JSON.parse(text.slice(TAG.length)));
        return;
      } catch { /* relevé illisible : on le garde en brut ci-dessous */ }
    }
    log.write({ evt: "console", level: type, text: text.slice(0, 500) });
  });
  session.on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    log.write({ evt: "exception", text: (exceptionDetails?.text ?? "") + " " + (exceptionDetails?.exception?.description ?? "") });
  });
}

/** Les échanges vus par le MOTEUR. Ce que la pile média fait de son côté ne
 *  passe pas forcément par là — c'est justement ce qu'on vérifie. */
function wireNetwork(session, log) {
  const inProgress = new Map();

  session.on("Network.requestWillBeSent", ({ requestId, request, timestamp }) => {
    const genre = classifyRequest(request.url);
    if (genre === "autre") return;
    inProgress.set(requestId, { url: request.url, genre, start: timestamp * 1000 });
  });
  session.on("Network.responseReceived", ({ requestId, response, timestamp }) => {
    const tracked = inProgress.get(requestId);
    if (!tracked) return;
    tracked.status = response.status;
    tracked.headers = timestamp * 1000 - tracked.start;
  });
  session.on("Network.loadingFinished", ({ requestId, encodedDataLength, timestamp }) => {
    const tracked = inProgress.get(requestId);
    if (!tracked) return;
    inProgress.delete(requestId);
    const ms = timestamp * 1000 - tracked.start;
    log.write({
      evt: "reseau", genre: tracked.genre, url: short(tracked.url), status: tracked.status,
      ms: Math.round(ms), headersMs: Math.round(tracked.headers ?? 0),
      bytes: encodedDataLength, bitrateMbps: effectiveBitrate(encodedDataLength, ms),
    });
  });
  session.on("Network.loadingFailed", ({ requestId, errorText, canceled, timestamp }) => {
    const tracked = inProgress.get(requestId);
    if (!tracked) return;
    inProgress.delete(requestId);
    log.write({
      evt: "reseau", genre: tracked.genre, url: short(tracked.url), failure: errorText,
      cancelled: !!canceled, ms: Math.round(timestamp * 1000 - tracked.start),
    });
  });
}

const short = (url) => (url.length > 160 ? `${url.slice(0, 160)}…` : url);

async function evaluate(session, expression, log) {
  const res = await session.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) {
    log.write({ evt: "ordre-echoue", text: res.exceptionDetails.text });
    return null;
  }
  return res.result?.value ?? null;
}

/** Les ordres arrivent sur l'entrée standard : le relevé reste scriptable
 *  depuis un shell, et manipulable à la main pendant qu'il tourne. */
async function runOrders(session, log) {
  const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const raw of reader) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [order, ...rest] = line.split(/\s+/);
    const argument = rest.join(" ");
    log.write({ evt: "ordre", order, argument });
    console.error(`→ ${line}`);

    if (order === "attendre") await sleep(Number(argument) * 1000);
    else if (order === "note") continue;
    else if (order === "aller") await evaluate(session, `location.href='/tv/watch/${argument}'`, log);
    else if (order === "saut") await evaluate(session, `document.querySelector('video').currentTime=${Number(argument)}`, log);
    else if (order === "touche") await sendKey(session, rest[0], Number(rest[1] ?? 1), log);
    else if (order === "js") log.write({ evt: "ordre-resultat", value: await evaluate(session, argument, log) });
    else if (order === "capture") await capture(session, argument, log);
    else log.write({ evt: "ordre-inconnu", order });
  }
}

/**
 * Une capture des COUCHES DOM. L'image décodée n'y figure pas — le décodage est
 * matériel et hors compositing — mais l'habillage, lui, s'y voit : c'est la
 * seule façon de vérifier de loin qu'une surcouche est bien à l'écran.
 */
async function capture(session, file, log) {
  const { data } = await session.send("Page.captureScreenshot", { format: "png" });
  const path = resolve(HERE, "..", file || `logs/capture-${timestamp()}.png`);
  await writeFile(path, Buffer.from(data, "base64"));
  log.write({ evt: "capture", file: path });
  console.error(`  capture → ${path}`);
}

/** Le geste réel : la télécommande n'écrit pas dans `currentTime`, elle appuie
 *  sur une touche, et c'est tout le chemin du lecteur qu'on veut éprouver. */
async function sendKey(session, nom, times, log) {
  const codes = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, Enter: 13, Escape: 27 };
  const code = codes[nom];
  if (!code) return log.write({ evt: "touche-inconnue", nom });
  for (let i = 0; i < times; i += 1) {
    await session.send("Input.dispatchKeyEvent", { type: "rawKeyDown", windowsVirtualKeyCode: code, code: nom, key: nom });
    await session.send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: code, code: nom, key: nom });
    await sleep(120);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
