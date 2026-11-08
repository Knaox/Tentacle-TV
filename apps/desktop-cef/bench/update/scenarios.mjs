// Les parcours de bout en bout, sur la vraie app et le faux flux : chaque étape est une
// assertion imprimée « ✓ » ou lève une erreur. Lancés par dev-update.mjs --scenario.
import { existsSync, rmSync } from "node:fs";
import { BASE_VERSION, RELEASES } from "./feed.mjs";
import { STATE, click, evaluate, killAll, launch, overlay, pids, readJson, sleep, state, version, waitFor, waitForBoot } from "./app.mjs";

const ok = (what, cond, detail = "") => {
  if (!cond) throw new Error(`ÉCHEC : ${what}${detail ? ` — ${detail}` : ""}`);
  console.log(`  ✓ ${what}${detail ? ` (${detail})` : ""}`);
};
// Le texte dépend de la langue de la page (fr ou en) : on accepte les deux.
const says = (o, fr, en) => !!o && (o.text.includes(fr) || o.text.includes(en));
const has = (o, action) => !!o && o.buttons.some((b) => b.action === action);

async function boot(env, { fresh = true } = {}) {
  await killAll();
  if (fresh) rmSync(STATE, { recursive: true, force: true });
  launch(env);
  await waitForBoot();
}

const phase = async (p, ms = 90000) => waitFor(`phase ${p}`, async () => (await state())?.phase === p, ms);

// La nouvelle version a démarré (relancée par l'assistant ou à la main) et se dit en bonne santé.
async function provesNewVersion(target, previous) {
  await waitFor(`l'app en ${target}`, async () => (await state())?.current === target, 60000, 500);
  ok(`l'app tourne en ${target}`, version() === target, "Info.plist sur le disque");
  await waitFor("bonne santé (10 s)", async () => readJson("probation.json")?.healthy === true, 30000, 500);
  await waitFor("ancienne copie effacée", async () => !existsSync(previous), 30000, 500);
  ok("période d'essai réussie, ancienne copie effacée", true);
}

export async function minor(env) {
  const v = RELEASES.minor.version, previous = env.previous;
  await boot(env);
  const views = new Set();
  await waitFor("mineure prête", async () => {
    const o = await overlay();
    if (o) views.add(o.view);
    return (await state())?.phase === "ready";
  }, 90000, 200);
  ok("mineure téléchargée, vérifiée et préparée en silence", true);
  ok("AUCUNE notification pendant tout le parcours", [...views].every((x) => x === "none" || x === "absent"), [...views].join(","));
  await evaluate("__shell.invoke('shell.quit')");
  await waitFor("fin de l'app", async () => pids().length === 0, 30000);
  await waitFor("échange par l'assistant", async () => version() === v, 30000, 250);
  ok(`à la fermeture, ${v} posée sans relance`, pids().length === 0, readJson("probation.json")?.version);
  launch(env);
  await waitForBoot();
  await provesNewVersion(v, previous);
}

export async function major(env) {
  const v = RELEASES.major.version, previous = env.previous;
  // 1) Progression, attente pendant une lecture, « Plus tard ».
  await boot(env);
  const fills = new Set();
  await waitFor("notification pendant le téléchargement", async () => {
    const o = await overlay();
    if (o?.view === "toast" && o.fill) fills.add(o.fill);
    return o?.view === "toast" && (await state())?.phase === "ready";
  }, 90000, 100);
  ok("progression affichée pendant le téléchargement", fills.size >= 2, [...fills].slice(0, 6).join(" → "));
  let o = await overlay();
  ok("notification « prête », « Redémarrer pour mettre à jour »", says(o, `Tentacle ${v} est prête`, `Tentacle ${v} is ready`) && has(o, "restart"), o.text.slice(0, 110));
  ok("« Plus tard », « Ne plus m'avertir… » et « Nouveautés » proposés", has(o, "later") && has(o, "mute") && has(o, "notes"), o.buttons.map((b) => b.label).join(" | "));
  await evaluate("history.pushState({}, '', '/watch/banc-maj'), true");
  await waitFor("attente pendant la lecture", async () => (await overlay())?.view === "waiting", 5000);
  ok("lecture en cours (/watch) : la notification s'efface et attend", true);
  await evaluate("history.pushState({}, '', '/'), true");
  await waitFor("retour après la lecture", async () => (await overlay())?.view === "toast", 5000);
  ok("lecture finie : elle revient", true);
  await click("later");
  await waitFor("« Plus tard »", async () => (await overlay())?.view === "none", 5000);
  ok("« Plus tard » : masquée, rappel retenu", readJson("state.json")?.snoozedVersion === v, `jusqu'à ${new Date(readJson("state.json").snoozedUntil * 1000).toLocaleString("fr-FR")}`);
  // 2) « Ne plus m'avertir jusqu'à la prochaine grosse mise à jour », retenu par l'appareil.
  await boot(env);
  await waitFor("notification", async () => (await overlay())?.view === "toast" && (await state())?.phase === "ready", 90000);
  await click("mute");
  await waitFor("silence", async () => (await overlay())?.view === "none", 5000);
  ok("« Ne plus m'avertir… » : mémorisé", readJson("state.json")?.mutedThrough === v);
  await boot(env, { fresh: false });
  await phase("ready");
  await sleep(1500);
  ok("relancée : la même majeure se tait", (await overlay())?.view === "none" && (await state())?.prompt === "none");
  // 3) « Redémarrer pour mettre à jour » : assistant, relance, période d'essai.
  await boot(env);
  await waitFor("notification", async () => (await overlay())?.view === "toast" && (await state())?.phase === "ready", 90000);
  ok("clic sur « Redémarrer pour mettre à jour »", await click("restart"));
  await provesNewVersion(v, previous);
}

export async function critical(env) {
  const v = RELEASES.critical.version, previous = env.previous;
  // 0) Hors ligne au lancement : rien ne bloque.
  await boot({ ...env, feedUrl: env.deadFeedUrl });
  await sleep(4000);
  ok("hors ligne au lancement : aucun blocage", (await overlay())?.view !== "blocking" && (await state())?.update === null);
  // 1) Bloquante pendant le téléchargement, avertissement non bloquant quand le réseau tombe.
  await boot(env);
  await waitFor("voile de sécurité", async () => (await overlay())?.view === "blocking", 30000, 100);
  let o = await overlay();
  ok("mise à jour de sécurité : voile bloquant", o.kind === "alertdialog" && says(o, "Mise à jour de sécurité requise", "Security update required"));
  ok("la raison du manifeste est expliquée", says(o, "jetons de connexion", "sign-in tokens"));
  ok("aucun moyen de la masquer", o.buttons.every((b) => b.action === "restart" || b.action === "notes"), o.buttons.map((b) => `${b.label}${b.disabled ? " (inactif)" : ""}`).join(" | "));
  await waitFor("réseau coupé", async () => (await overlay())?.view === "toast", 30000, 100);
  o = await overlay();
  ok("réseau perdu : avertissement SANS blocage", says(o, "en attente", "pending") && (await state()).error === "network", o.text.slice(0, 100));
  await waitFor("nouvel essai puis prête", async () => (await state())?.phase === "ready" && (await overlay())?.view === "blocking", 90000);
  o = await overlay();
  ok("réseau revenu : de nouveau bloquante, prête", o.buttons.some((b) => b.action === "restart" && !b.disabled));
  const typed = await evaluate("(() => { const e = new KeyboardEvent('keydown', {key: 'k', bubbles: true, cancelable: true}); document.body.dispatchEvent(e); return e.defaultPrevented; })()");
  ok("le clavier de la page est retenu", typed === true);
  ok("clic sur « Redémarrer et installer »", await click("restart"));
  await provesNewVersion(v, previous);
}

export async function rollback(env) {
  const v = RELEASES.major.version;
  await boot(env);
  await waitFor("notification", async () => (await overlay())?.view === "toast" && (await state())?.phase === "ready", 90000);
  ok("clic sur « Redémarrer pour mettre à jour » (version cassée)", await click("restart"));
  await waitFor("retour à l'ancienne version", async () => (await state())?.rolledBack === v, 90000, 500);
  ok(`${v} n'a pas démarré : retour à ${BASE_VERSION}`, version() === BASE_VERSION && (await state()).current === BASE_VERSION);
  ok("version retenue comme mauvaise", (readJson("state.json")?.badVersions || []).includes(v));
  await waitFor("annonce du retour arrière", async () => (await overlay())?.view === "rolledBack", 10000);
  ok("annoncé à l'utilisateur", says(await overlay(), "Mise à jour annulée", "Update rolled back"));
  await waitFor("contrôle suivant", async () => (await state())?.update?.reason === "rolled-back", 30000);
  ok("plus jamais reproposée", (await state()).prompt === "none");
}
