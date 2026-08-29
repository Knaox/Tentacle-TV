#!/usr/bin/env node
/**
 * Fabrique les images de la coquille à partir du SEUL logo vectoriel.
 *
 * Les tailles ne sont pas négociables — elles viennent de la référence LG :
 * `icon` fait 80×80, `largeIcon` 130×130, le splash 1920×1080. Ce que la
 * référence ajoute et qu'on ne devine pas :
 *
 *   • webOS TV 1.0 affiche la PETITE icône en 100×100, webOS TV 2.0 affiche la
 *     GRANDE en 115×115. Les deux fichiers sont donc redimensionnés par le
 *     téléviseur, dans un sens ou dans l'autre, selon le millésime. On rend
 *     large et on réduit : 2080 est un multiple entier de 130 (16×) ET de 80
 *     (26×), donc aucune des deux réductions ne tombe entre deux pixels.
 *
 *   • L'icône est posée au centre d'une TUILE dont le fond est `iconColor`.
 *     Un dessin sur fond transparent laisse donc voir cette couleur, et un
 *     dessin sur fond opaque pose un carré dessus. On choisit le fond opaque —
 *     seul cas qui reste correct quand `iconColor` n'est pas honoré — et le
 *     dégradé est construit pour valoir EXACTEMENT `iconColor` sur ses quatre
 *     bords : la jointure avec la tuile ne se voit pas.
 *
 *   • « It should NOT be a black screen » pour le splash. Le précédent était
 *     une vignette perdue au milieu de 1920×1080 de noir.
 *
 * Le logo ne remplit pas sa propre boîte : `SUBJECT` recadre sur le dessin, sans
 * quoi le poulpe flotte au milieu d'une marge fantôme et paraît deux fois trop
 * petit une fois réduit à 80 pixels.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const IMAGES = resolve(HERE, "../shell/images");
const LOGO = resolve(IMAGES, "tentacle-logo-pirate.svg");

/** Le dessin utile dans le viewBox 512×560 du logo — mesuré sur les tracés. */
const SUBJECT = { x: 40, y: 8, width: 432, height: 542 };

/** La teinte des bords. `appinfo.json → iconColor` doit valoir la même. */
const EDGE = "#1A0932";
const CORE = "#2E1257";
const SPLASH_BACKGROUND = "#140628";

/** Rendu intermédiaire : multiple entier de 130 (×40), 80 (×65) et 400 (×13). */
const MASTER = 5200;

/**
 * Les trois tailles d'icône et leur destination. Le 400×400 est celui que LG
 * réclame au Seller Lounge et substitue au `largeIcon` après redimensionnement
 * automatique — il se téléverse à part, donc il n'a rien à faire dans l'IPK.
 */
const ICONS = [
  { size: 130, path: resolve(IMAGES, "icon-130.png") },
  { size: 80, path: resolve(IMAGES, "icon-80.png") },
  { size: 400, path: resolve(HERE, "../../../store-assets/webos-icon-400.png") },
];

function toolMissing(name) {
  return new Error(
    `${name} est introuvable. Les images sont des artefacts versionnés : ce ` +
      `script ne sert qu'à les régénérer, sur un poste qui a librsvg et ` +
      `ImageMagick (brew install librsvg imagemagick).`
  );
}

function run(name, params) {
  try {
    execFileSync(name, params, { stdio: ["ignore", "ignore", "inherit"] });
  } catch (error) {
    if (error.code === "ENOENT") throw toolMissing(name);
    throw error;
  }
}

/**
 * Le contenu du logo, sans son enveloppe `<svg>` : on le réimplante dans un
 * `<svg>` imbriqué dont le viewBox recadre sur le sujet. Passer par le fichier
 * plutôt que par une copie du tracé garantit qu'icône et splash suivent le
 * logo quand il change — une seule source, pas trois.
 */
function logoBody() {
  const source = readFileSync(LOGO, "utf8");
  const opening = source.indexOf(">", source.indexOf("<svg"));
  const closing = source.lastIndexOf("</svg>");
  if (opening < 0 || closing < 0) {
    throw new Error(`${LOGO} : enveloppe <svg> introuvable`);
  }
  return source.slice(opening + 1, closing);
}

/**
 * Le logo, mis à l'échelle pour occuper `partHauteur` de la hauteur du canevas
 * et centré sur `centreX` / `centerY`. Le viewBox du `<svg>` imbriqué fait le
 * recadrage, donc la boîte reçue correspond au dessin et à rien d'autre.
 */
function placedLogo(body, { canvasWidth, canvasHeight, heightFraction, centerY }) {
  const height = canvasHeight * heightFraction;
  const width = (height * SUBJECT.width) / SUBJECT.height;
  const x = (canvasWidth - width) / 2;
  const y = centerY * canvasHeight - height / 2;
  const viewBox = `${SUBJECT.x} ${SUBJECT.y} ${SUBJECT.width} ${SUBJECT.height}`;
  return (
    `<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" ` +
    `width="${width.toFixed(2)}" height="${height.toFixed(2)}" ` +
    `viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet">${body}</svg>`
  );
}

/**
 * L'icône. Le dégradé de fond est en coordonnées utilisateur et son rayon vaut
 * la demi-largeur : les quatre milieux de bord tombent pile sur la dernière
 * butée, les coins sont au-delà. Tout le pourtour vaut donc `EDGE`, et la
 * tuile du Launcher s'y raccorde sans ligne visible. Le halo qui donne le
 * relief est un second dégradé, éteint bien avant d'atteindre un bord.
 */
function iconSvg(body) {
  const C = 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${C}" height="${C}" viewBox="0 0 ${C} ${C}">
  <defs>
    <radialGradient id="fondIcone" gradientUnits="userSpaceOnUse" cx="256" cy="256" r="256">
      <stop offset="0%" stop-color="${CORE}"/>
      <stop offset="62%" stop-color="#231041"/>
      <stop offset="100%" stop-color="${EDGE}"/>
    </radialGradient>
    <radialGradient id="haloIcone" gradientUnits="userSpaceOnUse" cx="256" cy="196" r="188">
      <stop offset="0%" stop-color="#A855F7" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#A855F7" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${C}" height="${C}" fill="${EDGE}"/>
  <rect width="${C}" height="${C}" fill="url(#fondIcone)"/>
  <rect width="${C}" height="${C}" fill="url(#haloIcone)"/>
  ${placedLogo(body, {
    canvasWidth: C,
    canvasHeight: C,
    heightFraction: 0.84,
    centerY: 0.5,
  })}
</svg>`;
}

/**
 * Le splash. Même famille de couleurs que l'icône, mais un canevas 16:9 : le
 * dégradé est centré au-dessus du logo et s'éteint avant les coins, qui gardent
 * `FOND_SPLASH`. Le nom est écrit en toutes lettres — c'est un nom propre, il
 * ne se localise pas, et la référence LG ne déconseille que le texte à traduire.
 *
 * La police est résolue par fontconfig au moment du rendu : le fichier PNG est
 * versionné, donc ce que voit le téléviseur est ce qu'a produit le poste qui a
 * lancé ce script, pas la police installée chez le suivant.
 */
function svgSplash(body) {
  const L = 1920;
  const H = 1080;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">
  <defs>
    <radialGradient id="fondSplash" gradientUnits="userSpaceOnUse" cx="960" cy="470" r="880">
      <stop offset="0%" stop-color="${CORE}"/>
      <stop offset="55%" stop-color="#1D0B39"/>
      <stop offset="100%" stop-color="${SPLASH_BACKGROUND}"/>
    </radialGradient>
    <radialGradient id="haloSplash" gradientUnits="userSpaceOnUse" cx="960" cy="430" r="420">
      <stop offset="0%" stop-color="#A855F7" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#A855F7" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="motGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#C4B5FD"/>
      <stop offset="100%" stop-color="#F9A8D4"/>
    </linearGradient>
  </defs>
  <rect width="${L}" height="${H}" fill="${SPLASH_BACKGROUND}"/>
  <rect width="${L}" height="${H}" fill="url(#fondSplash)"/>
  <rect width="${L}" height="${H}" fill="url(#haloSplash)"/>
  ${placedLogo(body, {
    canvasWidth: L,
    canvasHeight: H,
    heightFraction: 0.52,
    centerY: 0.42,
  })}
  <!-- L'espacement des lettres s'applique AUSSI après la dernière : la boîte que
       text-anchor centre est donc plus large que le mot, et le mot part vers la
       gauche. On rend la moitié de cet espacement au centrage. -->
  <text x="967" y="880" text-anchor="middle" fill="url(#motGrad)"
        font-family="Helvetica Neue, Helvetica, Arial, Liberation Sans, sans-serif"
        font-size="76" font-weight="600" letter-spacing="14">TENTACLE TV</text>
</svg>`;
}

const workshop = mkdtempSync(join(tmpdir(), "tentacle-icons-"));
try {
  const body = logoBody();

  const iconSource = join(workshop, "icone.svg");
  const master = join(workshop, "maitre.png");
  writeFileSync(iconSource, iconSvg(body), "utf8");
  run("rsvg-convert", ["-w", String(MASTER), "-h", String(MASTER), iconSource, "-o", master]);

  for (const { size, path } of ICONS) {
    // Lanczos sur un multiple entier : les détails fins du crâne survivent à la
    // réduction, ce qu'un rendu vectoriel direct à 80 pixels ne garantit pas.
    run("magick", [
      master,
      "-filter", "Lanczos",
      "-resize", `${size}x${size}`,
      "-alpha", "off",
      "-strip",
      path,
    ]);
    console.log(`[icons] ${path.split("/").slice(-2).join("/")} — ${size}×${size}`);
  }

  const sourceSplash = join(workshop, "splash.svg");
  const splashLarge = join(workshop, "splash-large.png");
  const splash = resolve(IMAGES, "splash.png");
  writeFileSync(sourceSplash, svgSplash(body), "utf8");
  // Rendu au double puis réduit : le dégradé plein écran ne montre pas ses
  // paliers, et le texte reçoit le même suréchantillonnage que le dessin.
  run("rsvg-convert", ["-w", "3840", "-h", "2160", sourceSplash, "-o", splashLarge]);
  run("magick", [
    splashLarge,
    "-filter", "Lanczos",
    "-resize", "1920x1080",
    "-alpha", "off",
    "-strip",
    splash,
  ]);
  console.log(`[icons] splash.png — 1920×1080`);
} finally {
  rmSync(workshop, { recursive: true, force: true });
}
