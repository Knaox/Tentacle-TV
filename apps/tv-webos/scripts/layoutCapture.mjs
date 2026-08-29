/**
 * Relevé de mise en page : ce que la dalle DESSINE, pas ce que la feuille DIT.
 *
 * La garde de compatibilité (`config/postcss/compatGuard.ts`) vérifie la
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
 *   node apps/tv-webos/scripts/layoutCapture.mjs --appareil tv \
 *        --bibliotheque <id> --item <id> --sortie logs/mise-en-page-avant.json
 *
 *   node apps/tv-webos/scripts/layoutCapture.mjs --compare \
 *        logs/mise-en-page-avant.json logs/mise-en-page-apres.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { openInspector, findTarget, connectSession } from "./capture/cdpInspector.mjs";
import { LAYOUT_PROBE, defaultRoutes } from "./capture/layoutProbe.mjs";
import { overlaps, divergences, summarize } from "./capture/compareBoxes.mjs";

/** Le temps laissé à un écran pour se peindre, images comprises. */
const SCREEN_DELAY_MS = 15_000;

function readOptions(argv) {
  const o = { device: "tv", application: "com.tentacletv.webos" };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--compare") return { compare: [argv[i + 1], argv[i + 2]] };
    if (!key.startsWith("--")) continue;
    o[key.slice(2)] = argv[i + 1];
  }
  return o;
}

async function sample(session, expression) {
  const response = await session.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? "sonde en échec");
  }
  return response.result?.value;
}

async function sweep(options) {
  const inspector = await openInspector(options);
  try {
    const target = await findTarget(inspector.url);
    let session = await connectSession(target.webSocketDebuggerUrl);
    await session.send("Runtime.enable", {});

    const captures = {};
    for (const route of defaultRoutes(options)) {
      await sample(session, `location.href = ${JSON.stringify(route.path)}`);
      await new Promise((r) => setTimeout(r, SCREEN_DELAY_MS));
      // Une navigation de premier niveau tue le contexte d'exécution : la
      // session se rebranche sur la cible, qui a gardé son identifiant.
      session.close?.();
      session = await connectSession((await findTarget(inspector.url)).webSocketDebuggerUrl);
      await session.send("Runtime.enable", {});

      const capture = await sample(session, LAYOUT_PROBE);
      captures[route.nom] = capture;
      console.log(summarize(route.nom, capture, overlaps(capture.boxes)));
    }
    session.close?.();
    return captures;
  } finally {
    inspector.stopIt();
  }
}

function compare(pathA, pathB) {
  const a = JSON.parse(readFileSync(pathA, "utf8"));
  const b = JSON.parse(readFileSync(pathB, "utf8"));
  for (const nom of Object.keys(a)) {
    if (!b[nom]) {
      console.log(`${nom} — absent du second relevé`);
      continue;
    }
    const gaps = divergences(a[nom].boxes, b[nom].boxes);
    const clashesA = overlaps(a[nom].boxes).length;
    const clashesB = overlaps(b[nom].boxes).length;
    console.log(`\n${nom} — chevauchements ${clashesA} → ${clashesB}, ${gaps.length} boîte(s) différente(s)`);
    for (const e of gaps.slice(0, 10)) {
      const detail = e.genre === "deplacee"
        ? `Δx ${e.dx} Δy ${e.dy} Δl ${e.dw} Δh ${e.dh}`
        : e.genre;
      console.log(`   ${detail}  « ${e.t.slice(0, 34)} »  ${e.ou.slice(0, 80)}`);
    }
  }
}

const options = readOptions(process.argv.slice(2));
if (options.compare) {
  compare(options.compare[0], options.compare[1]);
} else {
  const captures = await sweep(options);
  if (options.sortie) {
    writeFileSync(options.sortie, JSON.stringify(captures, null, 1));
    console.log(`\nrelevé écrit dans ${options.sortie}`);
  }
}
