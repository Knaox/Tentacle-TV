// Surcouche de mise à jour — injectée par le natif (src/update/update_shell.cpp) dans la
// frame principale, comme le shim du pont, mais HORS de window.tentacle : le front de
// Tentacle n'en sait rien et n'a rien à changer.
//
// Ce qu'elle montre vient de l'instantané natif (`update.state`) :
//   prompt "toast"    → une notification discrète en bas à droite (verre sombre), qui
//                       ATTEND la fin d'une lecture (vidéo ou musique) pour paraître ;
//   prompt "blocking" → la mise à jour de sécurité : un voile qui bloque l'app tout de
//                       suite, lecture comprise, sans bouton pour la masquer ;
//   prompt "none"     → rien (mineure : installée en silence au prochain redémarrage).
// Les fonctions pures (viewFor, toastModel…) sont testées par bench/update/overlay.test.mjs.
(function installUpdateOverlay(global) {
  "use strict";
  const TEXT = {
    fr: {
      arriving: (v) => `Tentacle ${v} arrive`, downloading: "Téléchargement en arrière-plan…",
      preparing: "Préparation de la mise à jour…", ready: (v) => `Tentacle ${v} est prête`,
      readyBody: "Redémarrez quand vous voulez : la mise à jour s'installe en quelques secondes.",
      restart: "Redémarrer pour mettre à jour", restarting: "Redémarrage…", later: "Plus tard",
      mute: "Ne plus m'avertir jusqu'à la prochaine grosse mise à jour", notes: "Nouveautés",
      secTitle: "Mise à jour de sécurité requise",
      secBody: (v) => `Cette version de Tentacle a un problème de sécurité, corrigé dans la ${v}. Il faut l'installer pour continuer.`,
      secInstall: "Redémarrer et installer", secWait: "Téléchargement…",
      pendingTitle: "Mise à jour de sécurité en attente",
      pendingBody: "Pas de réseau pour l'instant : elle s'installera dès son retour. Vous pouvez continuer.",
      corrupt: "Le téléchargement était abîmé : nouvel essai dans quelques minutes.", retry: "Réessayer",
      retrying: "Nouvel essai de téléchargement… Vous pouvez continuer en attendant.",
      manualBody: (v) => `Elle ne peut pas s'installer toute seule ici. Installez Tentacle ${v} depuis tentacle.tv.`,
      moveApp: "Déplacez d'abord Tentacle dans le dossier Applications.",
      backTitle: "Mise à jour annulée", ok: "OK",
      backBody: (v) => `Tentacle ${v} n'a pas pu démarrer : la version précédente a été remise.`,
      close: "Fermer (plus tard)",
    },
    en: {
      arriving: (v) => `Tentacle ${v} is on its way`, downloading: "Downloading in the background…",
      preparing: "Preparing the update…", ready: (v) => `Tentacle ${v} is ready`,
      readyBody: "Restart whenever you like: the update installs in a few seconds.",
      restart: "Restart to update", restarting: "Restarting…", later: "Later",
      mute: "Don't remind me until the next major update", notes: "What's new",
      secTitle: "Security update required",
      secBody: (v) => `This version of Tentacle has a security issue, fixed in ${v}. It must be installed to continue.`,
      secInstall: "Restart and install", secWait: "Downloading…",
      pendingTitle: "Security update pending",
      pendingBody: "No network right now: it will install as soon as you are back online. You can keep going.",
      corrupt: "The download was damaged: retrying in a few minutes.", retry: "Retry",
      retrying: "Retrying the download… You can keep going meanwhile.",
      manualBody: (v) => `It can't install itself here. Please install Tentacle ${v} from tentacle.tv.`,
      moveApp: "First move Tentacle to the Applications folder.",
      backTitle: "Update rolled back", ok: "OK",
      backBody: (v) => `Tentacle ${v} could not start: the previous version was restored.`,
      close: "Close (later)",
    },
  };

  // --- Logique pure ---------------------------------------------------------------------
  function pickLang(htmlLang, stored, navLang) {
    const l = String(htmlLang || stored || navLang || "fr").toLowerCase();
    return l.startsWith("fr") ? "fr" : "en";
  }

  // Une lecture en cours ? Le lecteur vidéo du front (/watch/…), mpv qui joue, Octave qui joue.
  function isBusy(ctx) {
    return String(ctx.path || "").startsWith("/watch") || !!ctx.video || !!ctx.audio;
  }

  // "none" | "toast" | "blocking" | "rolledBack" | "waiting" (une notification attend la fin de la lecture)
  function viewFor(s, ctx) {
    if (!s) return "none";
    if (s.prompt === "blocking") return "blocking";  // la sécurité n'attend pas
    const wants = s.rolledBack && !ctx.rolledBackSeen ? "rolledBack" : s.prompt === "toast" ? "toast" : "none";
    if (wants === "none") return "none";
    return isBusy(ctx) ? "waiting" : wants;
  }

  function noteLines(notes, lang) {
    const text = (notes && (notes[lang] || notes.fr || notes.en)) || "";
    return text.split("\n").map((l) => l.replace(/^\s*[•\-*]\s*/, "").trim()).filter(Boolean).slice(0, 4);
  }

  // Ce que dit la notification. progress : nombre 0..1, "sweep" (inconnu) ou null.
  function toastModel(s, lang) {
    const t = TEXT[lang], u = s.update || {}, v = u.version || "";
    const notes = u.notesUrl ? [{ label: t.notes, action: "notes" }] : [];
    if (s.rolledBack && !u.mandatory) {
      return { kind: "back", warn: true, title: t.backTitle, body: t.backBody(s.rolledBack), progress: null,
        primary: { label: t.ok, action: "ack" }, secondary: null, links: [], lines: [] };
    }
    if (u.mandatory) {  // obligatoire qui ne peut pas bloquer : hors ligne, archive refusée, impossible ici
      const manual = !u.install || String(s.error).startsWith("cannot-install") || String(s.error).startsWith("stage");
      // Nouvel essai en cours (sans voile depuis le premier échec) : on montre sa progression.
      const busy = ["downloading", "verifying", "staging"].includes(s.phase);
      const progress = !busy ? null : s.phase === "downloading" && typeof s.progress === "number" ? s.progress : "sweep";
      const body = manual ? (String(s.error).includes("translocated") ? t.moveApp + " " : "") + t.manualBody(v)
        : busy ? t.retrying : s.error === "checksum" ? t.corrupt : t.pendingBody;
      return { kind: manual ? "manual" : "pending", warn: true, title: manual ? t.secTitle : t.pendingTitle, body,
        progress, primary: manual || busy ? null : { label: t.retry, action: "retry" }, secondary: null,
        links: notes, lines: [], closable: false };
    }
    const ready = s.phase === "ready", applying = s.phase === "applying";
    const progress = s.phase === "downloading" ? (typeof s.progress === "number" ? s.progress : "sweep")
      : s.phase === "verifying" || s.phase === "staging" ? "sweep" : null;
    return {
      kind: "major", warn: false, title: ready || applying ? t.ready(v) : t.arriving(v),
      body: applying ? t.restarting : ready ? t.readyBody : progress === "sweep" && s.phase !== "downloading" ? t.preparing : t.downloading,
      progress, lines: noteLines(u.notes, lang), closable: true,
      primary: ready || applying ? { label: applying ? t.restarting : t.restart, action: "restart", disabled: applying } : null,
      secondary: { label: t.later, action: "later" },
      links: (s.canMute ? [{ label: t.mute, action: "mute" }] : []).concat(notes),
    };
  }

  function blockingModel(s, lang) {
    const t = TEXT[lang], u = s.update || {}, ready = s.phase === "ready";
    const why = u.why && (u.why[lang] || u.why.fr || u.why.en);
    return { title: t.secTitle, body: why || t.secBody(u.version || ""),
      progress: ready || s.phase === "applying" ? null : typeof s.progress === "number" && s.phase === "downloading" ? s.progress : "sweep",
      primary: { label: ready ? t.secInstall : s.phase === "applying" ? t.restarting : t.secWait, action: "restart", disabled: !ready },
      links: u.notesUrl ? [{ label: t.notes, action: "notes" }] : [] };
  }

  const api = { pickLang, isBusy, viewFor, noteLines, toastModel, blockingModel, TEXT };
  if (typeof module === "object" && module.exports) module.exports = api;  // tests Node
  if (typeof window === "undefined" || window.top !== window || !window.__shell) return;

  // --- DOM ------------------------------------------------------------------------------
  const shell = window.__shell;
  const CSS = `__UPDATE_CSS__`;
  const ICON = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };
  const ctx = { path: "", video: false, audio: false, rolledBackSeen: false };
  let snapshot = null, host = null, layer = null, shownKey = "", poll = 0;

  function lang() {
    let stored = null;
    try { stored = localStorage.getItem("i18nextLng"); } catch (e) { /* stockage indisponible */ }
    return pickLang(document.documentElement.lang, stored, navigator.language);
  }

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "html") el.innerHTML = v; else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else if (v !== false && v != null) el.setAttribute(k, v);
    }
    for (const c of children || []) if (c) el.append(c);
    return el;
  }

  function act(action) {
    if (action === "ack") ctx.rolledBackSeen = true;
    const channel = { ack: "update.dismissNotice", restart: "update.restart", later: "update.later", mute: "update.mute",
      notes: "update.openNotes", retry: "update.check" }[action];
    if (channel) shell.invoke(channel, {}).catch((e) => console.warn("[maj]", e && e.message));
    if (action === "ack") render();
  }

  function button(b, cls) {
    return b && h("button", { class: cls, type: "button", disabled: b.disabled ? "" : false, "data-action": b.action,
      text: b.label, onclick: () => act(b.action) });
  }

  function progressBar(p) {
    if (p === null || p === undefined) return null;
    const fill = h("div", { class: p === "sweep" ? "fill sweep" : "fill" });
    if (p !== "sweep") fill.style.width = `${Math.round(p * 100)}%`;
    return h("div", { class: "progress wide", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100",
      "aria-valuenow": p === "sweep" ? false : String(Math.round(p * 100)) },
      [h("div", { class: "track" }, [fill]), p === "sweep" ? null : h("span", { class: "pct", text: `${Math.round(p * 100)} %` })]);
  }

  function links(list) {
    return list.length ? h("div", { class: "links wide" }, list.map((l) => button(l, "link"))) : null;
  }

  function buildToast(m) {
    const t = TEXT[lang()];
    return h("section", { class: "glass toast", role: "status", "aria-live": "polite", "data-kind": m.kind, "data-entering": "" }, [
      h("div", { class: m.warn ? "icon warn" : "icon", "aria-hidden": "true", html: m.warn ? ICON.shield : ICON.up }),
      h("div", { class: "text" }, [h("p", { class: "title", text: m.title }), h("p", { class: "body", text: m.body })]),
      m.closable ? h("button", { class: "close", type: "button", "aria-label": t.close, html: ICON.x, onclick: () => act("later") }) : h("span"),
      progressBar(m.progress),
      m.lines.length ? h("ul", { class: "notes wide" }, m.lines.map((l) => h("li", { text: l }))) : null,
      m.primary || m.secondary ? h("div", { class: "actions wide" }, [button(m.secondary, "btn ghost"), button(m.primary, "btn primary")]) : null,
      links(m.links),
    ]);
  }

  function buildBlocking(m) {
    return h("div", { class: "scrim" }, [h("section", { class: "glass dialog", role: "alertdialog", "aria-modal": "true",
      "aria-labelledby": "maj-title", "aria-describedby": "maj-body" }, [
      h("div", { class: "head" }, [h("div", { class: "icon warn", "aria-hidden": "true", html: ICON.shield }),
        h("p", { class: "title", id: "maj-title", text: m.title })]),
      h("p", { class: "body", id: "maj-body", text: m.body }),
      progressBar(m.progress),
      h("div", { class: "actions" }, [button(m.primary, "btn primary")]),
      links(m.links),
    ])]);
  }

  function mount() {
    if (host || !document.body) return !!host;
    host = h("tentacle-update", { "data-tentacle": "update" });
    const root = host.attachShadow({ mode: "open" });
    // Feuille construite : hors de portée d'une CSP `style-src` stricte du serveur (le banc
    // n'en envoie pas, une prod pourrait) ; <style> en repli.
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet];
    } catch (e) {
      root.append(h("style", { text: CSS }));
    }
    layer = h("div", { class: "layer" });
    root.append(layer);
    document.body.append(host);
    return true;
  }

  function render() {
    ctx.path = location.pathname;
    const view = viewFor(snapshot, ctx);
    clearInterval(poll);
    // Le front change de route sans évènement : on la relit chaque seconde tant qu'une
    // notification est montrée ou attend (une lecture qui commence la fait s'effacer).
    if (view === "waiting" || view === "toast" || view === "rolledBack") poll = setInterval(render, 1000);
    if (!mount()) return;
    host.dataset.view = view;
    if (view === "none" || view === "waiting") {
      const old = layer.firstElementChild;
      shownKey = "";
      if (old && old.classList.contains("toast")) { old.setAttribute("data-leaving", ""); setTimeout(() => old.remove(), 180); }
      else if (old) old.remove();
      return;
    }
    const model = view === "blocking" ? blockingModel(snapshot, lang()) : toastModel(snapshot, lang());
    // La progression seule change : mise à jour sur place (le focus clavier reste où il est).
    const p = model.progress;
    const key = view + "|" + JSON.stringify({ ...model, progress: typeof p === "number" ? "n" : p });
    if (key === shownKey) {
      const fill = layer.querySelector(".fill:not(.sweep)"), pct = layer.querySelector(".pct");
      if (fill && typeof p === "number") fill.style.width = `${Math.round(p * 100)}%`;
      if (pct && typeof p === "number") pct.textContent = `${Math.round(p * 100)} %`;
      return;
    }
    const first = !shownKey;
    shownKey = key;
    const el = view === "blocking" ? buildBlocking(model) : buildToast(model);
    layer.replaceChildren(el);
    if (first && el.hasAttribute("data-entering")) requestAnimationFrame(() => requestAnimationFrame(() => el.removeAttribute("data-entering")));
    else el.removeAttribute("data-entering");
    if (view === "blocking") { const b = el.querySelector(".btn"); if (b && !b.disabled) b.focus(); }
  }

  // La mise à jour de sécurité ne laisse pas la page réagir au clavier (Tab reste dans le voile).
  window.addEventListener("keydown", (e) => {
    if (!host || host.dataset.view !== "blocking" || e.composedPath().includes(host)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const b = layer.querySelector(".btn");
    if (b) b.focus();
  }, true);

  shell.on("update.state", (s) => { snapshot = s; render(); });
  shell.on("tentacle:mpv://event", (e) => {
    const name = e && e.event;
    if (name === "start-file" || name === "file-loaded" || name === "playback-restart") ctx.video = true;
    else if (name === "end-file" || name === "shutdown") ctx.video = false;
    render();
  });
  shell.on("tentacle:audio://event", (e) => {
    if (e && e.type === "state") { ctx.audio = e.state === "playing" || e.state === "buffering"; render(); }
  });
  document.addEventListener("DOMContentLoaded", render);
  shell.invoke("update.state", {}).then((s) => { snapshot = s; render(); }).catch(() => {});
})(this);
