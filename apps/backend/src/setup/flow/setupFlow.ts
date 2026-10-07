import { hasPrisma } from "../../services/db";
import { deleteConfigValue, getConfigValue, setConfigValue } from "../../services/configStore";
import { SetupError } from "../setupErrors";
import { setupActionAllowed, type SetupAction, type SetupFlowState, type SetupPath, type SetupSelection } from "../setupFlowContract";
import { SETUP_KEYS, claimedAdminId, storedJellyfin } from "../setupStore";
import { tmdbSetupState } from "./tmdbChoice";

/**
 * Le parcours tenu par le SERVEUR : le Jellyfin choisi (`SETUP_KEYS.selection`)
 * et son état, d'où `setupActionAllowed` (contrat partagé) tire ce qui est
 * permis. Le client affiche ; ici, on refuse. Rien ne se décide sur ce que le
 * client envoie : le parcours vient de la sonde du Jellyfin, faite par le
 * serveur au moment du choix.
 */

const PATHS: ReadonlySet<string> = new Set<SetupPath>(["fresh", "configured"]);

function isSelection(value: unknown): value is SetupSelection {
  const s = value as Partial<SetupSelection> | null;
  return (
    !!s &&
    typeof s.url === "string" &&
    typeof s.serverId === "string" &&
    typeof s.serverName === "string" &&
    typeof s.version === "string" &&
    typeof s.inStack === "boolean" &&
    typeof s.path === "string" &&
    PATHS.has(s.path) &&
    (s.noLibraries === undefined || typeof s.noLibraries === "boolean")
  );
}

export function readSelection(): SetupSelection | null {
  const raw = getConfigValue(SETUP_KEYS.selection);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSelection(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveSelection(selection: SetupSelection): Promise<void> {
  await setConfigValue(SETUP_KEYS.selection, JSON.stringify(selection));
}

/** L'installation finie, ou rouverte : plus de choix en cours. */
export async function forgetSelection(): Promise<void> {
  await deleteConfigValue(SETUP_KEYS.selection);
  await deleteConfigValue(SETUP_KEYS.keyCreatedFor);
}

/**
 * Relié : Tentacle tient la clé du Jellyfin CHOISI — et, pour celui de la pile
 * verrouillé au démarrage, le compte provisoire a déjà pris le nom choisi.
 */
export function isLinked(selection: SetupSelection | null): boolean {
  const stored = storedJellyfin();
  if (!selection || !stored || stored.url !== selection.url) return false;
  return !(selection.inStack && claimedAdminId() !== null);
}

export function flowState(): SetupFlowState {
  // La clé TMDB est toujours déclarée : l'écran compte dans la longueur du parcours dès l'accueil.
  const tmdb = tmdbSetupState();
  if (!hasPrisma()) return { databasePending: true, selection: null, linked: false, noLibraries: false, tmdb };
  const selection = readSelection();
  const linked = isLinked(selection);
  // Seulement un Jellyfin DÉJÀ configuré, relié : le neuf a toujours son écran des bibliothèques.
  const noLibraries = linked && selection?.path === "configured" && selection.noLibraries === true;
  return { databasePending: false, selection, linked, noLibraries, tmdb };
}

/**
 * Ce que la connexion a trouvé chez un Jellyfin déjà configuré : aucune
 * bibliothèque → l'écran des bibliothèques entre dans son parcours. Constaté
 * à chaque connexion (l'écran de connexion précède toute création), gardé
 * avec le choix : un autre Jellyfin choisi l'oublie.
 */
export async function noteLibraryCount(count: number | null): Promise<void> {
  const selection = readSelection();
  if (!selection || selection.path !== "configured") return;
  const { noLibraries: _previous, ...rest } = selection;
  // Illisible : on ne propose rien de plus (le parcours d'avant).
  await saveSelection(count === 0 ? { ...rest, noLibraries: true } : rest);
}

/**
 * Le geste appartient au parcours en cours, sinon un refus : `db_unreachable`
 * sans base (rien ne s'enregistre), `step_refused` pour tout le reste.
 */
export function requireStep(action: SetupAction): SetupFlowState {
  const state = flowState();
  if (state.databasePending) throw new SetupError("db_unreachable");
  if (!setupActionAllowed(action, state)) throw new SetupError("step_refused");
  return state;
}

/** Le Jellyfin choisi, quand le geste exige d'en avoir un (`requireStep` l'a vérifié). */
export function chosen(state: SetupFlowState): SetupSelection {
  if (!state.selection) throw new SetupError("step_refused");
  return state.selection;
}

/** La clé « Tentacle » vient d'être créée par cette installation sur ce Jellyfin. */
export async function noteKeyCreated(url: string): Promise<void> {
  await setConfigValue(SETUP_KEYS.keyCreatedFor, url);
}

export function keyCreatedFor(): string | null {
  return getConfigValue(SETUP_KEYS.keyCreatedFor) ?? null;
}
