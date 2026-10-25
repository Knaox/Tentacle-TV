import { describe, expect, it } from "vitest";
import { resolve } from "path";
import { validateYtDlpArgs } from "./ytDlpPolicy";

const DATA = resolve("/srv/tentacle/data/plugins/sillon/data");

describe("politique yt-dlp d'une extension", () => {
  it("impose la configuration ignorée, le dossier de données et aucun --exec", () => {
    const result = validateYtDlpArgs(["-J", "--no-playlist", "https://example.org/watch?v=1"], DATA);
    expect(result).toEqual({
      ok: true,
      args: ["--ignore-config", "--no-exec", "-P", DATA, "--cache-dir", resolve(DATA, ".yt-dlp-cache"), "-J", "--no-playlist", "--", "https://example.org/watch?v=1"],
    });
  });

  it("refuse tout ce qui lance un programme, lit une configuration ou charge du code", () => {
    for (const args of [
      ["--exec", "rm -rf /", "https://x.org/a"],
      ["--exec=touch /tmp/x"],
      ["--config-location", "/etc/passwd"],
      ["--plugin-dirs", "/tmp"],
      ["--external-downloader", "curl"],
      ["--netrc-cmd", "cat /etc/shadow"],
      ["-U"],
      ["--ffmpeg-location", "/tmp/evil"],
      ["--use-postprocessor", "Exec:exec=id"],
      ["--enable-file-urls", "file:///etc/passwd"],
      ["-P", "/"],
      ["--js-runtimes", "node:/tmp/evil"],
    ]) {
      const result = validateYtDlpArgs(args, DATA);
      expect(result.ok, args.join(" ")).toBe(false);
    }
  });

  it("refuse une option inconnue, plutôt que de la laisser passer", () => {
    expect(validateYtDlpArgs(["--some-new-option", "x"], DATA)).toEqual({ ok: false, reason: "option inconnue : --some-new-option" });
  });

  it("n'accepte en argument qu'une URL http(s) ou une recherche", () => {
    expect(validateYtDlpArgs(["file:///etc/passwd"], DATA).ok).toBe(false);
    expect(validateYtDlpArgs(["/etc/passwd"], DATA).ok).toBe(false);
    expect(validateYtDlpArgs(["ytsearch5:daft punk"], DATA).ok).toBe(true);
    expect(validateYtDlpArgs(["scsearch:nils frahm"], DATA).ok).toBe(true);
  });

  it("force les chemins sous le dossier de données", () => {
    expect(validateYtDlpArgs(["--load-info-json", "../../tentacle.db"], DATA).ok).toBe(false);
    expect(validateYtDlpArgs(["--cookies", "/etc/passwd"], DATA).ok).toBe(false);
    const ok = validateYtDlpArgs(["--load-info-json", "cache/a.json"], DATA);
    expect(ok.ok && ok.args).toContain(resolve(DATA, "cache/a.json"));
  });

  it("refuse un modèle de nom qui sortirait du dossier", () => {
    for (const template of ["../%(id)s.%(ext)s", "/tmp/%(id)s", "~/x", "temp:%(id)s", "a/../../b"]) {
      expect(validateYtDlpArgs(["-o", template], DATA).ok, template).toBe(false);
    }
    expect(validateYtDlpArgs(["-o", "cache/%(id)s.%(ext)s"], DATA).ok).toBe(true);
  });

  it("met les URL après `--`, même si une valeur d'option ressemble à une URL", () => {
    const result = validateYtDlpArgs(["--referer", "https://a.org/", "https://b.org/v"], DATA);
    expect(result.ok && result.args.slice(-4)).toEqual(["--referer", "https://a.org/", "--", "https://b.org/v"]);
  });

  it("refuse une valeur à un drapeau et une option sans sa valeur", () => {
    expect(validateYtDlpArgs(["--no-playlist=1"], DATA).ok).toBe(false);
    expect(validateYtDlpArgs(["-f"], DATA).ok).toBe(false);
  });
});
