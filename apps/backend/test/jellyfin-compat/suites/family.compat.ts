/**
 * La Famille contre un VRAI Jellyfin (docs/FAMILLE.md) :
 * - l'invité est un vrai compte, caché, sans droit, aux bibliothèques et
 *   restrictions du propriétaire, et personne n'y entre par nom et mot de
 *   passe ; le supprimer supprime son compte ;
 * - la TV passe aux profils ; chaque session de profil reçoit SON jeton
 *   Jellyfin (Quick Connect), sur un identifiant à elle ; toute coupure le
 *   fait disparaître de Jellyfin (`DELETE /Devices`) ;
 * - un membre retiré perd son profil sur la TV, jamais son compte.
 *
 * Sous la fonctionnalité « Téléviseurs jumelés » du catalogue : rien n'est
 * ajouté au manifeste publié, seuls des contrôles.
 */

import { expect } from "vitest";
import { check, feature } from "../harness";
import { waitUntil } from "../jellyfinHttp";
import { COMPAT_PASSWORD } from "../provision";
import { backendApi, ctx, jellyfin, okJson } from "./support";

interface Profile { userId: string; kind: string; name: string }
interface Streaming { directStreaming: { jellyfinToken: string | null; deviceId?: string } }

const state: { pairing?: string; guestId?: string; guestName?: string } = {};

/** Une TV jumelée par le flux « appareil », puis passée aux profils. */
async function profileTv(name: string): Promise<string> {
  const { code } = await okJson<{ code: string }>(fetch(`${ctx().backend.url}/api/pair/device/generate`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "192.168.1.43" }, body: JSON.stringify({ deviceName: name }),
  }), "code de la TV");
  await okJson(backendApi("/api/pair/device/confirm", ctx().user.token, { method: "POST", body: JSON.stringify({ code }) }), "confirmation");
  const status = await okJson<{ token: string }>(fetch(`${ctx().backend.url}/api/pair/device/status/${code}`), "statut");
  const { pairingToken } = await okJson<{ pairingToken: string }>(backendApi("/api/family/tv/enroll", status.token, { method: "POST" }), "échange");
  return pairingToken;
}

async function openSession(profileId: string): Promise<{ token: string; jellyfinToken: string; deviceId: string }> {
  const { token } = await okJson<{ token: string }>(
    backendApi("/api/family/tv/sessions", state.pairing!, { method: "POST", body: JSON.stringify({ profileId }) }),
    "session de profil",
  );
  const { directStreaming } = await okJson<Streaming>(backendApi("/api/config/streaming?jellyfinAuth=modern", token), "config du direct");
  if (!directStreaming.jellyfinToken || !directStreaming.deviceId) throw new Error("la session de profil n'a pas reçu son jeton Jellyfin");
  return { token, jellyfinToken: directStreaming.jellyfinToken, deviceId: directStreaming.deviceId };
}

const me = async (token: string) => {
  const res = await jellyfin("/Users/Me", token);
  return { status: res.status, id: res.ok ? ((await res.json()) as { Id: string }).Id : null };
};
const devices = async () => (await okJson<{ Items: Array<{ Id: string }> }>(jellyfin("/Devices", ctx().apiKey), "appareils")).Items.map((d) => d.Id);
const sameId = (a: string | null, b: string) => (a ?? "").replace(/-/g, "").toLowerCase() === b.replace(/-/g, "").toLowerCase();

async function signIn(name: string, password: string): Promise<number> {
  const res = await fetch(`${ctx().jellyfin.url}/Users/AuthenticateByName`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: 'MediaBrowser Client="Compat", Device="Suite", DeviceId="compat-famille", Version="1.0.0"' },
    body: JSON.stringify({ Username: name, Pw: password }),
  });
  await res.arrayBuffer();
  return res.status;
}

feature("userdata.paired-devices", () => {
  check("Famille : l'invité naît caché, sans droit, aux restrictions du propriétaire, mot de passe inconnu", async () => {
    const guest = await okJson<{ userId: string }>(
      backendApi("/api/family/guests", ctx().user.token, { method: "POST", body: JSON.stringify({ name: "Invité compat", color: "teal" }) }),
      "création de l'invité",
    );
    const account = await okJson<{ Name: string; Policy: Record<string, unknown> }>(jellyfin(`/Users/${guest.userId}`, ctx().apiKey), "compte invité");
    const owner = await okJson<{ Policy: Record<string, unknown> }>(jellyfin(`/Users/${ctx().user.id}`, ctx().apiKey), "propriétaire");
    expect(account.Name).toMatch(/^Invite compat - (invite de|guest of) /);
    expect(account.Policy).toMatchObject({
      IsAdministrator: false, IsHidden: true, IsDisabled: false, EnableContentDownloading: false, EnableContentDeletion: false,
      EnableAllFolders: owner.Policy.EnableAllFolders,
    });
    expect(account.Policy.AuthenticationProviderId).toBe(owner.Policy.AuthenticationProviderId);
    for (const password of ["", COMPAT_PASSWORD, "Invité compat"]) expect(await signIn(account.Name, password)).not.toBe(200);
    const visible = await okJson<Array<{ Id: string }>>(fetch(`${ctx().jellyfin.url}/Users/Public`), "comptes publics");
    expect(visible.some((u) => sameId(u.Id, guest.userId))).toBe(false);
    state.guestId = guest.userId;
    state.guestName = account.Name;
  });

  check("Famille : chaque session de profil reçoit SON jeton Jellyfin, sur son identifiant ; la remplacer le fait disparaître", async () => {
    state.pairing = await profileTv("Apple TV famille");
    const listing = await okJson<{ profiles: Profile[] }>(backendApi("/api/family/tv/profiles", state.pairing), "Qui regarde ?");
    expect(listing.profiles.map((p) => p.kind)).toEqual(["owner", "guest"]);
    const guest = await openSession(state.guestId!);
    expect(await me(guest.jellyfinToken)).toEqual({ status: 200, id: expect.any(String) });
    expect(sameId((await me(guest.jellyfinToken)).id, state.guestId!)).toBe(true);
    expect(await devices()).toContain(guest.deviceId);

    const owner = await openSession(ctx().user.id);
    expect(owner.deviceId).not.toBe(guest.deviceId);
    expect(sameId((await me(owner.jellyfinToken)).id, ctx().user.id)).toBe(true);
    expect((await backendApi("/api/config/streaming", guest.token)).status).toBe(401);
    await waitUntil(async () => (await me(guest.jellyfinToken)).status === 401, 15_000, "jeton de l'invité révoqué", 500);
    expect(await devices()).not.toContain(guest.deviceId);
  });

  check("Famille : supprimer l'invité coupe sa session et supprime son compte Jellyfin", async () => {
    const guest = await openSession(state.guestId!);
    await okJson(backendApi(`/api/family/guests/${state.guestId}`, ctx().user.token, { method: "DELETE" }), "suppression de l'invité");
    expect((await me(guest.jellyfinToken)).status).toBe(401);
    expect((await jellyfin(`/Users/${state.guestId}`, ctx().apiKey)).status).toBe(404);
    expect((await backendApi("/api/config/streaming", guest.token)).status).toBe(401);
    expect(await signIn(state.guestName!, "")).not.toBe(200);
  });

  check("Famille : un membre retiré perd son profil sur la TV, Jellyfin compris, et garde son compte", async () => {
    const { id } = await okJson<{ id: string }>(
      backendApi("/api/family/invitations", ctx().user.token, { method: "POST", body: JSON.stringify({ userId: ctx().user2.id }) }),
      "invitation",
    );
    await okJson(backendApi("/api/family/invitations/accept", ctx().user2.token, { method: "POST", body: JSON.stringify({ id }) }), "acceptation");
    const member = await openSession(ctx().user2.id);
    expect(sameId((await me(member.jellyfinToken)).id, ctx().user2.id)).toBe(true);
    await okJson(backendApi(`/api/family/members/${ctx().user2.id}`, ctx().user.token, { method: "DELETE" }), "retrait");
    expect((await me(member.jellyfinToken)).status).toBe(401);
    expect(await devices()).not.toContain(member.deviceId);
    expect((await me(ctx().user2.token)).status).toBe(200);
    expect(await signIn(ctx().user2.name, COMPAT_PASSWORD)).toBe(200);
  });

  check("Famille : déjumeler la TV coupe la session du propriétaire, Jellyfin compris", async () => {
    const owner = await openSession(ctx().user.id);
    await okJson(backendApi("/api/pair/self/revoke", state.pairing!, { method: "POST" }), "déjumelage");
    expect((await backendApi("/api/config/streaming", owner.token)).status).toBe(401);
    await waitUntil(async () => (await me(owner.jellyfinToken)).status === 401, 15_000, "jeton du propriétaire révoqué", 500);
    expect((await me(ctx().user.token)).status).toBe(200);
  });
});
