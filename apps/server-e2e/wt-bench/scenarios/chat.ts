/**
 * Le chat de la séance, en rafale (demande de Damien, wt-socle 7f894807a) :
 * réactions, messages, « X est en train d'écrire… ». Tout ce qui part arrive
 * chez l'autre ; au-delà du débit permis, le client refuse AVANT l'envoi
 * (messages 10 puis 2/s, réactions 20 puis 10/s, par membre) ; des réactions
 * identiques en rafale ne font qu'UNE bulle « ×N ». Les GIF ne sont pas joués :
 * ils viennent de Klipy, que le banc ne joint pas.
 */

import type { WebClient } from "../clients/webClient";
import { waitFor } from "../measure";
import type { ScenarioContext } from "./context";
import { createGroup, inviteAndAccept, launch, waitOnItem } from "./group";

const CHAT_OPEN = /Ouvrir le chat du groupe/;
const TYPING = /est en train d'écrire/;

/** Les commandes du lecteur se cachent au repos : un mouvement de souris les rappelle. */
async function wake(c: WebClient): Promise<void> {
  await c.page.mouse.move(600 + Math.random() * 80, 380 + Math.random() * 40);
}

async function openChat(c: WebClient): Promise<boolean> {
  await wake(c);
  if (await c.page.getByPlaceholder("Écrire un message…").first().isVisible().catch(() => false)) return true;
  return c.clickText(CHAT_OPEN, 8_000);
}

const out = (c: WebClient, type: string, since: number) => c.frames.filter((f) => f.dir === "out" && f.type === type && f.at >= since).length;

export async function chatScenario(ctx: ScenarioContext): Promise<void> {
  const a = await ctx.member(ctx.state.users.a, "A");
  const b = await ctx.member(ctx.state.users.b, "B");
  await createGroup(a);
  await inviteAndAccept(ctx, a, b);
  await launch(a, ctx.state.episodeIds[2]);
  await waitOnItem([a, b], ctx.state.episodeIds[2], 60_000);
  ctx.check("A ouvre le chat", await openChat(a));
  ctx.check("B ouvre le chat", await openChat(b));
  await ctx.dump("chat-ouvert");

  // 1) Rafale de réactions : 25 « 🔥 » en ~1 s (le premier bouton rapide).
  const firstQuick = a.page.locator("button[aria-label]").filter({ hasText: /^\p{Extended_Pictographic}/u }).first();
  const emoji = (await firstQuick.getAttribute("aria-label").catch(() => null)) ?? "?";
  let t0 = Date.now();
  await openChat(a);
  for (let i = 0; i < 25; i += 1) {
    await firstQuick.click({ timeout: 2_000, force: true }).catch(() => undefined);
    await new Promise((ok) => setTimeout(ok, 35));
  }
  await new Promise((ok) => setTimeout(ok, 1_500));
  const sentR = out(a, "wt:reaction", t0);
  const gotR = b.received("wt:reaction", t0).length;
  ctx.metric(`réactions « ${emoji} » : 25 appuis en ~1 s`, `${sentR} envoyées, ${gotR} reçues chez B`);
  ctx.check("rafale de réactions : le client plafonne avant l'envoi (≤ 20 + 10/s)", sentR <= 31 && sentR >= 15, `${sentR}`);
  ctx.check("rafale de réactions : tout ce qui part arrive chez B", gotR === sentR, `${gotR}/${sentR}`);
  await wake(b);
  const bubble = await waitFor(() => b.isVisible(/×\s?\d+/), 3_000);
  ctx.check("B voit UNE bulle « ×N » pour la rafale", bubble !== null);
  await ctx.dump("reactions");

  // 2) Rafale de messages : 12 envois d'affilée.
  const input = a.page.getByPlaceholder("Écrire un message…").first();
  t0 = Date.now();
  for (let i = 1; i <= 12; i += 1) {
    await input.fill(`message ${i}`).catch(() => undefined);
    await input.press("Enter").catch(() => undefined);
  }
  await new Promise((ok) => setTimeout(ok, 1_500));
  const sentM = out(a, "wt:chat", t0);
  const gotM = b.received("wt:chat", t0).length;
  ctx.metric("messages : 12 envois d'affilée", `${sentM} envoyés, ${gotM} reçus chez B`);
  ctx.check("rafale de messages : plafonnée avant l'envoi (≈ 10)", sentM >= 8 && sentM <= 12, `${sentM}`);
  ctx.check("rafale de messages : tout ce qui part arrive chez B", gotM === sentM, `${gotM}/${sentM}`);
  await new Promise((ok) => setTimeout(ok, 6_000));

  // 3) « est en train d'écrire » : chez l'autre dans la seconde, jamais chez soi.
  await openChat(a);
  await openChat(b);
  t0 = Date.now();
  await input.fill("").catch(() => undefined);
  await input.pressSequentially("je tape", { delay: 80 }).catch(() => undefined);
  const shownB = await waitFor(() => b.isVisible(TYPING), 3_000, 100);
  ctx.check("B voit « compat-user est en train d'écrire… »", shownB !== null, shownB === null ? undefined : `${Date.now() - t0 - 560} ms après la 1ʳᵉ frappe (≈)`);
  ctx.check("A ne se voit pas écrire", !(await a.isVisible(TYPING)));
  await input.press("Enter").catch(() => undefined);
  const goneOnSend = await waitFor(async () => !(await b.isVisible(TYPING)), 3_000, 100);
  ctx.check("l'indication disparaît chez B à l'envoi", goneOnSend !== null, goneOnSend === null ? undefined : `${goneOnSend} ms`);

  await input.pressSequentially("puis j'arrête", { delay: 60 }).catch(() => undefined);
  const lastKey = Date.now();
  await waitFor(() => b.isVisible(TYPING), 3_000, 100);
  const goneIdle = await waitFor(async () => !(await b.isVisible(TYPING)), 10_000, 200);
  ctx.metric("arrêt de frappe → l'indication s'éteint chez B", goneIdle === null ? "jamais en 10 s" : `${Date.now() - lastKey} ms`, null, "≈ 4 000 ms");

  // 4) Au repos : rien sur le réseau (la « fin de frappe » est partie au bout de 4 s).
  await new Promise((ok) => setTimeout(ok, Math.max(0, lastKey + 5_000 - Date.now())));
  t0 = Date.now();
  await new Promise((ok) => setTimeout(ok, 6_000));
  ctx.check("au repos, aucun wt:typing envoyé", out(a, "wt:typing", t0) === 0, `${out(a, "wt:typing", t0)} trame(s)`);
  await ctx.dump("ecrit");
}
