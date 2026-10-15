/**
 * L'ORDRE des fenêtres du démarrage, sur le web et le bureau — la règle, pure
 * (`startupOrder.test.ts`). Rien ne s'empile, aucune fenêtre ne se perd : celle
 * qui attend paraît quand vient son tour.
 *
 * 1. `profile` — « Qui regarde ? » (et son code PIN) : l'attente bornée de
 *    l'ouverture du bureau, où la réponse du serveur peut encore imposer le
 *    sélecteur ; « Changer de profil » ouvert ; le rideau qui annonce le
 *    profil choisi, tant qu'il ne s'est pas levé.
 * 2. `familyPin` — « Action recommandée : posez votre code PIN ».
 * 3. `familyInvitation` — l'affiche d'une invitation dans une famille, puis
 *    « Bienvenue » qui la suit : une réponse attendue par quelqu'un, avant ce
 *    qui ne concerne que l'application.
 * 4. `whatsNew` — « Nouveautés pour cette version ».
 * 5. `update` — la pop-up de mise à jour : elle parle de la version SUIVANTE,
 *    donc après ce qui présente celle qu'on vient d'ouvrir ; avant l'avatar,
 *    car l'installer redémarre l'application et l'invitation, qui n'aura pas
 *    encore paru, attendra le lancement suivant sans être perdue.
 * 6. `avatarInvite` — l'invitation unique à choisir un avatar.
 *
 * Une fenêtre PEUT paraître quand tout ce qui la précède a tranché et s'est tu
 * (`done`), et que rien de ce qui la suit n'est à l'écran : une fenêtre
 * revenue en cours de route (une invitation reçue en direct) attend la
 * fermeture de celle qui est ouverte, elle ne passe jamais par-dessus. Rien du
 * tout hors session ou sur le lecteur (`ready`). L'accès suspendu (la page
 * bloquante du compte) passe avant tout, à la racine : il n'a pas de rang ici.
 */

export type StartupWindow = "profile" | "familyPin" | "familyInvitation" | "whatsNew" | "update" | "avatarInvite";

export const STARTUP_ORDER: readonly StartupWindow[] = [
  "profile",
  "familyPin",
  "familyInvitation",
  "whatsNew",
  "update",
  "avatarInvite",
];

/**
 * - `undecided` : on ne sait pas encore s'il y aura quelque chose (le serveur n'a pas répondu) ;
 * - `pending` : elle va paraître — elle attend son tour, ou son court délai ;
 * - `open` : à l'écran ;
 * - `done` : rien à montrer, ou refermée.
 */
export type StartupWindowState = "undecided" | "pending" | "open" | "done";

/** L'état de chaque fenêtre ; une fenêtre absente (pas montée) vaut `done`. */
export type StartupStates = Partial<Record<StartupWindow, StartupWindowState>>;

const WEIGHT: Record<StartupWindowState, number> = { done: 0, undecided: 1, pending: 2, open: 3 };

/** Plusieurs sources pour une même fenêtre (le rideau ET « Changer de profil ») : la plus contraignante l'emporte. */
export function strongestStartupState(states: Iterable<StartupWindowState>): StartupWindowState {
  let strongest: StartupWindowState = "done";
  for (const state of states) if (WEIGHT[state] > WEIGHT[strongest]) strongest = state;
  return strongest;
}

/** `target` peut-elle paraître (ou lancer son délai) maintenant ? */
export function startupWindowMayShow(target: StartupWindow, states: StartupStates, ready: boolean): boolean {
  if (!ready) return false;
  const rank = STARTUP_ORDER.indexOf(target);
  return STARTUP_ORDER.every((other, index) => {
    if (index === rank) return true;
    const state = states[other] ?? "done";
    return index < rank ? state === "done" : state !== "open";
  });
}

/** La fenêtre qui occupe ou attend le démarrage — la première qui n'a pas fini ; null : rien. */
export function startupHolder(states: StartupStates): StartupWindow | null {
  const open = STARTUP_ORDER.find((target) => states[target] === "open");
  if (open) return open;
  return STARTUP_ORDER.find((target) => (states[target] ?? "done") !== "done") ?? null;
}

