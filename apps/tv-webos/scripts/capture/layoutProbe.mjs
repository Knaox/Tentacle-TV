/**
 * La sonde injectée dans la page pour relever ses boîtes de texte.
 *
 * Écrite en ES5 dans une chaîne, comme `pageProbe.mjs` et pour la même raison :
 * elle est évaluée par `Runtime.evaluate` dans un moteur qui peut être celui de
 * webOS 4. Elle ne fait que MESURER — l'analyse vit dans `compareBoxes.mjs`,
 * qui est pur et testé au bureau.
 *
 * Ce qu'elle relève, et pourquoi seulement cela : les éléments qui portent un
 * nœud de texte PROPRE. Ce sont eux qu'on voit se chevaucher ; leurs ancêtres
 * ne font que les contenir, et les compter noierait le signal.
 */
export const LAYOUT_PROBE = `(function () {
  var MARQUE = "__tntIndex";

  function texteEnPropre(e) {
    for (var i = 0; i < e.childNodes.length; i++) {
      var n = e.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim().length > 0) return true;
    }
    return false;
  }

  function visible(e, r) {
    if (r.width < 2 || r.height < 2) return false;
    var s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none") return false;
    if (parseFloat(s.opacity) < 0.05) return false;
    return true;
  }

  function chemin(e) {
    var p = [], n = e, garde = 0;
    while (n && n.nodeType === 1 && garde++ < 4) {
      var brut = (typeof n.className === "string" ? n.className : "").trim();
      var c = brut ? "." + brut.split(/\\s+/).slice(0, 3).join(".") : "";
      p.unshift(n.tagName.toLowerCase() + c);
      n = n.parentElement;
    }
    return p.join(" > ").slice(0, 190);
  }

  /** Le plus proche ancêtre lui aussi relevé — la clé de l'exclusion d'imbrication. */
  function parentReleve(e) {
    var n = e.parentElement;
    while (n) {
      if (n[MARQUE] !== undefined) return n[MARQUE];
      n = n.parentElement;
    }
    return null;
  }

  var boites = [];
  var tous = document.querySelectorAll("body *");
  for (var i = 0; i < tous.length; i++) {
    var e = tous[i];
    if (e[MARQUE] !== undefined) delete e[MARQUE];
    if (!texteEnPropre(e)) continue;
    var r = e.getBoundingClientRect();
    if (!visible(e, r)) continue;
    var s = getComputedStyle(e);
    e[MARQUE] = boites.length;
    boites.push({
      i: boites.length,
      parent: parentReleve(e),
      t: (e.textContent || "").trim().slice(0, 44),
      x: Math.round(r.left),
      y: Math.round(r.top + window.pageYOffset),
      w: Math.round(r.width),
      h: Math.round(r.height),
      px: s.fontSize,
      lh: s.lineHeight,
      ou: chemin(e),
    });
  }
  for (var k = 0; k < tous.length; k++) if (tous[k][MARQUE] !== undefined) delete tous[k][MARQUE];

  return {
    route: location.pathname,
    largeur: window.innerWidth,
    hauteurDocument: document.documentElement.scrollHeight,
    boites: boites,
  };
})()`;

/**
 * Les routes balayées par défaut.
 *
 * Les identifiants sont passés en ligne de commande : une médiathèque n'a pas
 * les mêmes que l'autre, et un chemin en dur ne mesurerait rien chez personne
 * d'autre.
 */
export function defaultRoutes({ library, item }) {
  const routes = [{ path: "/tv/", nom: "Accueil" }, { path: "/tv/settings", nom: "Réglages" }];
  if (library) routes.push({ path: `/tv/library/${library}`, nom: "Bibliothèque" });
  if (item) routes.push({ path: `/tv/media/${item}`, nom: "Fiche" });
  return routes;
}
