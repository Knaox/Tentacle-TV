import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  desktopEntry,
  forgetVideoWindowIdentity,
  mpvWindowTitle,
  prepareVideoWindowIdentity,
  videoWindowAppId,
} from "./videoWindowIdentity";

/**
 * L'identité de la fenêtre vidéo dans Alt+Tab : ce qui se garde, c'est que
 * KWin retrouve NOTRE icône par l'app-id (un chemin absolu vers un `.desktop`
 * que nous écrivons), que le titre survive au développement `${…}` de mpv, et
 * qu'un échec d'écriture rende la main à l'app-id « mpv » sans rien casser.
 */

let root: string;

beforeEach(() => {
  forgetVideoWindowIdentity();
  root = mkdtempSync(path.join(tmpdir(), "tentacle-identite-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("desktopEntry", () => {
  it("un .desktop minimal, jamais affiché, l'icône par chemin absolu", () => {
    const entry = desktopEntry("/home/a b/.config/Tentacle TV/video-window/tentacle-tv-video.png");
    expect(entry.startsWith("[Desktop Entry]\n")).toBe(true);
    expect(entry).toContain("Type=Application\n");
    expect(entry).toContain("NoDisplay=true\n");
    expect(entry).toContain("Icon=/home/a b/.config/Tentacle TV/video-window/tentacle-tv-video.png\n");
  });

  it("échappe la barre oblique inverse, qu'un .desktop lit comme un échappement", () => {
    expect(desktopEntry("/tmp/a\\b.png")).toContain("Icon=/tmp/a\\\\b.png");
  });

  it("sans icône source, pas de ligne Icon — KWin retombe sur la sienne", () => {
    expect(desktopEntry(null)).not.toContain("Icon=");
  });
});

describe("mpvWindowTitle", () => {
  it("reprend le titre de notre fenêtre", () => {
    expect(mpvWindowTitle("Tentacle TV")).toBe("Tentacle TV");
  });

  it("double le $ — mpv développe ${…} dans son option title", () => {
    expect(mpvWindowTitle("Prix: $5 ${media-title}")).toBe("Prix: $$5 $${media-title}");
  });

  it("un titre vide n'est jamais transmis : il voudrait dire « garée » pour la colle", () => {
    expect(mpvWindowTitle("")).toBe("Tentacle TV");
    expect(mpvWindowTitle("   ")).toBe("Tentacle TV");
  });
});

describe("prepareVideoWindowIdentity", () => {
  it("écrit le .desktop et l'icône, rend l'app-id — le chemin SANS l'extension", () => {
    const icon = path.join(root, "icon.png");
    writeFileSync(icon, "png");
    const folder = path.join(root, "video-window");
    const appId = prepareVideoWindowIdentity(folder, icon);
    expect(appId).toBe(path.join(folder, "tentacle-tv-video"));
    // KWin cherche `<app-id>.desktop` quand l'app-id est un chemin absolu.
    const desktop = readFileSync(`${appId ?? ""}.desktop`, "utf8");
    expect(desktop).toContain(`Icon=${path.join(folder, "tentacle-tv-video.png")}`);
    expect(readFileSync(path.join(folder, "tentacle-tv-video.png"), "utf8")).toBe("png");
    expect(videoWindowAppId()).toBe(appId);
  });

  it("une fois par processus : le second appel ne réécrit rien", () => {
    const folder = path.join(root, "video-window");
    const first = prepareVideoWindowIdentity(folder, null);
    rmSync(folder, { recursive: true, force: true });
    expect(prepareVideoWindowIdentity(folder, null)).toBe(first);
    expect(existsSync(folder)).toBe(false);
  });

  it("écriture impossible : null, et mpv garde son app-id « mpv »", () => {
    const blocker = path.join(root, "fichier");
    writeFileSync(blocker, "");
    expect(prepareVideoWindowIdentity(path.join(blocker, "video-window"), null)).toBeNull();
    expect(videoWindowAppId()).toBeNull();
  });
});
