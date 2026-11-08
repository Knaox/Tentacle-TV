// Scénario Octave DANS le front de Tentacle, par ses propres contrôles : lecture d'un
// album, mini-lecteur, enchaînement, pause/reprise, seek, suivant, réclamation par
// une vidéo, sortie d'Octave et retour. Observe le DOM, les appels du front et les
// évènements du moteur, par un ENVIRONNEMENT : `env.calls` / `env.events` (rafraîchis
// par `env.sync()`), `env.prop(name)` (mpv de la musique), `env.claim()` (« une vidéo
// démarre »). Fourni par `octave-relay.mjs` (Chrome + relais) ou `octave-cef.mjs` (CEF).
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const go = (cdp, path) =>  // navigation INTERNE (React Router), sans rechargement
  cdp.eval(`history.pushState({}, "", ${JSON.stringify(path)}); dispatchEvent(new PopStateEvent("popstate")); true`);

export async function scenario({ cdp, env, cache, origin }) {
  const relayed = env;
  let failures = 0;
  const check = (ok, what) => { if (!ok) failures++; console.log(`${ok ? "✅" : "❌"} ${what}`); return ok; };
  const waitFor = async (fn, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { await env.sync(); const v = await fn(); if (v) return v; await sleep(150); }
    return null;
  };
  const callsSince = (i, channel) => relayed.calls.slice(i).filter((c) => c.channel === channel);
  const lastState = () => [...relayed.events].reverse().find((e) => e.type === "state")?.state ?? null;
  const eventSince = (i, type) => relayed.events.slice(i).find((e) => e.type === type);
  const dock = () => cdp.eval(`document.querySelector("[data-octave-dock]")?.innerText.replace(/\\s+/g, " ") ?? ""`);
  // Clique le bouton dont l'aria-label (ou le texte) vaut exactement `label` (dans le mini-lecteur si `inDock`).
  const click = (label, inDock = false) => cdp.eval(`(() => {
    const root = ${inDock} ? document.querySelector("[data-octave-dock]") : document;
    const el = [...(root?.querySelectorAll("button") ?? [])].find((b) =>
      (b.getAttribute("aria-label") ?? b.innerText.trim()) === ${JSON.stringify(label)});
    if (!el) return false; el.click(); return true; })()`);
  const timePos = () => env.prop("time-pos");

  // --- connexion ----------------------------------------------------------------
  const account = JSON.parse(readFileSync(join(cache, "banc/comptes.json"), "utf8")).admin;
  // La page se pose d'abord (`/` puis redirection vers `/login` si la session manque) :
  // on attend le formulaire OU l'accueil connecté.
  await sleep(2000);
  await waitFor(() => cdp.eval(`!!document.querySelector('input[autocomplete="username"]')
    || (location.pathname !== "/login" && /Accueil/.test(document.body?.innerText ?? ""))`), 20000);
  await cdp.eval(`(async () => {
    const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true })); };
    const u = document.querySelector('input[autocomplete="username"]'), p = document.querySelector('input[autocomplete="current-password"]');
    if (!u) return; set(u, ${JSON.stringify(account.name)}); set(p, ${JSON.stringify(account.password)});
    (p.form ?? document.querySelector("form")).requestSubmit();
    for (let i = 0; i < 50 && location.pathname === "/login"; i++) await new Promise((r) => setTimeout(r, 200)); })()`);
  await waitFor(() => cdp.eval(`location.pathname !== "/login"`), 15000);
  await sleep(2500);
  check(await cdp.eval(`window.tentacle?.capabilities.includes("audio_play")`), "pont posé : capabilities contient audio_play");

  // --- 1. entrer dans Octave : le front prend le moteur natif ------------------------
  console.log("\n== 1. Entrée dans Octave");
  await go(cdp, "/octave");
  const start = await waitFor(() => relayed.calls.find((c) => c.channel === "audio_engine_start"), 15000);
  check(start && start.args.serverOrigin === origin && "X-Emby-Token" in start.args.headers,
    `audio_engine_start (serveur ${start?.args.serverOrigin}, en-tête X-Emby-Token)`);
  await waitFor(() => cdp.eval(`!![...document.querySelectorAll("button")].find(b => b.getAttribute("aria-label") === "Lire Sans Blanc")`), 15000);

  // --- 2. lire un album ---------------------------------------------------------------
  console.log("\n== 2. « Lire Sans Blanc » : lecture, mini-lecteur, suivant préparé");
  await env.sync();
  let mark = relayed.calls.length, evMark = relayed.events.length;
  check(await click("Lire Sans Blanc"), "clic « Lire Sans Blanc »");
  const play = await waitFor(() => callsSince(mark, "audio_play")[0]);
  check(play && play.args.source.url.startsWith(`${origin}/api/music/stream/`) && play.args.track.trackKey.startsWith("jf:"),
    `audio_play ${play?.args.track.trackKey} ← ${play?.args.source.url.replace(origin, "")}`);
  check(await waitFor(() => lastState()?.status === "playing"), "moteur : playing");
  check(await waitFor(async () => (await dock()).includes("Fil Un")), `mini-lecteur : « ${(await dock()).slice(0, 80)} »`);
  const next = await waitFor(() => callsSince(mark, "audio_set_next").find((c) => c.args.track));
  check(next && !next.args.crossfadeMs, `audio_set_next préparé (fondu ${next?.args.crossfadeMs ?? 0} ms : album dans l'ordre)`);

  // --- 3. enchaînement sans blanc -----------------------------------------------------
  console.log("\n== 3. Enchaînement Fil Un → Fil Deux par le moteur");
  const adv = await waitFor(() => eventSince(evMark, "advanced"), 12000);
  check(adv && adv.fromKey === play?.args.track.trackKey, `advanced ${adv?.fromKey} → ${adv?.toKey}`);
  check(await waitFor(async () => (await dock()).includes("Fil Deux")), "mini-lecteur suit : Fil Deux");
  check(!relayed.events.slice(evMark).some((e) => e.type === "state" && e.state.status === "loading" && e.state.trackKey === adv?.toKey),
    "aucun « loading » au passage (sans blanc)");

  // --- 4. pause / reprise par le mini-lecteur --------------------------------------
  console.log("\n== 4. Pause / reprise");
  await sleep(1500);  // en pleine lecture, pas au premier instant du titre
  await env.sync();
  mark = relayed.calls.length;
  check(await click("Pause", true), "clic Pause");
  check(await waitFor(() => callsSince(mark, "audio_control").find((c) => c.args.action === "pause")), "audio_control pause");
  check(await waitFor(() => lastState()?.status === "paused"), "moteur : paused");
  const a = await timePos(); await sleep(1200); const b = await timePos();
  check(Math.abs(b - a) < 0.05, `time-pos immobile en pause (${a?.toFixed(3)} → ${b?.toFixed(3)})`);
  check(await click("Lecture", true), "clic Lecture");
  check(await waitFor(() => lastState()?.status === "playing"), "moteur : playing");

  // --- 5. seek par la barre de progression ----------------------------------------
  console.log("\n== 5. Seek par la barre");
  await env.sync();
  mark = relayed.calls.length;
  const box = await cdp.eval(`(() => { const s = document.querySelector("[data-octave-dock] [role=slider], [data-octave-dock] input[type=range]");
    if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; })()`);
  if (check(!!box, "barre de progression trouvée")) {
    const x = box.x + box.w * 0.6;
    // Sans image peinte (session macOS verrouillée : plus de vsync, donc plus de BeginFrame,
    // ni rAF ni peinture), Chromium jette les appuis — de CDP comme du vrai chemin SDL — et ne
    // laisse passer que le survol. Le geste est alors rejoué dans la page, au même point.
    const painting = await cdp.eval(`Promise.race([new Promise((r) => requestAnimationFrame(() => r(true))),
      new Promise((r) => setTimeout(() => r(false), 1000))])`);
    if (painting) {
      for (const type of ["mousePressed", "mouseReleased"])
        await cdp.send("Input.dispatchMouseEvent", { type, x, y: box.y, button: "left", clickCount: 1 });
    } else {
      console.log("   ℹ︎ aucune image peinte (session macOS verrouillée ?) : geste rejoué dans la page");
      await cdp.eval(`(() => { const s = document.querySelector("[data-octave-dock] input[type=range]");
        for (const type of ["pointerdown", "pointerup"])
          s.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 1,
            pointerType: "mouse", isPrimary: true, button: 0, buttons: type === "pointerdown" ? 1 : 0,
            clientX: ${x}, clientY: ${box.y} }));
        return true; })()`);
    }
    const seek = await waitFor(() => callsSince(mark, "audio_control").find((c) => c.args.action === "seek"), 3000);
    await sleep(600);
    const pos = await timePos();
    check(seek && Math.abs(pos - seek.args.value / 1000) < 1.2, `audio_control seek ${seek?.args.value} ms → time-pos ${pos?.toFixed(2)} s`);
  }

  // --- 6. suivant ---------------------------------------------------------------------
  console.log("\n== 6. Suivant (mini-lecteur)");
  await env.sync();
  mark = relayed.calls.length; evMark = relayed.events.length;
  check(await click("Suivant", true), "clic Suivant");
  check(await waitFor(async () => (await dock()).includes("Fil Trois")), "mini-lecteur : Fil Trois");
  // Le mini-lecteur change de titre AVANT que le front n'appelle le moteur : on attend l'appel.
  const how = await waitFor(() => callsSince(mark, "audio_play").length ? "audio_play"
    : eventSince(evMark, "advanced") ? "advanced" : null, 3000) ?? "?";
  check(how !== "?", `passé par ${how}`);
  check(await waitFor(() => lastState()?.status === "ended", 12000), "fin de file : ended");

  // --- 7. une vidéo démarre pendant la musique ------------------------------------
  console.log("\n== 7. Réclamation par une vidéo");
  await click("Lire Sans Blanc");
  check(await waitFor(() => lastState()?.status === "playing"), "musique relancée");
  await env.sync();
  evMark = relayed.events.length;
  check((await env.claim()) === true, "videoClaim : la musique jouait");
  check(await waitFor(() => eventSince(evMark, "remote")), "remote pause envoyé à la page");
  check(await waitFor(() => cdp.eval(`!![...document.querySelectorAll("[data-octave-dock] button")].find(b => b.getAttribute("aria-label") === "Lecture")`)),
    "le mini-lecteur montre « Lecture » (le front s'est mis en pause)");
  check((await env.prop("pause")) === true, "mpv : pause=yes");

  // --- 8. quitter Octave, revenir -------------------------------------------------
  console.log("\n== 8. Quitter Octave puis revenir");
  await env.sync();
  mark = relayed.calls.length;
  // La sortie du front (« retour aux films », `OctaveModeSlot`) : navigation interne, sans rechargement.
  check(await cdp.eval(`(() => { const e = document.querySelector("[data-octave-back-to-films]"); if (!e) return false; e.click(); return true; })()`),
    "clic « retour aux films »");
  check(await waitFor(() => callsSince(mark, "audio_engine_stop")[0], 8000), "en quittant Octave : audio_engine_stop (instance détruite)");
  check((await env.prop("pause")) === null, "plus de cœur mpv musique");
  await env.sync();
  mark = relayed.calls.length;
  await go(cdp, "/octave");
  check(await waitFor(() => callsSince(mark, "audio_engine_start")[0], 15000), "au retour : audio_engine_start");
  await waitFor(async () => (await dock()).includes("Fil"), 8000);
  check(callsSince(mark, "audio_play").length === 0, `reprise EN PAUSE, sans son : « ${(await dock()).slice(0, 60)} »`);

  console.log(`\n${failures === 0 ? "✅" : "❌"} ${failures} échec(s) ; appels du front : ${
    JSON.stringify(Object.entries(relayed.calls.reduce((m, c) => ((m[c.channel] = (m[c.channel] ?? 0) + 1), m), {})))}`);
  await env.sync();
  return failures;
}
