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
  | { ok: false; refusal: AccountCreationRefusal; detail?: string };

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

    await fetch(`${jellyfinUrl}/Users/Password?userId=${user.Id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...jellyfinAuthHeaders(apiKey) },
      body: JSON.stringify({ NewPw: password, ResetPassword: false }),
    });
    return { ok: true, user };
  } catch (err) {
    return { ok: false, refusal: "account_creation_failed", detail: err instanceof Error ? err.message : undefined };
  }
}
