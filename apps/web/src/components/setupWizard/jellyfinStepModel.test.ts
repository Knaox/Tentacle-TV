import { describe, expect, it } from "vitest";
import { jellyfinStepStatus, localInstallBusy, manualFormOpen, manualUrlExample, showNoneFound, type JellyfinStepInput } from "./jellyfinStepModel";
import type { LocalJellyfinView } from "./localJellyfinModel";

/**
 * L'écran Jellyfin dit son état RÉEL : jamais « Choisissez un Jellyfin dans
 * la liste » sans liste, jamais « aucun trouvé » pendant une installation
 * guidée, jamais un exemple Docker hors de Docker.
 */
const installing: LocalJellyfinView = { kind: "install", progress: { stage: "installer", message: { key: "install_installing" }, percent: null } };
const downloading: LocalJellyfinView = { kind: "install", progress: { stage: "download", message: { key: "install_resolving" }, percent: null } };
const startingAfterInstall: LocalJellyfinView = { kind: "install", progress: { stage: "start", message: { key: "install_done" }, percent: null } };

const input = (over: Partial<JellyfinStepInput> = {}): JellyfinStepInput => ({
  chosen: false,
  local: null,
  serverCount: 0,
  searching: false,
  stackStarting: false,
  installGuide: true,
  ...over,
});

describe("la phrase du pied de l'écran Jellyfin", () => {
  it("un Jellyfin choisi : rien, le bouton dit la suite", () => {
    expect(jellyfinStepStatus(input({ chosen: true, serverCount: 1 }))).toBeNull();
  });

  it("une liste sans choix : « choisissez dans la liste »", () => {
    expect(jellyfinStepStatus(input({ serverCount: 2 }))).toBe("pickFirst");
  });

  it("une installation guidée en cours : attendre sa fin, même si une recherche tourne", () => {
    expect(jellyfinStepStatus(input({ local: installing, searching: true }))).toBe("waitInstall");
    expect(jellyfinStepStatus(input({ local: downloading }))).toBe("waitInstall");
  });

  it("Jellyfin démarre (après l'installation, ou par le bouton) : il va apparaître", () => {
    expect(jellyfinStepStatus(input({ local: startingAfterInstall }))).toBe("waitStart");
    expect(jellyfinStepStatus(input({ local: { kind: "starting" } }))).toBe("waitStart");
  });

  it("la pile démarre son Jellyfin, ou une recherche tourne : on attend", () => {
    expect(jellyfinStepStatus(input({ stackStarting: true }))).toBe("waitStack");
    expect(jellyfinStepStatus(input({ searching: true }))).toBe("searching");
    expect(jellyfinStepStatus(input({ local: { kind: "checking" } }))).toBe("searching");
  });

  it("rien trouvé : installer ou donner l'adresse ; arrêté : le démarrer ou donner l'adresse", () => {
    expect(jellyfinStepStatus(input({ local: { kind: "installOffer" } }))).toBe("installOrAddress");
    expect(jellyfinStepStatus(input({ local: { kind: "installFailed", failure: "cancelled" } }))).toBe("installOrAddress");
    expect(jellyfinStepStatus(input())).toBe("installOrAddress");
    expect(jellyfinStepStatus(input({ local: { kind: "stoppedTray", afterInstall: false } }))).toBe("startOrAddress");
    expect(jellyfinStepStatus(input({ local: { kind: "stoppedService" } }))).toBe("startOrAddress");
    expect(jellyfinStepStatus(input({ installGuide: false }))).toBe("address");
  });
});

describe("ce qui se tait pendant une installation guidée", () => {
  it("« aucun trouvé » ne paraît jamais pendant l'installation ni le démarrage", () => {
    expect(localInstallBusy(installing)).toBe(true);
    expect(localInstallBusy({ kind: "starting" })).toBe(true);
    expect(localInstallBusy({ kind: "installOffer" })).toBe(false);
    expect(showNoneFound(true, installing)).toBe(false);
    expect(showNoneFound(true, { kind: "starting" })).toBe(false);
    expect(showNoneFound(true, { kind: "installOffer" })).toBe(true);
    expect(showNoneFound(true, null)).toBe(true);
    expect(showNoneFound(false, null)).toBe(false);
  });

  it("la saisie de l'adresse : dépliée quand rien n'est trouvé, repliée pendant l'installation sauf si on l'ouvre", () => {
    expect(manualFormOpen(false, true, null)).toBe(true);
    expect(manualFormOpen(false, true, installing)).toBe(false);
    expect(manualFormOpen(true, true, installing)).toBe(true);
    expect(manualFormOpen(false, false, null)).toBe(false);
  });
});

describe("l'exemple d'adresse selon la plateforme du serveur", () => {
  it("app Windows : localhost, jamais Docker", () => {
    expect(manualUrlExample({ deployment: "native", packaging: "windows-app" })).toEqual({ hintKey: "jfUrlHintWindows", placeholder: "http://localhost:8096" });
  });

  it("Docker : host.docker.internal (la clé historique)", () => {
    expect(manualUrlExample({ deployment: "docker" }).hintKey).toBe("jfUrlHint");
  });

  it("natif, ou contexte encore inconnu : l'adresse IP, rien de Docker", () => {
    expect(manualUrlExample({ deployment: "native" }).hintKey).toBe("jfUrlHintNative");
    expect(manualUrlExample(null).hintKey).toBe("jfUrlHintNative");
  });
});
