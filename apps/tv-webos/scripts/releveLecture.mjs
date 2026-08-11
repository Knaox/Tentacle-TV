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
 *       | node scripts/releveLecture.mjs --sortie logs/saut-avant.ndjson
 */
import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ouvrirInspecteur, trouverCible, connecterSession } from "./releve/inspecteurCdp.mjs";
import { creerJournal, classerRequete, debitEffectif } from "./releve/journalNdjson.mjs";
import { codeSonde } from "./releve/sondePage.mjs";

const ICI = dirname(fileURLToPath(import.meta.url));
const BALISE = "[TTV-RELEVE] ";

function options(argv) {
  const lu = { appareil: "tv", application: "com.tentacletv.webos", sortie: null };
  for (let i = 0; i < argv.length; i += 2) {
    const cle = argv[i]?.replace(/^--/, "");
    if (cle && lu[cle] !== undefined) lu[cle] = argv[i + 1];
  }
  lu.sortie = resolve(ICI, "..", lu.sortie ?? `logs/releve-${horodatage()}.ndjson`);
  return lu;
}

function horodatage() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function principal() {
  const opts = options(process.argv.slice(2));
  const journal = creerJournal(opts.sortie);
  console.error(`relevé → ${opts.sortie}`);

  const inspecteur = await ouvrirInspecteur(opts);
  const cible = await trouverCible(inspecteur.url);
  const session = await connecterSession(cible.webSocketDebuggerUrl);
  console.error(`session ouverte sur ${cible.url}`);

  brancherConsole(session, journal);
  brancherReseau(session, journal);

  await session.envoyer("Runtime.enable");
  await session.envoyer("Log.enable");
  await session.envoyer("Page.enable");
  await session.envoyer("Network.enable", { maxTotalBufferSize: 1_000_000, maxResourceBufferSize: 100_000 });
  // Les deux voies, et il en faut deux : la première couvre la page DÉJÀ
  // chargée, la seconde toute navigation ultérieure — dont `aller`.
  await session.envoyer("Page.addScriptToEvaluateOnNewDocument", { source: codeSonde() });
  await evaluer(session, codeSonde(), journal);

  await jouerOrdres(session, journal);

  journal.ecrire({ evt: "fin", lignes: journal.lignes });
  console.error(`${journal.lignes} lignes → ${opts.sortie}`);
  session.fermer();
  inspecteur.arreter();
  await journal.fermer();
}

/** La console de la page : les relevés de la sonde ET les traces du client. */
function brancherConsole(session, journal) {
  session.sur("Runtime.consoleAPICalled", ({ type, args }) => {
    const texte = (args ?? []).map((a) => a.value ?? a.description ?? a.unserializableValue ?? "").join(" ");
    if (texte.startsWith(BALISE)) {
      try {
        journal.ecrire(JSON.parse(texte.slice(BALISE.length)));
        return;
      } catch { /* relevé illisible : on le garde en brut ci-dessous */ }
    }
    journal.ecrire({ evt: "console", niveau: type, texte: texte.slice(0, 500) });
  });
  session.sur("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    journal.ecrire({ evt: "exception", texte: (exceptionDetails?.text ?? "") + " " + (exceptionDetails?.exception?.description ?? "") });
  });
}

/** Les échanges vus par le MOTEUR. Ce que la pile média fait de son côté ne
 *  passe pas forcément par là — c'est justement ce qu'on vérifie. */
function brancherReseau(session, journal) {
  const enCours = new Map();

  session.sur("Network.requestWillBeSent", ({ requestId, request, timestamp }) => {
    const genre = classerRequete(request.url);
    if (genre === "autre") return;
    enCours.set(requestId, { url: request.url, genre, debut: timestamp * 1000 });
  });
  session.sur("Network.responseReceived", ({ requestId, response, timestamp }) => {
    const suivi = enCours.get(requestId);
    if (!suivi) return;
    suivi.statut = response.status;
    suivi.entetes = timestamp * 1000 - suivi.debut;
  });
  session.sur("Network.loadingFinished", ({ requestId, encodedDataLength, timestamp }) => {
    const suivi = enCours.get(requestId);
    if (!suivi) return;
    enCours.delete(requestId);
    const ms = timestamp * 1000 - suivi.debut;
    journal.ecrire({
      evt: "reseau", genre: suivi.genre, url: courte(suivi.url), statut: suivi.statut,
      ms: Math.round(ms), msEntetes: Math.round(suivi.entetes ?? 0),
      octets: encodedDataLength, debitMbps: debitEffectif(encodedDataLength, ms),
    });
  });
  session.sur("Network.loadingFailed", ({ requestId, errorText, canceled, timestamp }) => {
    const suivi = enCours.get(requestId);
    if (!suivi) return;
    enCours.delete(requestId);
    journal.ecrire({
      evt: "reseau", genre: suivi.genre, url: courte(suivi.url), echec: errorText,
      annule: !!canceled, ms: Math.round(timestamp * 1000 - suivi.debut),
    });
  });
}

const courte = (url) => (url.length > 160 ? `${url.slice(0, 160)}…` : url);

async function evaluer(session, expression, journal) {
  const res = await session.envoyer("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) {
    journal.ecrire({ evt: "ordre-echoue", texte: res.exceptionDetails.text });
    return null;
  }
  return res.result?.value ?? null;
}

/** Les ordres arrivent sur l'entrée standard : le relevé reste scriptable
 *  depuis un shell, et manipulable à la main pendant qu'il tourne. */
async function jouerOrdres(session, journal) {
  const lecteur = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const brut of lecteur) {
    const ligne = brut.trim();
    if (!ligne || ligne.startsWith("#")) continue;
    const [ordre, ...reste] = ligne.split(/\s+/);
    const argument = reste.join(" ");
    journal.ecrire({ evt: "ordre", ordre, argument });
    console.error(`→ ${ligne}`);

    if (ordre === "attendre") await dormir(Number(argument) * 1000);
    else if (ordre === "note") continue;
    else if (ordre === "aller") await evaluer(session, `location.href='/tv/watch/${argument}'`, journal);
    else if (ordre === "saut") await evaluer(session, `document.querySelector('video').currentTime=${Number(argument)}`, journal);
    else if (ordre === "touche") await envoyerTouche(session, reste[0], Number(reste[1] ?? 1), journal);
    else if (ordre === "js") journal.ecrire({ evt: "ordre-resultat", valeur: await evaluer(session, argument, journal) });
    else if (ordre === "capture") await capturer(session, argument, journal);
    else journal.ecrire({ evt: "ordre-inconnu", ordre });
  }
}

/**
 * Une capture des COUCHES DOM. L'image décodée n'y figure pas — le décodage est
 * matériel et hors compositing — mais l'habillage, lui, s'y voit : c'est la
 * seule façon de vérifier de loin qu'une surcouche est bien à l'écran.
 */
async function capturer(session, fichier, journal) {
  const { data } = await session.envoyer("Page.captureScreenshot", { format: "png" });
  const chemin = resolve(ICI, "..", fichier || `logs/capture-${horodatage()}.png`);
  await writeFile(chemin, Buffer.from(data, "base64"));
  journal.ecrire({ evt: "capture", fichier: chemin });
  console.error(`  capture → ${chemin}`);
}

/** Le geste réel : la télécommande n'écrit pas dans `currentTime`, elle appuie
 *  sur une touche, et c'est tout le chemin du lecteur qu'on veut éprouver. */
async function envoyerTouche(session, nom, fois, journal) {
  const codes = { ArrowRight: 39, ArrowLeft: 37, ArrowUp: 38, ArrowDown: 40, Enter: 13, Escape: 27 };
  const code = codes[nom];
  if (!code) return journal.ecrire({ evt: "touche-inconnue", nom });
  for (let i = 0; i < fois; i += 1) {
    await session.envoyer("Input.dispatchKeyEvent", { type: "rawKeyDown", windowsVirtualKeyCode: code, code: nom, key: nom });
    await session.envoyer("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: code, code: nom, key: nom });
    await dormir(120);
  }
}

principal().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
