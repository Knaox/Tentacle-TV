/**
 * « Tout ce que tu as le droit de faire, tu le vois ; le reste, non » (lot du
 * 20/10) : ce que la session peut faire (`/api/account/abilities`) suit chaque
 * droit posé par la fiche des droits ; un compte DÉSACTIVÉ ne se connecte plus
 * et sa session ouverte est coupée ; un compte HORS DE SES HEURES ne lit plus
 * rien (le flux refusé : la lecture en cours s'arrête au bout de son tampon,
 * et l'app montre sa page). Chaque réglage est remis comme avant.
 */

import { BENCH_PASSWORD } from "./catalog";
import { call, personalToken, type Door } from "./doors";
import type { Recorder } from "./judge";

interface Account { name: string; id: string }

async function until(test: () => Promise<boolean>, ms = 15_000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await test()) return true;
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  return test();
}

const abilitiesOf = async (base: string, token: string) =>
  (await call(base, token, "GET", "/api/account/abilities")).json as Record<string, unknown> | null;

/** Ce qu'une porte peut faire, comparé à ce qu'on attend d'elle. */
export async function probeAbilities(base: string, rec: Recorder, door: Door, expected: Record<string, unknown>): Promise<void> {
  const got = await abilitiesOf(base, door.token);
  const wrong = Object.entries(expected).filter(([key, value]) => got?.[key] !== value).map(([key]) => `${key}=${String(got?.[key])}`);
  rec.note(got !== null && wrong.length === 0, `${door.label} · ce que la session peut faire${wrong.length ? ` · ÉCART : ${wrong.join(", ")}` : ""}`);
}

/** Les droits d'administration retirés par la fiche des droits disparaissent de ce que le compte peut faire. */
export async function probeAdminRightsReflected(base: string, rec: Recorder, admin: string, account: Account): Promise<void> {
  const rights = `/api/admin/users/${account.id}/rights`;
  const before = (await call(base, admin, "GET", rights)).json as { rights?: Record<string, unknown> } | null;
  const original = {
    enableContentDownloading: before?.rights?.enableContentDownloading ?? true,
    syncPlayAccess: before?.rights?.syncPlayAccess ?? "CreateAndJoinGroups",
    enablePublicSharing: before?.rights?.enablePublicSharing ?? true,
    enableMediaPlayback: before?.rights?.enableMediaPlayback ?? true,
  };
  const cut = await call(base, admin, "PATCH", rights, { enableContentDownloading: false, syncPlayAccess: "None", enablePublicSharing: false, enableMediaPlayback: false });
  rec.note(cut.status === 200, `${account.name} · hors ligne, Watch Together, partage et lecture retirés par la fiche des droits → ${cut.status}`);
  try {
    const token = await personalToken(base, account.name);
    const seen = await until(async () => {
      const got = await abilitiesOf(base, token);
      return got?.keepOffline === false && got?.watchTogether === "none" && got?.publicSharing === false && got?.playback === false;
    });
    rec.note(seen, `${account.name} · plus rien de tout cela dans ce que la session peut faire`);
  } finally {
    const back = await call(base, admin, "PATCH", rights, original);
    rec.note(back.status === 200, `${account.name} · droits remis → ${back.status}`);
  }
}

/** Une fenêtre horaire qui n'inclut pas l'heure qu'il est (heure locale du serveur, celle du banc). */
function closedWindow(now = new Date()): { dayOfWeek: string; startHour: number; endHour: number } {
  return now.getHours() < 12 ? { dayOfWeek: "Everyday", startHour: 20, endHour: 22 } : { dayOfWeek: "Everyday", startHour: 2, endHour: 4 };
}

/** Hors de ses heures : la session ouverte ne lit plus rien, la page le dit ; la plage rendue, tout revient. */
export async function probeScheduleCut(base: string, rec: Recorder, admin: string, account: Account, door: Door, itemId: string): Promise<void> {
  const rights = `/api/admin/users/${account.id}/rights`;
  const set = await call(base, admin, "PATCH", rights, { accessSchedules: [closedWindow()] });
  rec.note(set.status === 200, `${account.name} · plage horaire fermée posée → ${set.status}`);
  try {
    const blocked = await until(async () => {
      const access = (await call(base, door.token, "GET", "/api/account/access")).json as { state?: string } | null;
      return access?.state === "outsideSchedule";
    });
    rec.note(blocked, `${door.label} · hors de ses heures : la page « pas disponible en ce moment »`);
    const stream = await call(base, door.token, "POST", `/api/jellyfin/Items/${itemId}/PlaybackInfo?userId=${account.id}`, {});
    rec.note(stream.status === 403, `${door.label} · hors de ses heures : la lecture est refusée (${stream.status})`);
  } finally {
    const back = await call(base, admin, "PATCH", rights, { accessSchedules: [] });
    rec.note(back.status === 200, `${account.name} · plage horaire retirée → ${back.status}`);
  }
}

/** Désactivé : la session ouverte est coupée (page), la connexion refusée avec sa raison ; réactivé, il revient. */
export async function probeDisabledCut(base: string, rec: Recorder, admin: string, account: Account): Promise<void> {
  const rights = `/api/admin/users/${account.id}/rights`;
  const open = await personalToken(base, account.name);
  const set = await call(base, admin, "PATCH", rights, { isDisabled: true });
  rec.note(set.status === 200, `${account.name} · désactivé par la fiche des droits → ${set.status}`);
  try {
    const cut = await until(async () => {
      const res = await call(base, open, "GET", "/api/account/access");
      return res.status === 401 || (res.json as { state?: string } | null)?.state === "disabled";
    });
    rec.note(cut, `${account.name} · la session ouverte est coupée (page « désactivé » ou reconnexion)`);
    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: account.name, password: BENCH_PASSWORD }),
    });
    const body = (await login.json().catch(() => null)) as { code?: string } | null;
    rec.note(login.status === 403 && body?.code === "account_disabled", `${account.name} · connexion refusée avec sa raison (${login.status} ${body?.code ?? "?"})`);
  } finally {
    const back = await call(base, admin, "PATCH", rights, { isDisabled: false });
    rec.note(back.status === 200, `${account.name} · réactivé → ${back.status}`);
  }
}
