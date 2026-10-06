// La GARDE des touches du banc — obligatoire, sur tout appareil.
//
// Incident du 07/10 : un banc a envoyé ses touches alors que l'app de mesure
// n'était plus au premier plan ; elles sont parties vers le lanceur, ont
// ouvert les Paramètres SYSTÈME, et la Shield a redémarré. D'où, à chaque
// séquence :
//
// - l'app mesurée est l'app de MESURE (`…perf`) ; jamais celle de
//   l'utilisateur (`com.tentacletv.mobile`), sur aucun appareil ;
// - la séquence est COUPÉE à chaque OK et à chaque Retour (ce qui change
//   d'écran, ou sort de l'app) ; avant chaque tronçon, `dumpsys activity
//   activities` doit montrer l'app au premier plan, sinon arrêt NET, sans
//   touche ;
// - l'injecteur (`keys/Keys.java`, `expect=<paquet>`) relit le premier plan
//   avant CHAQUE appui, et s'arrête de même ;
// - les touches système (Accueil, Marche, Menu, Paramètres, Veille, Applis
//   récentes) sont refusées d'office.
//
// Fonctions pures, testées hors appareil (`test/lite.test.mjs`).

export const USER_PACKAGE = "com.tentacletv.mobile";

/** KEYCODE_HOME, POWER, MENU, SETTINGS, SLEEP, APP_SWITCH : jamais envoyées. */
export const FORBIDDEN_KEYCODES = new Set([3, 26, 82, 176, 223, 187]);
const OK = 23;
const BACK = 4;

/** L'erreur de la garde : elle ne se rattrape pas (ni échauffement, ni passe rejouée). */
export class ForegroundError extends Error {
  constructor(message) {
    super(message);
    this.name = "ForegroundError";
  }
}

/** Le code d'un pas (`tap:23`, `tap:22x6@500`, `hold:20:3000`), ou null pour `wait`. */
export function keycodeOf(step) {
  const m = String(step).match(/^(?:tap|hold):(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Refuse l'app de l'utilisateur et toute touche système. */
export function assertAllowed(pkg, steps) {
  if (pkg === USER_PACKAGE) {
    throw new ForegroundError(`le banc ne joue jamais sur ${USER_PACKAGE} (l'app de l'utilisateur) : app de mesure ${USER_PACKAGE}.perf seulement (-PtentaclePerfApp=1)`);
  }
  for (const step of steps) {
    if (!/^(tap|hold|wait):/.test(String(step))) throw new ForegroundError(`pas illisible : ${step}`);
    const code = keycodeOf(step);
    if (code !== null && FORBIDDEN_KEYCODES.has(code)) throw new ForegroundError(`touche système refusée : ${step}`);
  }
}

/**
 * Les tronçons d'une séquence : coupée APRÈS chaque pas qui porte un OK ou un
 * Retour (le premier plan peut changer derrière lui).
 */
export function splitAtChecks(steps) {
  const chunks = [];
  let current = [];
  for (const step of steps) {
    current.push(step);
    const code = keycodeOf(step);
    if (code === OK || code === BACK) {
      chunks.push(current);
      current = [];
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/**
 * L'app au premier plan d'après `dumpsys activity activities` : l'activité
 * reprise du système (`topResumedActivity=` sur Android 14, `ResumedActivity:`
 * sur Android 12, sinon le premier `mResumedActivity:` — Android 9 à 11), qui
 * doit être aussi l'app qui a le focus (`mFocusedApp`) quand il se lit. `null`
 * si rien ne se lit ou si les deux divergent — ce qui vaut un refus.
 */
export function resumedPackage(dumpsys) {
  const lines = dumpsys.split("\n");
  const pick = (prefix) => {
    for (const line of lines) {
      const m = line.match(new RegExp(`^\\s*${prefix}ActivityRecord\\{\\S+ \\S+ ([\\w.]+)/`));
      if (m) return m[1];
    }
    return null;
  };
  const top = pick("topResumedActivity=") ?? pick("ResumedActivity: ") ?? pick("mResumedActivity: ");
  const focused = pick("mFocusedApp=");
  if (focused && top && focused !== top) return null;
  return top;
}

/** Refuse si `pkg` n'est pas au premier plan. */
export function assertForeground(pkg, dumpsys) {
  const top = resumedPackage(dumpsys);
  if (top !== pkg) throw new ForegroundError(`premier plan = ${top ?? "illisible"}, attendu ${pkg} — arrêt net, aucune touche envoyée`);
}
