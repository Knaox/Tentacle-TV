// Les suites du banc de fluidité (`perf.mjs`) : chacune démarre à froid sur
// les données figées du banc, aperçus simulés par le kit local (`focus/apercus`,
// flux HLS du port 3089 — aucune extraction YouTube), joue ses gestes et rend
// les relevés bruts de la sonde ; `analyze.mjs` en tire les chiffres.
const FILMS = { name: "Library", params: { libraryId: "db4c1708cbb5dd1676284a40f2950aba", libraryName: "Films" } };
const HOME_START = { fixtures: ["focus/home", "focus/apercus"], route: { name: "Home" }, keys: ["wait:1", "left", "right"] };
const GRID_START = { fixtures: ["base/vigie-off", "ecrans/grande-bibliotheque", "focus/apercus"], route: FILMS, keys: ["wait:6"] };
const times = (key, n) => Array.from({ length: n }, () => key);

/** Démarre et vérifie la clé focalisée (une approche ratée ne se mesure pas). */
async function startAt(h, start, approach, expectPrefix) {
  await h.start(start);
  if (approach.length) await h.keys(approach);
  await h.sleep(1500);
  const obs = await h.obs();
  if (!String(obs.focus ?? "").startsWith(expectPrefix)) throw new Error(`approche ratée : focus ${obs.focus}, attendu ${expectPrefix}…`);
  return obs;
}

/** Une rafale mesurée : les gestes d'un seul envoi à l'agent (cadence de la télécommande pressée). */
async function burst(h, label, keys, settleMs = 1200) {
  await h.arm("fps");
  const t0 = Date.now();
  await h.keys(keys);
  const sentMs = Date.now() - t0;
  await h.sleep(settleMs);
  const report = await h.disarm();
  const obs = await h.obs();
  return { label, keys: keys.length, sentMs, endFocus: obs.focus, report };
}

export const suites = {
  async "rafale-accueil"(h) {
    await startAt(h, HOME_START, ["down"], "resume:");
    const out = [];
    out.push(await burst(h, "rangée DROITE ×10", times("right", 10)));
    out.push(await burst(h, "rangée GAUCHE ×10", times("left", 10)));
    out.push(await burst(h, "rangées BAS ×4", times("down", 4)));
    out.push(await burst(h, "rangées HAUT ×4", times("up", 4)));
    return { bursts: out };
  },

  async "rafale-grille"(h) {
    await startAt(h, GRID_START, [], "grid:");
    const out = [];
    out.push(await burst(h, "1re ligne DROITE ×9 (jusqu'à la dernière colonne)", times("right", 9)));
    out.push(await burst(h, "1re ligne GAUCHE ×9", times("left", 9)));
    out.push(await burst(h, "BAS ×6 (1re colonne)", times("down", 6)));
    out.push(await burst(h, "HAUT ×6", times("up", 6)));
    await h.keys(["right", "right", "right"]);
    await h.sleep(800);
    out.push(await burst(h, "BAS ×6 (colonne du milieu)", times("down", 6)));
    out.push(await burst(h, "HAUT ×6 (colonne du milieu)", times("up", 6)));
    return { bursts: out };
  },

  async latence(h) {
    const dwells = [];
    const dwell = async (label, keys, watch, holdMs = 4000) => {
      await h.arm("trace", watch);
      const t0 = Date.now();
      if (keys.length) await h.keys(keys);
      await h.sleep(holdMs);
      const report = await h.disarm();
      const obs = await h.obs();
      dwells.push({ label, keys, sentAt: t0, endFocus: obs.focus, report });
    };
    // Accueil : quatre cartes de suite dans « Reprendre », chacune tenue.
    await startAt(h, HOME_START, ["down"], "resume:");
    for (let i = 1; i <= 4; i++) await dwell(`accueil, carte ${i + 1}`, ["right"], "resume:");
    await dwell("accueil, rangée du dessous", ["down"], "");
    // Grille : 1re, milieu, dernière colonne, puis la ligne du dessous.
    await startAt(h, GRID_START, [], "grid:");
    await dwell("grille, 2e colonne", ["right"], "grid:");
    await dwell("grille, colonne du milieu", ["right", "right"], "grid:");
    await dwell("grille, dernière colonne", times("right", 6), "grid:");
    await dwell("grille, ligne du dessous (dernière colonne)", ["down"], "grid:");
    await dwell("grille, 1re colonne (retour)", times("left", 8), "grid:");
    return { dwells };
  },

  async lecteur(h) {
    await startAt(h, HOME_START, ["down"], "resume:");
    await h.sleep(3000);
    const before = await h.mounted("Video");
    await h.arm("fps");
    const steps = [];
    for (let i = 0; i < 6; i++) {
      await h.keys(["right"]);
      await h.sleep(2600);
      steps.push({ i, mounted: await h.mounted("Video") });
    }
    await h.keys(times("right", 4));
    await h.sleep(2600);
    const report = await h.disarm();
    const after = await h.mounted("Video");
    return { before, steps, after, report };
  },

  async memoire(h, options) {
    const minutes = Number(options.minutes ?? 5);
    await startAt(h, HOME_START, ["down"], "resume:");
    const samples = [];
    const sample = async (phase) => samples.push({ t: Date.now(), phase, rss: h.rss(), heap: await h.heap(), load: h.load() });
    await sample("début");
    const end = Date.now() + minutes * 60_000;
    let cycle = 0;
    let lastSample = Date.now();
    while (Date.now() < end) {
      cycle += 1;
      // Un tour : la rangée vers la droite, carte par carte (aperçus lancés), retour d'un coup, une rangée plus bas puis remontée.
      for (let i = 0; i < 6; i++) {
        await h.keys(["right"]);
        await h.sleep(1300);
      }
      await h.keys(times("left", 6));
      await h.keys(["down", "down"]);
      await h.sleep(1500);
      await h.keys(["right", "right", "right"]);
      await h.sleep(1500);
      await h.keys(["left", "left", "left", "up", "up"]);
      await h.sleep(800);
      if (Date.now() - lastSample >= 15_000) {
        await sample(`tour ${cycle}`);
        lastSample = Date.now();
      }
    }
    await h.sleep(3000);
    await sample("fin");
    return { minutes, cycles: cycle, samples };
  },
};
