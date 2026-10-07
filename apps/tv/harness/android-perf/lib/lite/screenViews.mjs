// Les vues de la page AFFICHÉE, sans la pile recouverte : `gfxinfo` compte
// toutes les vues attachées de toutes les fenêtres — l'accueil et la
// bibliothèque gardés sous la fiche compris. Ici, le sous-arbre du `Screen`
// (react-native-screens) du dessus, lu dans `dumpsys activity top`.

const NODE = /\{[0-9a-f]+ [VIG]/;
const indentOf = (line) => line.length - line.trimStart().length;

/**
 * Le nombre de vues sous le `Screen` du dessus de la pile principale (le
 * dernier des écrans les moins profonds), `null` sans écran. Pur : le texte
 * de `dumpsys activity top`, réduit à l'activité de `pkg`.
 */
export function topScreenViews(dump, pkg) {
  const lines = dump.split("\n");
  const start = lines.findLastIndex((line) => line.includes(`ACTIVITY ${pkg}/`));
  if (start < 0) return null;
  const own = lines.slice(start);
  const screens = own.flatMap((line, i) => (line.includes("rnscreens.Screen{") ? [{ i, depth: indentOf(line) }] : []));
  if (!screens.length) return null;
  const shallowest = Math.min(...screens.map((s) => s.depth));
  const top = screens.filter((s) => s.depth === shallowest).at(-1);
  let views = 0;
  for (const line of own.slice(top.i + 1)) {
    if (!line.trim() || indentOf(line) <= top.depth) break;
    if (NODE.test(line)) views++;
  }
  return views;
}

/** Les vues attachées (gfxinfo, toutes fenêtres) et celles de la page affichée. */
export function attachedNow(device, pkg) {
  return { ...device.viewHierarchy(), screen: topScreenViews(device.adb(["shell", "dumpsys", "activity", "top"]), pkg) };
}
