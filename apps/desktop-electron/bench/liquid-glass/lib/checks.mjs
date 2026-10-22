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
    for (const t of s.dom?.trappedModals ?? []) {
      fail(`« ${s.name} » : modale « ${t.modal} » confinée sous « ${t.ancestor} » (backdrop ${t.backdrop}, transform ${t.transform})`, s.capture ?? null);
    }
  }
  const home = find(report, "accueil") ?? report.steps.find((s) => s.dom);
  const settings = find(report, "reglages-apparence");
  const bridge = home?.dom?.bridge;
  const toggle = settings?.toggle;

  if (cell.expect === "on") {
    if (home && !bridge?.present) fail("pont `window.tentacle.liquidGlass` absent sur macOS 26", home?.capture);
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
  if (cell.expect === "on") chromeOn(report, fail);
  if (cell.a11y && home?.dom && !home.dom.attrs?.["data-lg-material"]) {
    fail(`${cell.a11y} émulé : html[data-lg-material] absent (verre givré/opaque attendu)`, home.capture);
  }
  if (cell.expect === "off" || cell.expect === "unsupported") {
    for (const s of report.steps.filter((x) => x.dom)) {
      if (s.dom.edge > 0 || s.dom.surfaces > 0) fail(`« ${s.name} » : ${s.dom.edge} .lgc-edge / ${s.dom.surfaces} .lg-surface alors que le verre est inactif`, s.capture);
    }
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
  for (const m of report.steps.filter((x) => x.ok && x.name.startsWith("menu-"))) {
    for (const o of m.open ?? []) if (!o.inside) fail(`« ${m.name} » : menu qui déborde de la fenêtre (${o.w}×${o.h}, ${o.cls})`, m.capture);
  }
  const wn = find(report, "nouveautes-1-40-0");
  if (wn?.ok && cell.expect === "on" && (!wn.traits?.liquidGlass || wn.shown === false)) fail(`nouveautés 1.40.0 : traits ${JSON.stringify(wn.traits)}, scène « Liquid Glass » ${wn.shown ? "vue" : "absente"}`, wn.capture);
  if (wn?.ok && cell.expect === "unsupported" && (wn.traits?.liquidGlass || wn.traits?.liquidGlassPlayer)) fail(`nouveautés 1.40.0 : trait du verre présent sans verre natif (${JSON.stringify(wn.traits)})`, null);
  for (const sc of [wn?.scene1, wn?.scene2]) {
    if (sc?.overflow?.length) fail(`nouveautés 1.40.0 : ${sc.overflow.length} surface(s) de verre débordent de la scène (${sc.overflow[0]})`, wn.capture);
  }
  const neige = find(report, "lecteur-neige");
  if (neige?.ok && neige.medianLum !== null && neige.medianLum > 0.5) fail(`lecteur sur vidéo presque blanche : glyphes CLAIRS (luminance médiane ${neige.medianLum}) — le ton ne bascule pas en sombre`, neige.capture);
  const pipStep = find(report, "lecteur-hdr-pip");
  if (hdrScreen && pipStep?.ok && pipStep.afterBack && !pq(pipStep.afterBack["video-target-params"])) {
    fail("HDR perdu après le retour du PiP au lecteur", pipStep.capture);
  }
  if (pipStep?.ok && pipStep.back && !pipStep.back.clicked) fail("bouton « Revenir au lecteur » du PiP introuvable", pipStep.capture);
  const sdr = find(report, "lecteur-sdr");
  if (sdr?.ok && pq(sdr.mpv?.["video-target-params"])) fail("SDR sorti en PQ (à vérifier : écran laissé en HDR ?)", sdr.capture);
  return issues;
}

const transparent = (color) => color === "transparent" || /rgba\([^)]*,\s*0\)$/.test(color ?? "");

/** Le chrome de fenêtre (lg-chrome, vérifications a–e de sa demande). */
function chromeOn(report, fail) {
  const top = find(report, "accueil");
  const scrolled = find(report, "accueil-defile-300");
  if (top?.dom && top.dom.edge > 0) fail("haut de page : .lgc-edge présent (attendu absent)", top.capture);
  if (scrolled?.dom) {
    if (scrolled.dom.edge === 0) fail("accueil défilé de 300 px : aucun .lgc-edge", scrolled.capture);
    if (scrolled.dom.bandeau !== null && !transparent(scrolled.dom.bandeau)) fail(`accueil défilé : bandeau des feux non transparent (${scrolled.dom.bandeau})`, scrolled.capture);
  }
  if (top?.dom && !(top.dom.capsuleLenses > 0)) fail(`barre du haut : aucune .lg-surface en lentille dans .lgc-capsule (${top.dom.capsuleLenses})`, top?.capture);
  for (const name of ["reglages-apparence", "admin-admin"]) {
    const s = find(report, name);
    if (s?.dom && !s.dom.sidebar?.selection) fail(`« ${name} » : nav.lgc-sidebar ou sa sélection absente (${JSON.stringify(s.dom.sidebar)})`, s.capture);
  }
  for (const name of ["lecteur-sdr", "lecteur-hdr"]) {
    const s = find(report, name);
    if (!s?.ok || !s.dom) continue;
    if (s.dom.attrs?.["data-native-playback"] === null) fail(`« ${name} » : html[data-native-playback] absent pendant la lecture`, s.capture);
    if (s.dom.bandeau !== null && transparent(s.dom.bandeau)) fail(`« ${name} » : bandeau des feux transparent pendant la lecture (coins de mpv visibles)`, s.capture);
  }
  for (const s of report.steps.filter((x) => x.ok && /^lecteur-.*-masque$/.test(x.name))) {
    if (s.visibleRegions > 0) fail(`« ${s.name} » : ${s.visibleRegions} région(s) native(s) visibles contrôles masqués`, s.capture);
  }
  for (const s of report.steps.filter((x) => x.ok && /^lecteur-.*-redimension$/.test(x.name))) {
    if (!s.visibleRegions) fail(`« ${s.name} » : aucune région native visible après redimensionnement`, s.capture);
    else if (s.maxDrift > 2) fail(`« ${s.name} » : vue AppKit décalée de ${s.maxDrift} pt de sa région après redimensionnement`, s.capture);
  }
  // data-window-inactive jugé contre le principal (isFocused) : défaut seulement s'ils divergent.
  for (const st of report.steps.filter((x) => x.dom?.attrs && typeof x.focused === "boolean")) {
    const inactive = st.dom.attrs["data-window-inactive"] !== null;
    if (inactive === st.focused) fail(`« ${st.name} » : data-window-inactive=${st.dom.attrs["data-window-inactive"]} alors que le principal dit focused=${st.focused}`, st.capture);
  }
  for (const s of report.steps.filter((x) => x.ok && /^lecteur-.*-coupure$/.test(x.name) && !x.absent)) {
    if (s.offViews > 0) fail(`« ${s.name} » : ${s.offViews} vue(s) AppKit après coupure en pleine lecture`, s.capture);
    // Le rallumage par le PONT ne prévient pas la page : elle ne renvoie pas ses
    // régions. Une note, pas un défaut (le vrai interrupteur est éprouvé par « coupe »).
    if (!s.onViews && s.via === "page") fail(`« ${s.name} » : le verre ne revient pas au rallumage du réglage (${s.onViews} vue)`, s.onCapture);
    else if (!s.onViews) report.notes = [...(report.notes ?? []), `« ${s.name} » : rallumage par le pont sans régions (la page n'est pas prévenue)`];
  }
  const fs = find(report, "lecteur-hdr-plein-ecran");
  if (fs?.ok && !fs.skipped && fs.duringVisible === 0) fail("plein écran : aucune région native visible contrôles affichés", null);
  const gTop = find(report, "gpu-repos-accueil")?.gpu?.mean;
  const gScroll = find(report, "gpu-repos-defile")?.gpu?.mean;
  if (Number.isFinite(gTop) && Number.isFinite(gScroll)) {
    report.notes = [...(report.notes ?? []), `GPU au repos (ioreg, machine entière) : haut ${gTop} %, défilée ${gScroll} %`];
  }
}
