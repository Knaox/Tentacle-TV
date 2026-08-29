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
import { codeSonde } from "./capture/pageProbe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TAG = "[TTV-RELEVE] ";

function options(argv) {
  const lu = { device: "tv", application: "com.tentacletv.webos", sortie: null };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (key && lu[key] !== undefined) lu[key] = argv[i + 1];
  }
  lu.sortie = resolve(HERE, "..", lu.sortie ?? `logs/releve-${timestamp()}.ndjson`);
  return lu;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function principal() {
  const opts = options(process.argv.slice(2));
  const journal = createLog(opts.sortie);
  console.error(`relevé → ${opts.sortie}`);

  const inspector = await openInspector(opts);
  const target = await findTarget(inspector.url);
  const session = await connectSession(target.webSocketDebuggerUrl);
  console.error(`session ouverte sur ${target.url}`);

  wireConsole(session, journal);
  wireNetwork(session, journal);

  await session.send("Runtime.enable");
  await session.send("Log.enable");
  await session.send("Page.enable");
  await session.send("Network.enable", { maxTotalBufferSize: 1_000_000, maxResourceBufferSize: 100_000 });
  // Les deux voies, et il en faut deux : la première couvre la page DÉJÀ
  // chargée, la seconde toute navigation ultérieure — dont `aller`.
  await session.send("Page.addScriptToEvaluateOnNewDocument", { source: codeSonde() });
  await evaluate(session, codeSonde(), journal);

  await runOrders(session, journal);

  journal.write({ evt: "fin", lines: journal.lines });
  console.error(`${journal.lines} lignes → ${opts.sortie}`);
  session.close();
  inspector.stopIt();
  await journal.close();
}

/** La console de la page : les relevés de la sonde ET les traces du client. */
function wireConsole(session, journal) {
  session.sur("Runtime.consoleAPICalled", ({ type, args }) => {
    const text = (args ?? []).map((a) => a.value ?? a.description ?? a.unserializableValue ?? "").join(" ");
    if (text.startsWith(TAG)) {
      try {
        journal.write(JSON.parse(text.slice(TAG.length)));
        return;
      } catch { /* relevé illisible : on le garde en brut ci-dessous */ }
    }
    journal.write({ evt: "console", level: type, text: text.slice(0, 500) });
  });
  session.sur("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    journal.write({ evt: "exception", text: (exceptionDetails?.text ?? "") + " " + (exceptionDetails?.exception?.description ?? "") });
  });
}

/** Les échanges vus par le MOTEUR. Ce que la pile média fait de son côté ne
 *  passe pas forcément par là — c'est justement ce qu'on vérifie. */
function wireNetwork(session, journal) {
  const inProgress = new Map();

  session.sur("Network.requestWillBeSent", ({ requestId, request, timestamp }) => {
    const genre = classifyRequest(request.url);
    if (genre === "autre") return;
    inProgress.set(requestId, { url: request.url, genre, debut: timestamp * 1000 });
  });
  session.sur("Network.responseReceived", ({ requestId, response, timestamp }) => {
    const tracked = inProgress.get(requestId);
    if (!tracked) return;
    tracked.status = response.status;
    tracked.headers = timestamp * 1000 - tracked.debut;
  });
  session.sur("Network.loadingFinished", ({ requestId, encodedDataLength, timestamp }) => {
    const tracked = inProgress.get(requestId);
    if (!tracked) return;
    inProgress.delete(requestId);
    const ms = timestamp * 1000 - tracked.debut;
    journal.write({
      evt: "reseau", genre: tracked.genre, url: short(tracked.url), status: tracked.status,
      ms: Math.round(ms), headersMs: Math.round(tracked.headers ?? 0),
      bytes: encodedDataLength, bitrateMbps: effectiveBitrate(encodedDataLength, ms),
    });
  });
  session.sur("Network.loadingFailed", ({ requestId, errorText, canceled, timestamp }) => {
    const tracked = inProgress.get(requestId);
    if (!tracked) return;
    inProgress.delete(requestId);
    journal.write({
      evt: "reseau", genre: tracked.genre, url: short(tracked.url), failure: errorText,
      cancelled: !!canceled, ms: Math.round(timestamp * 1000 - tracked.debut),
    });
  });
}

const short = (url) => (url.length > 160 ? `${url.slice(0, 160)}…` : url);

async function evaluate(session, expression, journal) {
  const res = await session.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) {
    journal.write({ evt: "ordre-echoue", text: res.exceptionDetails.text });
    return null;
  }
  return res.result?.value ?? null;
}

/** Les ordres arrivent sur l'entrée standard : le relevé reste scriptable
 *  depuis un shell, et manipulable à la main pendant qu'il tourne. */
async function runOrders(session, journal) {
  const reader = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const raw of reader) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [order, ...rest] = line.split(/\s+/);
    const argument = rest.join(" ");
    journal.write({ evt: "ordre", order, argument });
    console.error(`→ ${line}`);

    if (order === "attendre") await sleep(Number(argument) * 1000);
    else if (order === "note") continue;
    else if (order === "aller") await evaluate(session, `location.href='/tv/watch/${argument}'`, journal);
    else if (order === "saut") await evaluate(session, `document.querySelector('video').currentTime=${Number(argument)}`, journal);
    else if (order === "touche") await sendKey(session, rest[0], Number(rest[1] ?? 1), journal);
    else if (order === "js") journal.write({ evt: "ordre-resultat", value: await evaluate(session, argument, journal) });
    else if (order === "capture") await capture(session, argument, journal);
    else journal.write({ evt: "ordre-inconnu", order });
  }
}

/**
 * Une capture des COUCHES DOM. L'image décodée n'y figure pas — le décodage est
 * matériel et hors compositing — mais l'habillage, lui, s'y voit : c'est la
 * seule façon de vérifier de loin qu'une surcouche est bien à l'écran.
 */
async function capture(session, file, journal) {
  const { data } = await session.send("Page.captureScreenshot", { format: "png" });
  const path = resolve(HERE, "..", file || `logs/capture-${timestamp()}.png`);
  await writeFile(path, Buffer.from(data, "base64"));
  journal.write({ evt: "capture", file: path });
  console.error(`  capture → ${path}`);
}

/** Le geste réel : la télécommande n'écrit pas dans `currentTime`, elle appuie
 *  sur une touche, et c'est tout le chemin du lecteur qu'on veut éprouver. */
async function sendKey(session, nom, times, journal) {
  const codes = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, Enter: 13, Escape: 27 };
  const code = codes[nom];
  if (!code) return journal.write({ evt: "touche-inconnue", nom });
  for (let i = 0; i < times; i += 1) {
    await session.send("Input.dispatchKeyEvent", { type: "rawKeyDown", windowsVirtualKeyCode: code, code: nom, key: nom });
    await session.send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: code, code: nom, key: nom });
    await sleep(120);
  }
}

principal().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
