// window.tentacle — le pont que le front de Tentacle attend de sa coquille de bureau.
//
// Injecté par le socle (`registerInjectedScript`) dans la frame PRINCIPALE, avant tout
// script de la page : le front détecte la coquille une seule fois, au chargement
// (`apps/web/src/desktop/detect.ts`). Même forme que le preload d'Electron
// (`apps/desktop-electron/src/preload/index.ts`), pour ne rien changer au front.
//
// Générique : il ne connaît AUCUNE commande. Le natif (src/bridge/) lui donne, au
// démarrage, la liste de ce qui est réellement branché — pont ET octave — et le shim
// relaie `invoke(c)` vers `__shell.invoke("tentacle:" + c)`. Une commande absente de la
// liste est refusée, comme la liste fermée d'Electron (`main/channels.ts`) : le front
// masque alors la fonctionnalité au lieu d'afficher un bouton mort.
//
// Le jeton de la dernière ligne (UNE seule occurrence dans ce fichier : le natif la
// remplace une fois) devient un objet JSON, sérialisé par la bibliothèque JSON du
// natif, jamais à la main :
//   { origins, serverUrl, version, platform, titleBarHeight, windowFocus, montage, windowing,
//     liquidGlass, commands, events }
(function installTentacleBridge(config) {
  "use strict";
  if (window.top !== window) return; // greffons en iframe : jamais de pont
  if (!config.origins.includes(window.location.origin)) return; // seulement le serveur choisi
  const shell = window.__shell;
  if (!shell || typeof shell.invoke !== "function" || typeof shell.on !== "function") {
    console.error("[tentacle-bridge] __shell absent : pont non posé, le front sera en mode web");
    return;
  }

  const commands = Object.freeze([...config.commands]);
  const commandSet = new Set(commands);
  const eventSet = new Set(config.events);
  const PREFIX = "tentacle:";

  // Le front, chargé DEPUIS le serveur, se croit sur le bureau et lit l'adresse du
  // serveur dans `tentacle_server_url` (`lib/backendBase.ts`) — sans elle, écran
  // « adresse du serveur ». Même origine : on la pose avant la page, comme le preload
  // restaure son stockage. Jamais d'écrasement d'une valeur déjà là. Front embarqué
  // (tentacle://app, profil d'Electron) : `serverUrl` est vide sauf --server-url, le
  // stockage d'Electron porte déjà l'adresse.
  try {
    if (config.serverUrl && localStorage.getItem("tentacle_server_url") === null) {
      localStorage.setItem("tentacle_server_url", config.serverUrl);
    }
  } catch (e) {
    console.warn("[tentacle-bridge] stockage local indisponible", e);
  }

  // Le focus de la FENÊTRE vu par le natif (`windowFocusBridge.ts` d'Electron), macOS
  // seulement : la page ternit la fenêtre inactive à la façon du système, et
  // `document.hasFocus()` ment. Sans lecture synchrone possible ici, la valeur de départ
  // (inactive) est corrigée par une lecture asynchrone au chargement, puis suivie à chaque
  // changement ; un abonné ne reçoit que les CHANGEMENTS.
  function createWindowFocus() {
    let focused = false;
    const listeners = new Set();
    const apply = (value) => {
      if (typeof value !== "boolean" || value === focused) return;
      focused = value;
      for (const listener of listeners) {
        try {
          listener(value);
        } catch (e) {
          // l'erreur appartient à la page : les autres abonnés reçoivent quand même la nouvelle
        }
      }
    };
    shell.on("lifecycle.windowFocus", apply);
    Promise.resolve(shell.invoke("lifecycle.windowFocus.get", {})).then(apply, () => undefined);
    return Object.freeze({
      isFocused: () => focused,
      subscribe(listener) {
        if (typeof listener !== "function") return () => undefined;
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    });
  }

  // Le verre natif de macOS 26 (`window.tentacle.liquidGlass`, axe verre), ABSENT partout où il
  // n'existe pas : c'est son absence qui cache l'option de Réglages › Apparence
  // (`theme/liquidGlassMode.ts`). Le verdict vient du natif, au démarrage (`src/glass/`). Les
  // changements d'une même tâche partent en UN message, vidé en microtâche (`batcher.ts` du
  // preload d'Electron, à l'identique) : le dernier mot gagne, région par région, et seuls les
  // champs du protocole traversent — le natif revalide tout.
  function createLiquidGlass(settings) {
    const ease = (value) => (Array.isArray(value) ? [...value] : value);
    const pickMaterialize = (m) => ({
      rise: m.rise, scale: m.scale, originX: m.originX, originY: m.originY, delay: m.delay, exit: m.exit,
      enterEase: ease(m.enterEase), exitEase: ease(m.exitEase),
    });
    const pick = (r) => {
      const out = {
        id: r.id, x: r.x, y: r.y, width: r.width, height: r.height, radius: r.radius,
        level: r.level, tint: r.tint, interactive: r.interactive, z: r.z,
      };
      if (r.group !== undefined) out.group = r.group;
      if (r.spacing !== undefined) out.spacing = r.spacing;
      if (r.transition !== undefined) out.transition = r.transition;
      if (r.spring !== undefined) out.spring = { response: r.spring.response, dampingFraction: r.spring.dampingFraction };
      if (r.appearance !== undefined) out.appearance = r.appearance;
      if (r.materialize !== undefined) out.materialize = pickMaterialize(r.materialize);
      return out;
    };
    let enabled;
    const upserts = new Map();
    const removes = new Set();
    let armed = false;
    const flush = () => {
      armed = false;
      if (enabled === undefined && upserts.size === 0 && removes.size === 0) return;
      const batch = { upserts: [...upserts.values()], removes: [...removes] };
      if (enabled !== undefined) batch.enabled = enabled;
      enabled = undefined;
      upserts.clear();
      removes.clear();
      Promise.resolve(shell.invoke("liquidGlass.batch", batch)).catch(() => undefined);
    };
    const arm = () => {
      if (armed) return;
      armed = true;
      queueMicrotask(flush);
    };
    // Un nouveau document : le verre de la page précédente part (`did-navigate` d'Electron).
    Promise.resolve(shell.invoke("liquidGlass.pageStarted", {})).catch(() => undefined);
    return Object.freeze({
      supported: true,
      refractsVideo: settings.refractsVideo === true,
      setEnabled(value) {
        enabled = value === true;
        arm();
      },
      upsert(regions) {
        if (!Array.isArray(regions)) return;
        // La page n'est pas crue sur son type : un `null` dans le tableau est ignoré.
        for (const raw of regions) {
          if (typeof raw !== "object" || raw === null || typeof raw.id !== "string") continue;
          removes.delete(raw.id);
          upserts.set(raw.id, pick(raw));
        }
        arm();
      },
      remove(ids) {
        if (!Array.isArray(ids)) return;
        for (const id of ids) {
          if (typeof id !== "string") continue;
          upserts.delete(id);
          removes.add(id);
        }
        arm();
      },
      // Avec réponse : des nombres seulement, le natif revalide les rectangles.
      sample(rects) {
        return Array.isArray(rects) ? Promise.resolve(shell.invoke("liquidGlass.sample", rects)) : Promise.resolve([]);
      },
    });
  }

  // Un nouveau document : il n'écoute pas encore les liens d'app (`app-link`) — le natif les
  // garde pour `app_link_take` jusqu'à ce qu'il les demande.
  Promise.resolve(shell.invoke("lifecycle.pageStarted", {})).catch(() => undefined);

  function refuse(command) {
    return Promise.reject(new Error(`canal refuse: ${command}`));
  }

  function call(channel, args) {
    // Le rejet natif arrive en { code, message } : on rend une vraie Error, que le
    // front affiche et classe (`playbackFailure.ts` lit `.message`).
    return Promise.resolve(shell.invoke(channel, args)).catch((e) => {
      const message = e && typeof e === "object" && "message" in e ? String(e.message) : String(e);
      throw new Error(message);
    });
  }

  const bridge = {
    invoke(command, args) {
      if (typeof command !== "string" || !commandSet.has(command)) return refuse(command);
      return call(PREFIX + command, args ?? {});
    },
    on(event, handler) {
      if (typeof event !== "string" || !eventSet.has(event) || typeof handler !== "function") {
        return () => undefined;
      }
      // Charge NUE, comme Electron : `desktop/bridge.ts` la ré-enveloppe en { payload }.
      const off = shell.on(PREFIX + event, (payload) => handler(payload));
      return typeof off === "function" ? off : () => undefined;
    },
    version: String(config.version),
    platform: config.platform,
    capabilities: commands,
    titleBarHeight: Number.isFinite(config.titleBarHeight) && config.titleBarHeight > 0 ? config.titleBarHeight : 0,
    // Capacités nommées de la coquille, hors de `capabilities` (comme le preload d'Electron).
    openExternal(url) {
      // Le schéma est filtré côté natif (liste fermée) : une liste blanche dans la page ne
      // protège de rien. Rend `undefined`, ouvert ou refusé.
      return call(PREFIX + "open-external", { url: String(url) }).then(() => undefined);
    },
    pickFolder() {
      return call(PREFIX + "pick-folder", {}).then((path) => (typeof path === "string" ? path : null));
    },
    relaunch() {
      return call(PREFIX + "relaunch", {}).then(() => undefined);
    },
  };
  if (config.windowFocus === true) bridge.windowFocus = createWindowFocus();
  // Linux seulement, et seulement s'ils ont un sens (le preload d'Electron les omet sinon) : le
  // montage vidéo et le fenêtré Wayland. ⚠️ La CLÉ reste `fenetrage` : la page la lit par chaîne.
  if (config.montage === "wayland" || config.montage === "x11") bridge.montage = config.montage;
  if (config.windowing === "libre" || config.windowing === "plein-ecran") bridge.fenetrage = config.windowing;
  if (config.liquidGlass !== null && typeof config.liquidGlass === "object") bridge.liquidGlass = createLiquidGlass(config.liquidGlass);

  Object.defineProperty(window, "tentacle", {
    value: Object.freeze(bridge),
    writable: false,
    enumerable: false,
    configurable: false,
  });
})(__TENTACLE_SHIM_CONFIG__);
