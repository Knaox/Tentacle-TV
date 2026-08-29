#!/usr/bin/env node
/**
 * Installe Tentacle TV sur un téléviseur LG, depuis un Mac, un PC Windows ou
 * une machine Linux.
 *
 * Ce que l'utilisateur a fait AVANT de lancer ce script, et qu'on ne peut pas
 * faire à sa place : installer « Developer Mode » depuis le Content Store de son
 * téléviseur, s'y connecter avec son compte développeur LG, et laisser l'écran
 * de l'application ouvert. C'est cet écran qui affiche les deux seules choses
 * qu'on lui demandera — l'adresse du téléviseur et la phrase secrète — et c'est
 * lui qui ouvre le port par lequel tout passe.
 *
 * Le paquet est rapatrié depuis la release `webos-latest` du dépôt, dont
 * l'adresse ne change jamais : ce script n'a pas de version à suivre, il
 * installe toujours la dernière.
 *
 * Le seul prérequis côté ordinateur est Node.js. Le reste — la CLI webOS de
 * LG — s'installe tout seul, dans un dossier à nous, sans droits particuliers.
 */
import { createInterface } from "node:readline/promises";
import { rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  locateAres,
  aresUsable,
  installerAres,
  runAres,
  devModeAnswers,
  download,
} from "./tooling.mjs";

const REPO = "Knaox/Tentacle-TV";
const PACKAGE_URL = `https://github.com/${REPO}/releases/download/webos-latest/tentacle-tv.ipk`;
const IDENTIFIER = "com.tentacletv.webos";
/** Le nom sous lequel le téléviseur est enregistré dans la CLI de LG. */
const DEVICE = "tentacle-tv";
/** Le port SSH du mode développeur, et son compte. Ni l'un ni l'autre ne varie. */
const PORT = "9922";
const ACCOUNT = "prisoner";
/** Le portail où se crée le compte développeur, sans lequel rien ne commence. */
const LG_ACCOUNT = "https://webostv.developer.lge.com";

const colors = process.stdout.isTTY;
const bold = (t) => (colors ? `\x1b[1m${t}\x1b[0m` : t);
const pale = (t) => (colors ? `\x1b[2m${t}\x1b[0m` : t);
const violet = (t) => (colors ? `\x1b[35m${t}\x1b[0m` : t);
const vert = (t) => (colors ? `\x1b[32m${t}\x1b[0m` : t);

let step = 0;
const announce = (title) => console.log(`\n${violet(`[${++step}]`)} ${bold(title)}`);

/**
 * Le cadre est calculé, pas dessiné à la main : la coloration insère des codes
 * d'échappement qui comptent dans la longueur de la chaîne mais pas à l'écran,
 * et un cadre écrit au jugé finit toujours par déborder d'un caractère.
 */
function cadre(title) {
  const marge = 3;
  const barre = "─".repeat(title.length + marge * 2);
  const blanc = " ".repeat(marge);
  return [
    violet(`  ╭${barre}╮`),
    `${violet("  │")}${blanc}${bold(title)}${blanc}${violet("│")}`,
    violet(`  ╰${barre}╯`),
  ].join("\n");
}

function welcome() {
  console.log(`
${cadre("Tentacle TV — installation sur téléviseur LG")}

  Il faut d'abord un compte développeur LG — gratuit, trois minutes :

    ${violet(LG_ACCOUNT)}
    ${pale("« Sign In » en haut à droite, puis « CREATE ACCOUNT ».")}

  Ensuite, sur le téléviseur :

    1. installez ${bold("Developer Mode")} depuis le LG Content Store ;
    2. ouvrez-la et connectez-vous avec ce compte ;
    3. mettez ${bold("Dev Mode Status")} sur ${bold("ON")} — le téléviseur redémarre ;
    4. rouvrez l'application et activez ${bold("Key Server")} ;
    5. laissez cet écran affiché — il porte l'adresse IP et la
       ${bold("phrase secrète")} de six caractères, en bas à gauche.

  ${bold("L'étape 4 n'est pas facultative")} : sans le Key Server, le téléviseur ne
  ${pale("publie pas sa clé, et aucune installation n'est possible.")}

  ${pale("L'ordinateur et le téléviseur doivent être sur le même réseau.")}
`);
}

/** Node 18 est le premier à porter `fetch` et `AbortSignal.timeout`. */
function checkNode() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 18) {
    throw new Error(
      `Node.js ${process.versions.node} est trop ancien (18 minimum).\n` +
        "Installez la version LTS depuis https://nodejs.org puis relancez."
    );
  }
}

async function ask(lecture, question, validate) {
  for (;;) {
    const response = (await lecture.question(question)).trim();
    const issue = validate(response);
    if (!issue) return response;
    console.log(`  ${issue}`);
  }
}

const IS_IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

async function dialogue(lecture) {
  announce("Les informations affichées sur le téléviseur");
  console.log(
    pale("    L'adresse IP figure sur l'écran de Developer Mode, et aussi dans\n") +
      pale("    Paramètres › Général › À propos de ce téléviseur › Réseau.\n")
  );
  const address = await ask(
    lecture,
    `  Adresse IP du téléviseur ${pale("(ex. 192.168.1.42)")} : `,
    (value) => {
      if (!value) return "Il en faut une pour joindre le téléviseur.";
      if (!IS_IPV4.test(value)) return "Ce n'est pas une adresse IPv4 (quatre nombres séparés par des points).";
      return null;
    }
  );
  const phrase = await ask(
    lecture,
    `  Phrase secrète ${pale("(6 caractères, en bas à gauche de l'écran)")} : `,
    (value) => {
      if (!value) return "Elle n'apparaît qu'une fois « Key Server » activé.";
      if (!/^[A-Za-z0-9]{4,16}$/.test(value)) return "Attendu : des lettres et des chiffres, sans espace.";
      return null;
    }
  );
  // LG l'affiche en capitales et la clé est déchiffrée telle quelle : une saisie
  // en minuscules donnerait un « Unable to parse private key » incompréhensible.
  return { address, phrase: phrase.toUpperCase() };
}

async function checkTv(address) {
  announce("Le téléviseur répond-il ?");
  if (await devModeAnswers(address)) {
    console.log(`  ${vert("✓")} mode développeur joignable sur ${address}`);
    return;
  }
  // Ce port n'est ouvert que par le Key Server, et par rien d'autre : c'est
  // donc la première chose à vérifier, avant même l'adresse.
  throw new Error(
    `aucune réponse de ${address} sur le port 9991.\n\n` +
      "  Les causes, dans l'ordre de fréquence :\n" +
      "    • KEY SERVER n'est pas activé dans l'application Developer Mode.\n" +
      "      C'est lui, et lui seul, qui ouvre ce port — Dev Mode Status sur ON\n" +
      "      ne suffit pas. Ouvrez l'application et activez-le ;\n" +
      "    • l'application Developer Mode n'est pas ouverte, ou la session a\n" +
      "      expiré (50 heures ; le bouton EXTEND la prolonge) ;\n" +
      "    • l'adresse IP n'est pas la bonne ;\n" +
      "    • l'ordinateur et le téléviseur ne sont pas sur le même réseau."
  );
}

/**
 * La présence de la CLI ne suffit pas : une installation qui n'a rapatrié que
 * le paquet racine laisse tous les fichiers en place et ne meurt qu'au premier
 * `require`, trois étapes plus loin. On la fait donc parler avant de compter
 * dessus, et on repart à neuf si elle se tait.
 */
function tooling() {
  announce("L'outillage de LG");
  const alreadyThere = locateAres();
  if (aresUsable(alreadyThere)) {
    console.log(`  ${vert("✓")} CLI webOS déjà présente`);
    return alreadyThere;
  }
  console.log(
    pale(
      alreadyThere
        ? "    Installation précédente incomplète — on la refait à neuf…"
        : "    Première exécution : installation de la CLI webOS de LG…"
    )
  );
  const racine = installerAres({ purger: Boolean(alreadyThere) });
  console.log(`  ${vert("✓")} CLI webOS installée`);
  return racine;
}

/**
 * L'enregistrement de l'appareil. `--add` échoue si le nom existe déjà — c'est
 * le cas dès la deuxième exécution —, et il n'existe pas d'option « ajouter ou
 * mettre à jour ». On tente l'un, on retombe sur l'autre.
 */
function record(racine, address) {
  announce("Enregistrement du téléviseur");
  const info = [
    "-i", `host=${address}`,
    "-i", `port=${PORT}`,
    "-i", `username=${ACCOUNT}`,
  ];
  const added = runAres(racine, "ares-setup-device", ["-a", DEVICE, ...info]);
  if (added.code === 0) {
    console.log(`  ${vert("✓")} téléviseur enregistré sous « ${DEVICE} »`);
    return;
  }
  const revision = runAres(racine, "ares-setup-device", ["-m", DEVICE, ...info]);
  if (revision.code !== 0) {
    throw new Error(`enregistrement impossible.\n\n${revision.sortie || added.sortie}`);
  }
  console.log(`  ${vert("✓")} enregistrement mis à jour (adresse : ${address})`);
}

/**
 * La clé SSH que le téléviseur sert sur le port 9991. Sans `--passphrase`,
 * l'outil la réclamerait au clavier : on la lui passe pour que l'utilisateur
 * n'ait pas à la retaper.
 */
function fetchKey(racine, phrase) {
  announce("Récupération de la clé du téléviseur");
  const issue = runAres(racine, "ares-novacom", [
    "--getkey", "-d", DEVICE, "--passphrase", phrase,
  ]);
  if (issue.code !== 0) {
    throw new Error(
      "la clé n'a pas pu être récupérée.\n\n" +
        "  Si le message parle de « passphrase » ou de « private key », c'est\n" +
        "  que la phrase secrète saisie ne correspond pas à celle affichée sur\n" +
        `  le téléviseur — elle change à chaque session.\n\n${issue.sortie}`
    );
  }
  console.log(`  ${vert("✓")} clé en place`);
}

async function fetchBack(dossier) {
  announce("Téléchargement de Tentacle TV");
  console.log(pale(`    ${PACKAGE_URL}`));
  const ipkFile = join(dossier, "tentacle-tv.ipk");
  await download(PACKAGE_URL, ipkFile);
  console.log(`  ${vert("✓")} paquet rapatrié`);
  return ipkFile;
}

function installer(racine, ipkFile) {
  announce("Installation sur le téléviseur");
  const issue = runAres(racine, "ares-install", ["-d", DEVICE, ipkFile]);
  if (issue.code !== 0) {
    throw new Error(`l'installation a échoué.\n\n${issue.sortie}`);
  }
  console.log(`  ${vert("✓")} Tentacle TV est installée`);
}

function start(racine) {
  announce("Démarrage");
  const issue = runAres(racine, "ares-launch", ["-d", DEVICE, IDENTIFIER]);
  if (issue.code !== 0) {
    // Un lancement raté ne remet pas l'installation en cause : l'application est
    // sur le téléviseur, et la télécommande sait l'ouvrir.
    console.log(`  ${pale("l'ouverture automatique a échoué — ouvrez-la depuis le menu du téléviseur.")}`);
    return;
  }
  console.log(`  ${vert("✓")} Tentacle TV s'ouvre sur le téléviseur`);
}

async function principal() {
  welcome();
  checkNode();

  const lecture = createInterface({ input: process.stdin, output: process.stdout });
  let address;
  let phrase;
  try {
    ({ address, phrase } = await dialogue(lecture));
  } finally {
    lecture.close();
  }

  await checkTv(address);
  const racine = tooling();
  record(racine, address);
  fetchKey(racine, phrase);

  const dossier = mkdtempSync(join(tmpdir(), "tentacle-webos-"));
  try {
    installer(racine, await fetchBack(dossier));
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
  start(racine);

  console.log(`
  ${vert(bold("Terminé."))}

  L'application vit maintenant sur le téléviseur, dans la liste des
  applications. ${bold("Les mises à jour se font toutes seules")} : l'interface est
  servie par votre serveur Tentacle, ce paquet n'en est que la coquille.

  ${pale("Relancez ce script uniquement si l'application disparaît — le mode")}
  ${pale("développeur de LG désinstalle les applications à l'expiration de la")}
  ${pale("session s'il n'a pas été prolongé.")}
`);
}

principal().catch((error) => {
  console.error(`\n  ${colors ? "\x1b[31m" : ""}Échec${colors ? "\x1b[0m" : ""} : ${error.message}\n`);
  process.exitCode = 1;
});
