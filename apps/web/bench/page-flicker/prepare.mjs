#!/usr/bin/env node
/**
 * Fabrique l'état d'une base NEUVE pour le banc, par les appels du client lui-même (depuis la
 * page, avec sa session) : des lectures commencées, des titres dans Ma liste, des favoris.
 * Rien n'est noté. Rejouable : chaque écriture est idempotente.
 *
 *   node bench/page-flicker/prepare.mjs --base http://127.0.0.1:5412 --session <jetons.json>
 */
import { openBrowser, readSession, signIn } from "./lib/browser.mjs";

const args = new Map(process.argv.slice(2).map((a, i, all) => [a, all[i + 1]]).filter(([a]) => a.startsWith("--")));
const base = args.get("--base") ?? "http://127.0.0.1:5412";
const session = readSession(args.get("--session"));
const { browser, context } = await openBrowser({ width: 1280, height: 800 });
await signIn(context, base, session, "dark");
const page = await context.newPage();
await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const report = await page.evaluate(async (userId) => {
  const call = async (path, init) => {
    const response = await fetch(`/api/jellyfin${path}`, { credentials: "include", headers: { "content-type": "application/json" }, ...init });
    return { status: response.status, body: response.headers.get("content-type")?.includes("json") ? await response.json().catch(() => null) : null };
  };
  const list = async (types) => (await call(`/Users/${userId}/Items?Recursive=true&IncludeItemTypes=${types}&SortBy=SortName&Limit=40&Fields=RunTimeTicks`)).body?.Items ?? [];
  const movies = await list("Movie");
  const series = await list("Series");
  const episodes = await list("Episode");
  const done = { movies: movies.length, series: series.length, episodes: episodes.length, resume: [], watchlist: [], favorites: [] };
  // Des lectures commencées : la position au tiers, écrite dans les données du compte.
  for (const item of [...movies.slice(0, 4), ...episodes.slice(0, 2)]) {
    const ticks = Math.max(10_000_000, Math.floor((item.RunTimeTicks ?? 600_000_000) / 3));
    const answer = await call(`/UserItems/${item.Id}/UserData?userId=${userId}`, { method: "POST", body: JSON.stringify({ PlaybackPositionTicks: ticks, Played: false, LastPlayedDate: new Date().toISOString() }) });
    done.resume.push(answer.status);
  }
  for (const item of [...movies.slice(4, 10), ...series.slice(0, 2)]) done.watchlist.push((await call(`/Users/${userId}/Items/${item.Id}/Rating?likes=true`, { method: "POST" })).status);
  for (const item of [...movies.slice(10, 15), ...series.slice(1, 3)]) done.favorites.push((await call(`/Users/${userId}/FavoriteItems/${item.Id}`, { method: "POST" })).status);
  return done;
}, session.user.Id);
console.log(JSON.stringify(report));
await browser.close();
