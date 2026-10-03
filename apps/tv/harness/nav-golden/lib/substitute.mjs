// Les adresses PROPRES À UNE PLACE, jamais écrites en dur dans un scénario : un
// geste `type:http://{backend}` vise le faux backend de la place qui joue —
// `localhost:310n` au simulateur, `<IP du Mac>:310n` sur l'Apple TV (là-bas,
// localhost désigne la télévision elle-même). Vécu au passage final de T8 :
// `http://localhost:3107` en dur ne passait que sur la place 7.
//
// À l'aller, le geste est résolu AVANT la frappe ; au retour, une adresse de la
// place qui paraît dans un relevé (libellé, texte, stockage) y est ramenée à
// son nom (`{backend}`), pour qu'une référence ne dépende pas de la place.

/** Les noms qu'un scénario peut employer, et ce qu'ils deviennent sur cette place. */
export const PLACEHOLDERS = ["backend"];

/** `{ backend: "hôte:port" }` pour la place `ports` (au simulateur, ou sur l'appareil à l'IP `macIp`). */
export function substitutionsFor({ ports, device = false, macIp = null }) {
  return { backend: `${device ? macIp : "localhost"}:${ports.backend}` };
}

/** Les noms inconnus d'un geste (`{toto}`) — `check` les refuse avant tout lancement. */
export function unknownPlaceholders(text) {
  return [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((name) => !PLACEHOLDERS.includes(name));
}

/** Le geste tel qu'il part : chaque `{nom}` remplacé par sa valeur sur cette place. */
export function resolveGesture(gesture, subs) {
  return String(gesture).replace(/\{(\w+)\}/g, (whole, name) => subs[name] ?? whole);
}

/** Une chaîne d'un relevé, ses adresses de place ramenées à leur nom. */
function normalizeString(text, pairs) {
  let out = text;
  for (const [value, name] of pairs) out = out.split(value).join(`{${name}}`);
  return out;
}

/**
 * Le relevé ramené aux noms : toute chaîne (à toute profondeur) qui contient
 * une valeur de place la voit remplacée par `{nom}`. Les valeurs les plus
 * longues d'abord, pour qu'aucune ne soit coupée par une plus courte.
 */
export function normalizeObservation(value, subs) {
  const pairs = Object.entries(subs).map(([name, v]) => [v, name]).filter(([v]) => v).sort((a, b) => b[0].length - a[0].length);
  const walk = (v) => {
    if (typeof v === "string") return normalizeString(v, pairs);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, inner]) => [k, walk(inner)]));
    return v;
  };
  return walk(value);
}
