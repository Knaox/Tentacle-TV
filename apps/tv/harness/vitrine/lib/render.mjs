// Le rendu des compositions : une page HTML rendue par Chrome sans tête, en
// PNG, puis aplatie en RVB SANS canal alpha (exigence d'App Store Connect).
// Profil Chrome jetable, à soi : jamais le profil réel de l'utilisateur.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FONTS, HOME } from "./paths.mjs";

const CHROME = process.env.VITRINE_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE = path.join(HOME, ".state/chrome-profile");
const WORK = path.join(HOME, ".state/render");
const WINDOW_MARGIN = 160;

export const fileUrl = (file) => pathToFileURL(file).href;

/** Les graisses d'Inter du dépôt (celles de l'app TV), en @font-face. */
export function interFaces() {
  const weights = { Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800 };
  return Object.entries(weights)
    .map(([name, weight]) => `@font-face{font-family:"Inter";font-weight:${weight};src:url("${fileUrl(path.join(FONTS, `Inter-${name}.ttf`))}");}`)
    .join("\n");
}

/** Ajuste la taille d'un titre pour qu'il tienne sur UNE ligne dans sa boîte. */
export const FIT_SCRIPT = `<script>
document.fonts.ready.then(() => {
  for (const el of document.querySelectorAll("[data-fit]")) {
    const max = Number(el.dataset.fit);
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > max && size > 20) { size -= 1; el.style.fontSize = size + "px"; }
  }
});
</script>`;

/**
 * Chrome complet écrit la capture (« N bytes written to file ») mais ne se
 * termine pas seul en mode sans tête : on attend cette ligne, puis on arrête
 * SON groupe de processus, par PID.
 */
function chromeScreenshot(url, file, { width, height, scale }) {
  return new Promise((resolve, reject) => {
    fs.rmSync(file, { force: true });
    const child = spawn(CHROME, [
      "--headless=new", "--use-mock-keychain", "--password-store=basic", "--disable-gpu", "--hide-scrollbars",
      "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update",
      "--disable-sync", "--allow-file-access-from-files", `--user-data-dir=${PROFILE}`,
      `--force-device-scale-factor=${scale}`, `--window-size=${width},${height}`, "--virtual-time-budget=12000",
      `--screenshot=${file}`, url,
    ], { detached: true, stdio: ["ignore", "pipe", "pipe"] });
    let done = false;
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        // déjà terminé
      }
      if (error) reject(error);
      else resolve(file);
    };
    const watch = (chunk) => String(chunk).includes("bytes written to file") && finish();
    child.stdout.on("data", watch);
    child.stderr.on("data", watch);
    child.on("exit", () => finish(fs.existsSync(file) ? null : new Error("Chrome s'est arrêté sans capture")));
    const timer = setTimeout(() => finish(new Error("Chrome n'a pas rendu la page en 120 s")), 120_000);
  });
}

/**
 * Rend `html` (une page de `width` × `height` px CSS) en PNG de
 * `width·scale` × `height·scale`, sans alpha sauf `keepAlpha`.
 */
export async function renderPng(html, out, { width, height, scale = 2, background = "#000000", keepAlpha = false }) {
  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const name = `${path.basename(path.dirname(out))}-${path.basename(out, ".png")}`;
  const page = path.join(WORK, `${name}.html`);
  const raw = path.join(WORK, `${name}.raw.png`);
  fs.writeFileSync(page, html);
  // La fenêtre sans tête montre ~56 px CSS de moins que sa taille : on la
  // prend plus haute, puis on recadre la page à sa taille exacte.
  await chromeScreenshot(fileUrl(page), raw, { width, height: height + WINDOW_MARGIN, scale });
  const crop = ["-crop", `${width * scale}x${height * scale}+0+0`, "+repage"];
  const flatten = keepAlpha ? [] : ["-background", background, "-alpha", "remove", "-alpha", "off"];
  execFileSync("magick", [raw, ...crop, ...flatten, "-strip", keepAlpha ? `PNG32:${out}` : `PNG24:${out}`]);
  return out;
}

/** Dimensions et canaux d'une image : « 3840x2160 srgb » pour du RVB sans alpha. */
export function describe(file) {
  const [size, channels] = execFileSync("magick", ["identify", "-format", "%wx%h|%[channels]", file], { encoding: "utf8" }).trim().split("|");
  // ImageMagick 7 écrit « srgb  3.0 » ou « srgba  4.0 » : seul l'espace compte.
  return `${size} ${channels.trim().split(/\s+/)[0]}`;
}
