/**
 * Watch Together — l'AFFINITÉ dans un salon MIXTE (docs/DROITS-UTILISATEURS.md § 9.5.4).
 *
 * Deux comptes qui voient « Films » sans contrôle parental (`libre`, l'hôte, et
 * `filmsseuls`) swipent ensemble et matchent un titre que le compte restreint ne
 * voit pas, puis un titre qu'il voit. Le compte restreint entre ENSUITE dans le
 * salon : la pile, lancée avant lui, ne le connaît pas. Ni l'état qu'il relit,
 * ni ce que son socket reçoit (`wt:affinity`), ni ses cartes ne nomment le titre
 * interdit ; le titre permis, lui, lui parvient (témoin). Lancer le match
 * interdit est refusé : la salle ne pourrait pas le regarder ensemble.
 */

import { call, personalToken, type Door } from "./doors";
import type { JellyfinBench } from "./jellyfinBench";
import { probe, type JudgeContext } from "./judge";
import { leaksIn, norm } from "./reference";

const WT = "/api/watch-together";

interface Card {
  key: string;
  jellyfinItemId: string;
  title: string;
}

interface Socket {
  messages: string[];
  close: () => void;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Le socket d'un compte, authentifié par message (comme le bureau), et tout ce qu'il reçoit. */
async function openSocket(base: string, token: string): Promise<Socket> {
  const messages: string[] = [];
  const ws = new WebSocket(`${base.replace(/^http/, "ws")}/api/ws`);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("socket sans réponse")), 10_000);
    ws.addEventListener("open", () => ws.send(JSON.stringify({ type: "auth", token })));
    ws.addEventListener("error", () => reject(new Error("socket refusé")));
    ws.addEventListener("message", (event) => {
      const text = String(event.data);
      if (text.includes('"auth_ok"')) {
        clearTimeout(timer);
        resolve();
      } else {
        messages.push(text);
      }
    });
  });
  return { messages, close: () => ws.close() };
}

/** Invite un compte dans le salon de l'hôte, et le fait accepter. */
async function invite(base: string, host: string, guest: { id: string; token: string }): Promise<boolean> {
  await call(base, host, "POST", `${WT}/group/invites`, { userIds: [guest.id] });
  const pending = (await call(base, guest.token, "GET", `${WT}/invites`)).json as Array<{ inviteId: string }> | null;
  const inviteId = pending?.[0]?.inviteId;
  if (!inviteId) return false;
  return (await call(base, guest.token, "POST", `${WT}/invites/${inviteId}/respond`, { accept: true })).status === 200;
}

async function like(base: string, token: string, sessionId: number, key: string): Promise<{ matched?: boolean }> {
  const res = await call(base, token, "POST", `${WT}/affinity/votes`, { sessionId, key, verdict: "like" });
  return (res.json ?? {}) as { matched?: boolean };
}

export async function probeAffinity(ctx: JudgeContext, restricted: Door, jf: JellyfinBench): Promise<void> {
  const { base, rec } = ctx;
  const host = await personalToken(base, jf.free.name);
  const partner = await personalToken(base, jf.filmsOnly.name);
  const everyone = [host, partner, restricted.token];
  for (const token of everyone) await call(base, token, "POST", `${WT}/group/leave`);

  let socket: Socket | null = null;
  try {
    const created = await call(base, host, "POST", `${WT}/group`, {});
    if (!rec.note(created.status === 200, `${jf.free.name} crée un salon (${created.status})`)) return;
    rec.note(await invite(base, host, { id: jf.filmsOnly.id, token: partner }), `${jf.filmsOnly.name} entre dans le salon`);

    const started = await call(base, host, "POST", `${WT}/affinity`, { kind: "movie" });
    if (!rec.note(started.status === 200, `affinité lancée par ${jf.free.name} (${started.status} ${started.text.slice(0, 80)})`)) return;
    const joined = (await call(base, partner, "POST", `${WT}/affinity/join`, { limit: 30 })).json as
      { sessionId: number; cards: Card[] } | null;
    const cards = joined?.cards ?? [];
    const forbidden = cards.find((c) => !ctx.ref.visible.has(norm(c.jellyfinItemId)));
    const allowed = cards.find((c) => ctx.ref.visible.has(norm(c.jellyfinItemId)));
    const other = cards.find((c) => c !== forbidden && c !== allowed);
    if (!rec.note(Boolean(joined && forbidden && allowed && other), `la pile commune porte un titre interdit au compte restreint et un titre permis (${cards.map((c) => c.title).join(", ")})`)) return;
    const sid = joined!.sessionId;
    await call(base, host, "POST", `${WT}/affinity/join`, { limit: 30 });
    for (const card of [forbidden!, allowed!]) {
      await like(base, host, sid, card.key);
      rec.note((await like(base, partner, sid, card.key)).matched === true, `match de « ${card.title} » entre ${jf.free.name} et ${jf.filmsOnly.name}`);
    }

    // Le compte restreint entre APRÈS les matchs : son socket écoute dès avant l'entrée.
    socket = await openSocket(base, restricted.token);
    rec.note(await invite(base, host, { id: jf.restricted.id, token: restricted.token }), `${jf.restricted.name} entre dans le salon`);
    const state = await probe(ctx, restricted, "GET", `${WT}/affinity`, { status: [200] });
    rec.note(state.text.includes(allowed!.title), `${restricted.label} · le match permis « ${allowed!.title} » lui est proposé (témoin)`);

    // Un geste de l'hôte : l'état part à toute la salle.
    await call(base, host, "POST", `${WT}/affinity/votes`, { sessionId: sid, key: other!.key, verdict: "dislike" });
    await probe(ctx, restricted, "POST", `${WT}/affinity/join`, { status: [200] }, { limit: 30 });

    // La salle ne peut pas regarder ensemble ce que l'un de ses membres ne voit pas.
    const launch = await call(base, host, "POST", `${WT}/affinity/launch`, { key: forbidden!.key });
    rec.note(launch.status === 409, `lancer le match interdit « ${forbidden!.title} » est refusé (${launch.status})`);

    await pause(500);
    const pushed = socket.messages.filter((m) => m.includes('"wt:affinity"'));
    const leaks = pushed.flatMap((m) => leaksIn(m, ctx.ref));
    rec.note(pushed.length > 0 && leaks.length === 0, `${restricted.label} · socket : ${pushed.length} message(s) wt:affinity${leaks.length ? ` · FUITE : ${[...new Set(leaks)].join(" ; ")}` : ""}`);
    rec.note(pushed.some((m) => m.includes(allowed!.title)), `${restricted.label} · socket : le match permis lui parvient (témoin)`);
  } finally {
    socket?.close();
    for (const token of everyone) await call(base, token, "POST", `${WT}/group/leave`);
  }
}
