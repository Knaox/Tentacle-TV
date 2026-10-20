/**
 * Piloter un téléphone du banc par Hermes (CDP de Metro), en une commande :
 * lire les textes affichés, toucher un élément par son texte ou son testID
 * (le `onPress` du composant, comme un doigt), naviguer, évaluer.
 *
 *   tsx wt-bench/phones/drive.ts <appareil> texts | labels
 *   tsx wt-bench/phones/drive.ts <appareil> press "<texte>" [n] | press-exact "<texte>" [n] | press-id <testID> | press-label "<accessibilityLabel>" [n]
 *   tsx wt-bench/phones/drive.ts <appareil> nav /watch/<id>
 *   tsx wt-bench/phones/drive.ts <appareil> eval "<expression avec return>"
 *
 * <appareil> : un morceau du nom de la cible Hermes (« iPhone », « sdk_gphone »).
 */

import { HermesSession } from "../clients/hermes";

const METRO_PORT = Number(process.env.WT_METRO_PORT ?? 8731);

const WALK =
  "var hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__; var out = [];"
  + " hook.renderers.forEach(function(_, rid){ hook.getFiberRoots(rid).forEach(function(root){"
  + "   var stack = [root.current]; while (stack.length) { var f = stack.pop(); VISIT"
  + "     if (f.sibling) stack.push(f.sibling); if (f.child) stack.push(f.child); } }); });";

/** Les textes rendus (nœuds `Text` à enfant chaîne), dans l'ordre de l'arbre. */
export function textsExpr(): string {
  return WALK.replace("VISIT",
    "var c = f.memoizedProps && f.memoizedProps.children; if (f.elementType === 'RCTText' || (f.type && f.type.displayName === 'Text')) {"
    + " if (typeof c === 'string') out.push(c); else if (Array.isArray(c)) { var s = c.filter(function(x){ return typeof x === 'string' || typeof x === 'number'; }).join(''); if (s) out.push(s); } }")
    + " return out.filter(function(v, i, a){ return a.indexOf(v) === i; }).slice(0, 200);";
}

/** Les cibles touchables nommées (accessibilityLabel), pour trouver un bouton à icône. */
export function labelsExpr(): string {
  return WALK.replace("VISIT", "var p = f.memoizedProps; if (p && typeof p.onPress === 'function' && p.accessibilityLabel) out.push(p.accessibilityLabel);")
    + " return out.filter(function(v, i, a){ return a.indexOf(v) === i; }).slice(0, 200);";
}

/** Toucher : le premier élément dont le texte CONTIENT `text` (ou le testID), remonté jusqu'à un `onPress`. */
export function pressExpr(what: { text?: string; testID?: string; exact?: boolean; label?: string }, nth = 0): string {
  const text = JSON.stringify(what.text ?? "");
  const pred = what.label
    ? `f.memoizedProps && typeof f.memoizedProps.onPress === "function" && f.memoizedProps.accessibilityLabel === ${JSON.stringify(what.label)}`
    : what.testID
    ? `f.memoizedProps && f.memoizedProps.testID === ${JSON.stringify(what.testID)}`
    : `f.memoizedProps && typeof f.memoizedProps.children === "string" && ${what.exact ? `f.memoizedProps.children === ${text}` : `f.memoizedProps.children.indexOf(${text}) >= 0`}`;
  return WALK.replace("VISIT", `if (${pred}) out.push(f);`)
    + ` var hit = out[${nth}]; if (!hit) return "absent";`
    + " var g = hit; while (g && !(g.memoizedProps && typeof g.memoizedProps.onPress === 'function')) g = g.return;"
    + " if (!g) return 'sans onPress'; g.memoizedProps.onPress({ nativeEvent: {} }); return 'ok';";
}

export function navExpr(path: string): string {
  return "var id = null; __r.getModules().forEach(function(v, k){ if (v && v.verboseName && /expo-router\\/build\\/imperative-api\\.js$/.test(v.verboseName)) id = k; });"
    + ` if (id === null) return "routeur introuvable"; __r(id).router.push(${JSON.stringify(path)}); return "ok";`;
}

async function main(): Promise<void> {
  const [device, cmd, arg, nth] = process.argv.slice(2);
  const h = await HermesSession.connect(METRO_PORT, device);
  try {
    const expr = cmd === "texts" ? textsExpr()
      : cmd === "labels" ? labelsExpr()
      : cmd === "press" ? pressExpr({ text: arg }, Number(nth ?? 0))
        : cmd === "press-exact" ? pressExpr({ text: arg, exact: true }, Number(nth ?? 0))
      : cmd === "press-label" ? pressExpr({ label: arg }, Number(nth ?? 0))
      : cmd === "press-id" ? pressExpr({ testID: arg }, Number(nth ?? 0))
          : cmd === "nav" ? navExpr(arg)
            : cmd === "eval" ? arg
              : null;
    if (!expr) throw new Error(`commande inconnue : ${cmd}`);
    const res = await h.eval<unknown>(expr);
    console.log(typeof res === "string" ? res : JSON.stringify(res, null, cmd === "texts" ? 0 : 2));
  } finally {
    h.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
