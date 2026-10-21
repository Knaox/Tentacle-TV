// Ce que la matrice EXIGE, cellule par cellule — d'après le brief du lot :
// verre natif activé par défaut sur macOS 26, désactivable dans Réglages ›
// Apparence ; option INVISIBLE et aucun verre natif si l'OS ne le supporte pas
// (`TENTACLE_LIQUID_GLASS=off` le simule) ; coupé = rendu d'avant, aucune région
// native ; le HDR du lecteur jamais cassé. Chaque échec devient un défaut candidat.

const find = (report, name) => report.steps.find((s) => s.name === name);
// `nativeViews` : les NSGlassEffectView réellement présentes, comptées dans AppKit
// par le socle (lg-natif) — pas ce que le gestionnaire croit.
const viewsOf = (stepEntry) => (stepEntry?.native?.exposed ? stepEntry.native.nativeViews ?? 0 : null);
const visibleRegions = (stepEntry) => (stepEntry?.native?.regions ?? []).filter((r) => !r.hidden).length;
const PLAYER_STEPS = ["lecteur-sdr", "lecteur-hdr", "lecteur-episodes"];

/** La sortie de mpv est-elle en PQ ? (`video-target-params` arrive en JSON texte.) */
function pq(params) {
  try {
    const value = typeof params === "string" ? JSON.parse(params) : params;
    return value?.gamma === "pq";
  } catch {
    return false;
  }
}

export function checkCell(cell, report) {
  const issues = [];
  const fail = (message, proof) => issues.push({ message, proof });
  for (const s of report.steps) {
    if (!s.ok) fail(`étape « ${s.name} » en échec : ${s.error}`, s.capture ?? null);
  }
  const home = find(report, "accueil") ?? report.steps.find((s) => s.dom);
  const settings = find(report, "reglages-apparence");
  const bridge = home?.dom?.bridge;
  const toggle = settings?.toggle;

  if (cell.expect === "on") {
    if (!bridge?.present) fail("pont `window.tentacle.liquidGlass` absent sur macOS 26", home?.capture);
    else if (bridge.supported !== true) fail("pont présent mais `supported` faux sur macOS 26", home?.capture);
    if (home?.dom && home.dom.htmlAttr !== "native") fail(`html[data-liquid-glass] = ${home.dom.htmlAttr} (attendu « native »)`, home?.capture);
    if (toggle && !toggle.found) fail("interrupteur Liquid Glass introuvable dans Réglages › Apparence", settings?.capture);
    if (toggle?.found && toggle.checked !== true) fail("interrupteur présent mais pas allumé par défaut", settings?.capture);
    if (home && !home.native?.exposed) fail("relevé natif non exposé (globalThis.__tentacleGlass.snapshot) — régions non vérifiables", null);
    if (home?.native?.exposed && home.native.supported !== true) fail(`natif : supported faux (availability=${home.native.availability})`, home?.capture);
    // Décision du lot : le natif ne voit jamais la page → natif = LECTEUR.
    for (const name of PLAYER_STEPS) {
      const s = find(report, name);
      if (!s?.ok || !s.native?.exposed) continue;
      if (s.native.refractsVideo && visibleRegions(s) === 0) fail(`lecteur sans verre natif visible à « ${name} » (${s.native.nativeViews} vue(s) AppKit)`, s.capture);
    }
  }
  if (cell.expect === "off" || cell.expect === "unsupported") {
    for (const s of report.steps) {
      const n = viewsOf(s);
      if (n !== null && n > 0) fail(`${n} NSGlassEffectView à l'étape « ${s.name} » alors que le verre est ${cell.expect === "off" ? "coupé" : "non supporté"}`, s.capture);
    }
    const want = cell.expect === "off" ? "off" : "refraction";
    if (home?.dom && home.dom.htmlAttr !== want) fail(`html[data-liquid-glass]=${home.dom.htmlAttr} (attendu « ${want} »)`, home?.capture);
  }
  if (cell.expect === "off" && toggle && toggle.found && toggle.checked !== false) {
    fail("après coupure, l'interrupteur ne se relit pas « coupé »", settings?.capture);
  }
  if (cell.expect === "unsupported") {
    if (bridge?.present && bridge.supported === true) fail("`supported` vrai malgré TENTACLE_LIQUID_GLASS=off", home?.capture);
    if (toggle?.found) fail("option Liquid Glass VISIBLE alors que le verre natif n'est pas supporté", settings?.capture);
  }
  const hdrStep = find(report, "lecteur-hdr");
  const edr = hdrStep?.edr ?? find(report, "lecteur-hdr-plein-ecran")?.probe?.edr ?? null;
  const hdrScreen = !edr || edr.potential > 1;
  if (hdrStep?.ok && !hdrScreen) report.notes = [...(report.notes ?? []), "HDR non vérifiable : l'écran n'offre aucune marge EDR (potential = 1)"];
  for (const name of hdrScreen ? ["lecteur-hdr", "lecteur-hdr-plein-ecran", "lecteur-hdr-pip"] : []) {
    const s = find(report, name);
    if (!s?.ok) continue;
    const target = s.mpv?.["video-target-params"] ?? s["video-target-params"];
    if (!pq(target)) fail(`HDR perdu à l'étape « ${name} » : video-target-params sans PQ`, s.capture ?? null);
  }
  const pipStep = find(report, "lecteur-hdr-pip");
  if (hdrScreen && pipStep?.ok && pipStep.afterBack && !pq(pipStep.afterBack["video-target-params"])) {
    fail("HDR perdu après le retour du PiP au lecteur", pipStep.capture);
  }
  if (pipStep?.ok && pipStep.back && !pipStep.back.clicked) fail("bouton « Revenir au lecteur » du PiP introuvable", pipStep.capture);
  const sdr = find(report, "lecteur-sdr");
  if (sdr?.ok && pq(sdr.mpv?.["video-target-params"])) fail("SDR sorti en PQ (à vérifier : écran laissé en HDR ?)", sdr.capture);
  return issues;
}
