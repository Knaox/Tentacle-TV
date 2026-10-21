// Ce que la matrice EXIGE, cellule par cellule — d'après le brief du lot :
// verre natif activé par défaut sur macOS 26, désactivable dans Réglages ›
// Apparence ; option INVISIBLE et aucun verre natif si l'OS ne le supporte pas
// (`TENTACLE_LIQUID_GLASS=off` le simule) ; coupé = rendu d'avant, aucune région
// native ; le HDR du lecteur jamais cassé. Chaque échec devient un défaut candidat.

const find = (report, name) => report.steps.find((s) => s.name === name);
const regionsOf = (stepEntry) => stepEntry?.native?.regions?.length ?? null;
const visibleRegions = (stepEntry) => (stepEntry?.native?.regions ?? []).filter((r) => !r.hidden).length;

function pq(params) {
  const text = typeof params === "string" ? params : JSON.stringify(params ?? "");
  return /"gamma":"pq"|pq/.test(text);
}

export function checkCell(cell, report) {
  const issues = [];
  const fail = (message, proof) => issues.push({ message, proof });
  for (const s of report.steps) {
    if (!s.ok) fail(`étape « ${s.name} » en échec : ${s.error}`, s.capture ?? null);
  }
  const home = find(report, "accueil");
  const settings = find(report, "reglages-apparence");
  const bridge = home?.dom?.bridge;
  const toggle = settings?.toggle;

  if (cell.expect === "on") {
    if (!bridge?.present) fail("pont `window.tentacle.liquidGlass` absent sur macOS 26", home?.capture);
    else if (bridge.supported !== true) fail("pont présent mais `supported` faux sur macOS 26", home?.capture);
    if (home?.dom && home.dom.htmlAttr !== "native") fail(`html[data-liquid-glass] = ${home.dom.htmlAttr} (attendu « native »)`, home?.capture);
    if (toggle && !toggle.found) fail("interrupteur Liquid Glass introuvable dans Réglages › Apparence", settings?.capture);
    if (toggle?.found && toggle.checked !== true) fail("interrupteur présent mais pas allumé par défaut", settings?.capture);
    if (home?.native?.exposed && visibleRegions(home) === 0) fail("aucune région native visible sur l'accueil", home?.capture);
    if (home && !home.native?.exposed) fail("relevé natif non exposé (globalThis.__tentacleGlass.snapshot) — régions non vérifiables", null);
  }
  if (cell.expect === "off" || cell.expect === "unsupported") {
    for (const s of report.steps) {
      const n = regionsOf(s);
      if (n !== null && n > 0) fail(`${n} région(s) native(s) à l'étape « ${s.name} » alors que le verre est ${cell.expect === "off" ? "coupé" : "non supporté"}`, s.capture);
    }
    if (home?.dom && home.dom.htmlAttr === "native") fail("html[data-liquid-glass]=native alors que le verre natif est inactif", home?.capture);
  }
  if (cell.expect === "off" && toggle && toggle.found && toggle.checked !== false) {
    fail("après coupure, l'interrupteur ne se relit pas « coupé »", settings?.capture);
  }
  if (cell.expect === "unsupported") {
    if (bridge?.present && bridge.supported === true) fail("`supported` vrai malgré TENTACLE_LIQUID_GLASS=off", home?.capture);
    if (toggle?.found) fail("option Liquid Glass VISIBLE alors que le verre natif n'est pas supporté", settings?.capture);
  }
  for (const name of ["lecteur-hdr", "lecteur-hdr-plein-ecran", "lecteur-hdr-pip"]) {
    const s = find(report, name);
    if (!s?.ok) continue;
    const target = s.mpv?.["video-target-params"] ?? s["video-target-params"];
    if (!pq(target)) fail(`HDR perdu à l'étape « ${name} » : video-target-params sans PQ`, s.capture ?? null);
  }
  const sdr = find(report, "lecteur-sdr");
  if (sdr?.ok && pq(sdr.mpv?.["video-target-params"])) fail("SDR sorti en PQ (à vérifier : écran laissé en HDR ?)", sdr.capture);
  return issues;
}
