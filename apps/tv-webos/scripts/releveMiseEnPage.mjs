/**
 * Relevé de mise en page : ce que la dalle DESSINE, pas ce que la feuille DIT.
 *
 * La garde de compatibilité (`config/postcss/gardeCompat.ts`) vérifie la
 * feuille produite, et elle est nécessaire. Elle ne suffit pas : une feuille
 * parfaitement conforme au socle peut poser un titre à cheval sur son voisin.
 * C'est arrivé — dix-huit chevauchements sur une fiche, dus à une bizarrerie de
 * la feuille de l'agent utilisateur que nulle passe ne pouvait voir.
 *
 * Cet outil ferme cet angle mort. Il relève la boîte de chaque texte affiché,
 * signale ceux qui se recouvrent, et compare deux relevés — avant contre après
 * un correctif, ou la dalle contre un navigateur de bureau, qui sert alors de
 * rendu de référence.
 *
 *   node apps/tv-webos/scripts/releveMiseEnPage.mjs --appareil tv \
 *        --bibliotheque <id> --item <id> --sortie logs/mise-en-page-avant.json
 *
 *   node apps/tv-webos/scripts/releveMiseEnPage.mjs --compare \
 *        logs/mise-en-page-avant.json logs/mise-en-page-apres.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { ouvrirInspecteur, trouverCible, connecterSession } from "./releve/inspecteurCdp.mjs";
import { SONDE_MISE_EN_PAGE, routesParDefaut } from "./releve/sondeMiseEnPage.mjs";
import { chevauchements, divergences, resumer } from "./releve/comparerBoites.mjs";

/** Le temps laissé à un écran pour se peindre, images comprises. */
const DELAI_ECRAN_MS = 15_000;

function lireOptions(argv) {
  const o = { appareil: "tv", application: "com.tentacletv.webos" };
  for (let i = 0; i < argv.length; i += 1) {
    const cle = argv[i];
    if (cle === "--compare") return { compare: [argv[i + 1], argv[i + 2]] };
    if (!cle.startsWith("--")) continue;
    o[cle.slice(2)] = argv[i + 1];
  }
  return o;
}

async function relever(session, expression) {
  const reponse = await session.envoyer("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (reponse.exceptionDetails) {
    throw new Error(reponse.exceptionDetails.exception?.description ?? "sonde en échec");
  }
  return reponse.result?.value;
}

async function balayer(options) {
  const inspecteur = await ouvrirInspecteur(options);
  try {
    const cible = await trouverCible(inspecteur.url);
    let session = await connecterSession(cible.webSocketDebuggerUrl);
    await session.envoyer("Runtime.enable", {});

    const releves = {};
    for (const route of routesParDefaut(options)) {
      await relever(session, `location.href = ${JSON.stringify(route.chemin)}`);
      await new Promise((r) => setTimeout(r, DELAI_ECRAN_MS));
      // Une navigation de premier niveau tue le contexte d'exécution : la
      // session se rebranche sur la cible, qui a gardé son identifiant.
      session.fermer?.();
      session = await connecterSession((await trouverCible(inspecteur.url)).webSocketDebuggerUrl);
      await session.envoyer("Runtime.enable", {});

      const releve = await relever(session, SONDE_MISE_EN_PAGE);
      releves[route.nom] = releve;
      console.log(resumer(route.nom, releve, chevauchements(releve.boites)));
    }
    session.fermer?.();
    return releves;
  } finally {
    inspecteur.arreter();
  }
}

function comparer(cheminA, cheminB) {
  const a = JSON.parse(readFileSync(cheminA, "utf8"));
  const b = JSON.parse(readFileSync(cheminB, "utf8"));
  for (const nom of Object.keys(a)) {
    if (!b[nom]) {
      console.log(`${nom} — absent du second relevé`);
      continue;
    }
    const ecarts = divergences(a[nom].boites, b[nom].boites);
    const chocsA = chevauchements(a[nom].boites).length;
    const chocsB = chevauchements(b[nom].boites).length;
    console.log(`\n${nom} — chevauchements ${chocsA} → ${chocsB}, ${ecarts.length} boîte(s) différente(s)`);
    for (const e of ecarts.slice(0, 10)) {
      const detail = e.genre === "deplacee"
        ? `Δx ${e.dx} Δy ${e.dy} Δl ${e.dw} Δh ${e.dh}`
        : e.genre;
      console.log(`   ${detail}  « ${e.t.slice(0, 34)} »  ${e.ou.slice(0, 80)}`);
    }
  }
}

const options = lireOptions(process.argv.slice(2));
if (options.compare) {
  comparer(options.compare[0], options.compare[1]);
} else {
  const releves = await balayer(options);
  if (options.sortie) {
    writeFileSync(options.sortie, JSON.stringify(releves, null, 1));
    console.log(`\nrelevé écrit dans ${options.sortie}`);
  }
}
