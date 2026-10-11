import { jellyfinAuthHeaders } from "./jellyfinAuth";

/**
 * Le compte Jellyfin d'une inscription par invitation : le créer, et dire
 * POURQUOI quand Jellyfin le refuse.
 *
 * Jellyfin ne le dit pas lui-même. Mesuré sur 10.11.11 : un nom déjà pris
 * (casse ignorée) et un nom aux caractères refusés reçoivent la même réponse,
 * 400 « Error processing request. ». Il accepte les lettres (accents compris),
 * les chiffres, les espaces intérieurs et `. - _ ' @ +` ; il refuse tout autre
 * signe et un espace en bord. Un 400 se départage donc par la liste des
 * comptes : le nom y est, il est pris ; il n'y est pas, il est refusé.
 */
export type AccountCreationRefusal = "username_taken" | "username_invalid" | "account_creation_failed";

export type AccountCreation =
  | { ok: true; user: { Id: string; Name: string } }
  /** `orphanId` : un compte sans mot de passe que Jellyfin n'a pas laissé retirer — à dire au journal. */
  | { ok: false; refusal: AccountCreationRefusal; detail?: string; orphanId?: string };

/** Le nom est-il déjà celui d'un compte ? `null` : la liste n'a pas pu être lue. */
async function usernameTaken(jellyfinUrl: string, apiKey: string, username: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${jellyfinUrl}/Users`, { headers: jellyfinAuthHeaders(apiKey), signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const users = (await res.json()) as Array<{ Name?: string }>;
    const wanted = username.toUpperCase();
    return users.some((user) => user.Name?.toUpperCase() === wanted);
  } catch {
    return null;
  }
}

async function setPassword(jellyfinUrl: string, apiKey: string, userId: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(`${jellyfinUrl}/Users/Password?userId=${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...jellyfinAuthHeaders(apiKey) },
      body: JSON.stringify({ NewPw: password, ResetPassword: false }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function removeUser(jellyfinUrl: string, apiKey: string, userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${jellyfinUrl}/Users/${userId}`, { method: "DELETE", headers: jellyfinAuthHeaders(apiKey) });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export async function createJellyfinAccount(
  jellyfinUrl: string,
  apiKey: string,
  username: string,
  password: string,
): Promise<AccountCreation> {
  try {
    const createRes = await fetch(`${jellyfinUrl}/Users/New`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...jellyfinAuthHeaders(apiKey) },
      body: JSON.stringify({ Name: username }),
    });
    if (!createRes.ok) {
      const detail = await createRes.text();
      if (createRes.status === 400) {
        const taken = await usernameTaken(jellyfinUrl, apiKey, username);
        if (taken !== null) return { ok: false, refusal: taken ? "username_taken" : "username_invalid" };
      }
      return { ok: false, refusal: "account_creation_failed", detail };
    }
    const user = (await createRes.json()) as { Id: string; Name: string };

    // Créé SANS mot de passe, un compte Jellyfin s'ouvre avec un mot de passe vide : si le
    // mot de passe ne se pose pas, le compte ne reste pas.
    if (!(await setPassword(jellyfinUrl, apiKey, user.Id, password))) {
      const removed = await removeUser(jellyfinUrl, apiKey, user.Id);
      return { ok: false, refusal: "account_creation_failed", detail: "Jellyfin n'a pas pris le mot de passe du compte", ...(removed ? {} : { orphanId: user.Id }) };
    }
    return { ok: true, user };
  } catch (err) {
    return { ok: false, refusal: "account_creation_failed", detail: err instanceof Error ? err.message : undefined };
  }
}
