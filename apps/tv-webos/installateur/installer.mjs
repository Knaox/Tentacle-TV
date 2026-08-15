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
  localiserAres,
  installerAres,
  lancerAres,
  modeDeveloppeurRepond,
  telecharger,
} from "./outillage.mjs";

const DEPOT = "Knaox/Tentacle-TV";
const URL_PAQUET = `https://github.com/${DEPOT}/releases/download/webos-latest/tentacle-tv.ipk`;
const IDENTIFIANT = "com.tentacletv.webos";
/** Le nom sous lequel le téléviseur est enregistré dans la CLI de LG. */
const APPAREIL = "tentacle-tv";
/** Le port SSH du mode développeur, et son compte. Ni l'un ni l'autre ne varie. */
const PORT = "9922";
const COMPTE = "prisoner";

const couleurs = process.stdout.isTTY;
const gras = (t) => (couleurs ? `\x1b[1m${t}\x1b[0m` : t);
const pale = (t) => (couleurs ? `\x1b[2m${t}\x1b[0m` : t);
const violet = (t) => (couleurs ? `\x1b[35m${t}\x1b[0m` : t);
const vert = (t) => (couleurs ? `\x1b[32m${t}\x1b[0m` : t);

let etape = 0;
const annoncer = (titre) => console.log(`\n${violet(`[${++etape}]`)} ${gras(titre)}`);

/**
 * Le cadre est calculé, pas dessiné à la main : la coloration insère des codes
 * d'échappement qui comptent dans la longueur de la chaîne mais pas à l'écran,
 * et un cadre écrit au jugé finit toujours par déborder d'un caractère.
 */
function cadre(titre) {
  const marge = 3;
  const barre = "─".repeat(titre.length + marge * 2);
  const blanc = " ".repeat(marge);
  return [
    violet(`  ╭${barre}╮`),
    `${violet("  │")}${blanc}${gras(titre)}${blanc}${violet("│")}`,
    violet(`  ╰${barre}╯`),
  ].join("\n");
}

function accueil() {
  console.log(`
${cadre("Tentacle TV — installation sur téléviseur LG")}

  Avant de commencer, sur le téléviseur :

    1. installez ${gras("Developer Mode")} depuis le LG Content Store ;
    2. ouvrez-la et connectez-vous avec votre compte développeur LG ;
    3. mettez ${gras("Dev Mode Status")} sur ${gras("ON")} ;
    4. laissez cet écran affiché — il porte l'adresse IP et la
       ${gras("phrase secrète")} que ce script va vous demander.

  ${pale("L'ordinateur et le téléviseur doivent être sur le même réseau.")}
`);
}

/** Node 18 est le premier à porter `fetch` et `AbortSignal.timeout`. */
function verifierNode() {
  const majeure = Number(process.versions.node.split(".")[0]);
  if (majeure < 18) {
    throw new Error(
      `Node.js ${process.versions.node} est trop ancien (18 minimum).\n` +
        "Installez la version LTS depuis https://nodejs.org puis relancez."
    );
  }
}

async function demander(lecture, question, valider) {
  for (;;) {
    const reponse = (await lecture.question(question)).trim();
    const souci = valider(reponse);
    if (!souci) return reponse;
    console.log(`  ${souci}`);
  }
}

const EST_IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

async function dialogue(lecture) {
  annoncer("Les informations affichées sur le téléviseur");
  console.log(
    pale("    L'adresse IP figure sur l'écran de Developer Mode, et aussi dans\n") +
      pale("    Paramètres › Général › À propos de ce téléviseur › Réseau.\n")
  );
  const adresse = await demander(
    lecture,
    `  Adresse IP du téléviseur ${pale("(ex. 192.168.1.42)")} : `,
    (valeur) => {
      if (!valeur) return "Il en faut une pour joindre le téléviseur.";
      if (!EST_IPV4.test(valeur)) return "Ce n'est pas une adresse IPv4 (quatre nombres séparés par des points).";
      return null;
    }
  );
  const phrase = await demander(
    lecture,
    `  Phrase secrète ${pale("(le « key server passphrase », 6 caractères)")} : `,
    (valeur) => {
      if (!valeur) return "Elle est affichée dans l'application Developer Mode.";
      if (!/^[A-Za-z0-9]{4,16}$/.test(valeur)) return "Attendu : des lettres et des chiffres, sans espace.";
      return null;
    }
  );
  // LG l'affiche en capitales et la clé est déchiffrée telle quelle : une saisie
  // en minuscules donnerait un « Unable to parse private key » incompréhensible.
  return { adresse, phrase: phrase.toUpperCase() };
}

async function verifierTeleviseur(adresse) {
  annoncer("Le téléviseur répond-il ?");
  if (await modeDeveloppeurRepond(adresse)) {
    console.log(`  ${vert("✓")} mode développeur joignable sur ${adresse}`);
    return;
  }
  throw new Error(
    `aucune réponse de ${adresse} sur le port 9991.\n\n` +
      "  Les trois causes, dans l'ordre de fréquence :\n" +
      "    • l'application Developer Mode n'est pas ouverte, ou Dev Mode Status\n" +
      "      n'est pas sur ON (la session expire au bout de 50 heures) ;\n" +
      "    • l'adresse IP n'est pas la bonne ;\n" +
      "    • l'ordinateur et le téléviseur ne sont pas sur le même réseau."
  );
}

function outillage() {
  annoncer("L'outillage de LG");
  const dejaLa = localiserAres();
  if (dejaLa) {
    console.log(`  ${vert("✓")} CLI webOS déjà présente`);
    return dejaLa;
  }
  console.log(pale("    Première exécution : installation de la CLI webOS de LG…"));
  const racine = installerAres();
  console.log(`  ${vert("✓")} CLI webOS installée`);
  return racine;
}

/**
 * L'enregistrement de l'appareil. `--add` échoue si le nom existe déjà — c'est
 * le cas dès la deuxième exécution —, et il n'existe pas d'option « ajouter ou
 * mettre à jour ». On tente l'un, on retombe sur l'autre.
 */
function enregistrer(racine, adresse) {
  annoncer("Enregistrement du téléviseur");
  const infos = [
    "-i", `host=${adresse}`,
    "-i", `port=${PORT}`,
    "-i", `username=${COMPTE}`,
  ];
  const ajout = lancerAres(racine, "ares-setup-device", ["-a", APPAREIL, ...infos]);
  if (ajout.code === 0) {
    console.log(`  ${vert("✓")} téléviseur enregistré sous « ${APPAREIL} »`);
    return;
  }
  const revision = lancerAres(racine, "ares-setup-device", ["-m", APPAREIL, ...infos]);
  if (revision.code !== 0) {
    throw new Error(`enregistrement impossible.\n\n${revision.sortie || ajout.sortie}`);
  }
  console.log(`  ${vert("✓")} enregistrement mis à jour (adresse : ${adresse})`);
}

/**
 * La clé SSH que le téléviseur sert sur le port 9991. Sans `--passphrase`,
 * l'outil la réclamerait au clavier : on la lui passe pour que l'utilisateur
 * n'ait pas à la retaper.
 */
function recupererCle(racine, phrase) {
  annoncer("Récupération de la clé du téléviseur");
  const issue = lancerAres(racine, "ares-novacom", [
    "--getkey", "-d", APPAREIL, "--passphrase", phrase,
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

async function rapatrier(dossier) {
  annoncer("Téléchargement de Tentacle TV");
  console.log(pale(`    ${URL_PAQUET}`));
  const paquet = join(dossier, "tentacle-tv.ipk");
  await telecharger(URL_PAQUET, paquet);
  console.log(`  ${vert("✓")} paquet rapatrié`);
  return paquet;
}

function installer(racine, paquet) {
  annoncer("Installation sur le téléviseur");
  const issue = lancerAres(racine, "ares-install", ["-d", APPAREIL, paquet]);
  if (issue.code !== 0) {
    throw new Error(`l'installation a échoué.\n\n${issue.sortie}`);
  }
  console.log(`  ${vert("✓")} Tentacle TV est installée`);
}

function demarrer(racine) {
  annoncer("Démarrage");
  const issue = lancerAres(racine, "ares-launch", ["-d", APPAREIL, IDENTIFIANT]);
  if (issue.code !== 0) {
    // Un lancement raté ne remet pas l'installation en cause : l'application est
    // sur le téléviseur, et la télécommande sait l'ouvrir.
    console.log(`  ${pale("l'ouverture automatique a échoué — ouvrez-la depuis le menu du téléviseur.")}`);
    return;
  }
  console.log(`  ${vert("✓")} Tentacle TV s'ouvre sur le téléviseur`);
}

async function principal() {
  accueil();
  verifierNode();

  const lecture = createInterface({ input: process.stdin, output: process.stdout });
  let adresse;
  let phrase;
  try {
    ({ adresse, phrase } = await dialogue(lecture));
  } finally {
    lecture.close();
  }

  await verifierTeleviseur(adresse);
  const racine = outillage();
  enregistrer(racine, adresse);
  recupererCle(racine, phrase);

  const dossier = mkdtempSync(join(tmpdir(), "tentacle-webos-"));
  try {
    installer(racine, await rapatrier(dossier));
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
  demarrer(racine);

  console.log(`
  ${vert(gras("Terminé."))}

  L'application vit maintenant sur le téléviseur, dans la liste des
  applications. ${gras("Les mises à jour se font toutes seules")} : l'interface est
  servie par votre serveur Tentacle, ce paquet n'en est que la coquille.

  ${pale("Relancez ce script uniquement si l'application disparaît — le mode")}
  ${pale("développeur de LG désinstalle les applications à l'expiration de la")}
  ${pale("session s'il n'a pas été prolongé.")}
`);
}

principal().catch((erreur) => {
  console.error(`\n  ${couleurs ? "\x1b[31m" : ""}Échec${couleurs ? "\x1b[0m" : ""} : ${erreur.message}\n`);
  process.exitCode = 1;
});
