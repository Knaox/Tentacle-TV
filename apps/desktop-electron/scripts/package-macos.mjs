/**
 * Empaquetage macOS — Mac App Store.
 *
 * # Ce que ce script produit
 *
 * `Tentacle TV.app` universelle (Apple Silicon ⊕ Intel), bac à sable, signée
 * « Apple Distribution », puis un `.pkg` signé « 3rd Party Mac Developer
 * Installer » — le seul format que l'App Store accepte. Sans identité de
 * signature il s'arrête à une signature ad hoc : de quoi lancer le paquet sur la
 * machine qui l'a produit, et rien d'autre.
 *
 * # Pourquoi `platform: "mas"` et pas `darwin`
 *
 * Electron publie deux binaires : celui de tous les jours, et un `mas` bâti sans
 * API privée. Livrer le premier au Store, c'est un rejet automatique. Le second
 * n'embarque pas Squirrel, donc aucun auto-updater : sur macOS la mise à jour est
 * un manifeste HTTP et l'ouverture de la fiche App Store (`updateCheckers.ts`).
 *
 * # Le lecteur, et pourquoi il vient d'ailleurs
 *
 * ⚠️ En développement, la coquille emprunte la libmpv de Homebrew — **GPL**, et
 * hors de question dans un paquet. Les dylibs livrées sont celles que
 * `apps/desktop/scripts/build-mpv-lgpl-macos.sh` recompile en **LGPL** (mpv sans
 * `gpl=true`, FFmpeg sans `--enable-gpl`, ni x264 ni x265) — exactement la chaîne
 * déjà validée par Apple pour le paquet Tauri. On les reçoit par `--lib`,
 * universelles, et on les pose dans `Contents/Frameworks` : Apple refuse du code
 * exécutable sous `Resources`, et c'est là que `libmpvPath()` les cherche.
 *
 *   node scripts/package-macos.mjs --lib <dossier de dylibs> [options]
 *
 *     --arch universal|arm64|x64   défaut : universal
 *     --version X.Y.Z              défaut : version du package.json
 *     --build N                    CFBundleVersion (numéro de build du store)
 *     --sign "<identité app>"      sinon signature ad hoc (essai local)
 *     --pkg-sign "<identité pkg>"  produit le .pkg
 *     --profile <chemin>           embedded.provisionprofile
 *     --pkg-out <chemin.pkg>       défaut : <out>/Tentacle-TV.pkg
 *     --out <dossier>              défaut : release-macos
 */

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packager } from "@electron/packager";
import { sign, flat } from "@electron/osx-sign";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(ICI, "..");
const RACINE = path.resolve(APP, "../..");

/** Nom du produit : porte le paquet, le binaire et le menu applicatif. */
const NOM = "Tentacle TV";
/** Fiche App Store Connect partagée avec iOS et tvOS — ne jamais dériver. */
const IDENTIFIANT = "com.tentacle.mobile";
const EQUIPE = "96K3M57W49";

/**
 * Modules à embarquer. Le dépôt est en `node-linker=hoisted` : `koffi` vit à la
 * RACINE, et son binaire natif dans un paquet SÉPARÉ par architecture. Oublier
 * l'un des deux donne une application qui s'ouvre et ne lit rien.
 */
const MODULES = ["koffi", "zod"];
const NATIFS = { arm64: "@koromix/koffi-darwin-arm64", x64: "@koromix/koffi-darwin-x64" };

function argument(nom, defaut) {
  const index = process.argv.indexOf(nom);
  return index >= 0 && process.argv[index + 1] !== undefined ? process.argv[index + 1] : defaut;
}

function copier(source, cible, quoi) {
  if (!existsSync(source)) throw new Error(`${quoi} introuvable : ${source}`);
  mkdirSync(path.dirname(cible), { recursive: true });
  cpSync(source, cible, { recursive: true });
}

const arch = argument("--arch", "universal");
const archs = arch === "universal" ? ["arm64", "x64"] : [arch];
const libDir = path.resolve(argument("--lib", ""));
const sortie = path.resolve(APP, argument("--out", "release-macos"));
const identiteApp = argument("--sign", "");
const identitePkg = argument("--pkg-sign", "");
const profil = argument("--profile", "");
const versionPaquet = JSON.parse(readFileSync(path.join(APP, "package.json"), "utf8"));
const version = argument("--version", versionPaquet.version);
const build = argument("--build", version);

if (libDir === "" || !existsSync(libDir)) {
  throw new Error("--lib <dossier> est requis : les dylibs LGPL (libmpv + FFmpeg) à livrer.");
}
if (!existsSync(path.join(libDir, "libmpv.2.dylib"))) {
  throw new Error(`libmpv.2.dylib absente de ${libDir} — le paquet ne saurait rien lire.`);
}

/** Assemble ce que packager doit voir comme « l'application ». */
function preparer(stage) {
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });

  copier(path.join(APP, "dist"), path.join(stage, "dist"), "build de la coquille");

  // `package.json` réduit : packager y lit `main`, `productName` et `version`, et
  // c'est cette version que `app.getVersion()` rendra — donc celle que la
  // détection de mise à jour compare au manifeste du dépôt. Elle doit venir de
  // `versions.json`, ce que `--version` garantit en CI.
  writeFileSync(
    path.join(stage, "package.json"),
    `${JSON.stringify(
      {
        name: "tentacle-tv",
        productName: NOM,
        version,
        main: versionPaquet.main,
        author: "Damien ROUGE",
        license: versionPaquet.license ?? "UNLICENSED",
      },
      null,
      2,
    )}\n`,
  );

  for (const module of [...MODULES, ...archs.map((a) => NATIFS[a])]) {
    copier(path.join(RACINE, "node_modules", module), path.join(stage, "node_modules", module), module);
  }
}

/** Ressources hors application : le build web et l'icône matricielle du Dock. */
function preparerRessources(stage) {
  const ressources = path.join(stage, "..", "resources");
  rmSync(ressources, { recursive: true, force: true });

  // Les basenames comptent : `extraResource` copie le BASENAME, et `webRoot()`
  // cherche `resources/web`, `appImagePath()` cherche `resources/icon.png`.
  copier(path.resolve(RACINE, "apps/web/dist"), path.join(ressources, "web"), "build web");
  copier(
    path.resolve(RACINE, "apps/desktop/src-tauri/icons/icon.png"),
    path.join(ressources, "icon.png"),
    "icone du Dock",
  );
  return [path.join(ressources, "web"), path.join(ressources, "icon.png")];
}

/**
 * Pose les dylibs LGPL dans `Contents/Frameworks`.
 *
 * `collect-dylibs.sh` a déjà réécrit leurs dépendances en `@loader_path`, donc
 * elles se retrouvent entre elles du moment qu'elles restent côte à côte. La
 * signature vient après : `@electron/osx-sign` parcourt le paquet et scelle tout
 * ce qui est exécutable, ces dylibs comprises.
 */
function poserDylibs(appPath) {
  const frameworks = path.join(appPath, "Contents", "Frameworks");
  mkdirSync(frameworks, { recursive: true });
  const dylibs = readdirSync(libDir).filter((f) => f.endsWith(".dylib"));
  for (const dylib of dylibs) copier(path.join(libDir, dylib), path.join(frameworks, dylib), dylib);
  console.log(`[macos] ${dylibs.length} dylibs LGPL posées dans Contents/Frameworks`);
}

const stage = path.join(sortie, "stage", "app");
preparer(stage);
const extraResource = preparerRessources(stage);

const chemins = await packager({
  dir: stage,
  out: sortie,
  name: NOM,
  executableName: NOM,
  platform: "mas",
  arch,
  overwrite: true,
  // `prune` lancerait `npm prune` dans un workspace pnpm hoisté ; le dossier de
  // préparation ne contient DÉJÀ que ce qu'il faut.
  prune: false,
  // Les binaires natifs SORTENT de l'archive : Electron sait charger un `.node`
  // depuis une asar, mais en le recopiant dans un dossier temporaire à chaque
  // lancement. Dans un bac à sable, c'est une copie de plus à chaque démarrage
  // pour rien — et le premier `.node` en jeu est celui de koffi, chargé AVANT la
  // première image.
  asar: { unpack: "**/*.node" },
  // ⚠️ Les deux binaires natifs de koffi sont mono-architecture, et chacun est
  // présent dans les DEUX paquets intermédiaires : c'est koffi qui choisit le
  // sien au chargement, d'après `process.arch`. Sans cette règle, la fusion
  // universelle s'arrête sur « same in both x64 and arm64 builds » — elle refuse
  // par défaut un Mach-O mono-architecture qu'elle ne peut pas `lipo`. Le nom de
  // l'option dit « x64 » ; sa sémantique est « ces fichiers-là sont mono-arch
  // volontairement ».
  osxUniversal: { x64ArchFiles: "**/*.node" },
  icon: path.resolve(RACINE, "apps/desktop/src-tauri/icons/icon.icns"),
  extraResource,
  appBundleId: IDENTIFIANT,
  appVersion: version,
  buildVersion: String(build),
  appCategoryType: "public.app-category.entertainment",
  appCopyright: "Damien ROUGE",
  darwinDarkModeSupport: true,
  extendInfo: {
    // Évite la question « export compliance » à chaque envoi TestFlight : la
    // seule cryptographie en jeu est celle de HTTPS, exemptée.
    ITSAppUsesNonExemptEncryption: false,
    // Renseigné à la main parce que la signature tourne avec
    // `preAutoEntitlements: false` — voir plus bas.
    ElectronTeamID: EQUIPE,
    // Même plancher que la chaîne mpv/FFmpeg (MACOSX_DEPLOYMENT_TARGET=14.0) et
    // que le paquet Tauri : promettre moins livrerait des plantages au lancement.
    LSMinimumSystemVersion: "14.0",
  },
});

const appPath = path.join(chemins[0], `${NOM}.app`);
poserDylibs(appPath);

if (identiteApp === "") {
  // Essai local : une signature ad hoc suffit à lancer le paquet sur place. Rien
  // d'envoyable — ni bac à sable relié à un profil, ni .pkg.
  execFileSync("/usr/bin/codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" });
  console.log(`[macos] paquet non distribuable (signature ad hoc) : ${appPath}`);
  process.exit(0);
}

// Dans `mas/`, et pas dans un `build/` — que le `.gitignore` de la racine avale.
const parent = path.join(APP, "mas", "entitlements.mas.plist");
const enfant = path.join(APP, "mas", "entitlements.mas.inherit.plist");

await sign({
  app: appPath,
  platform: "mas",
  identity: identiteApp,
  type: "distribution",
  ...(profil === "" ? {} : { provisioningProfile: profil }),
  // Le principal prend les droits reliés au profil ; tout le reste — processus
  // d'aide, cadres, dylibs — hérite. C'est la règle du bac à sable, et l'ordre
  // « de l'intérieur vers l'extérieur » est celui d'osx-sign.
  optionsForFile: (fichier) => ({
    entitlements: path.resolve(fichier) === path.resolve(appPath) ? parent : enfant,
  }),
  // ⚠️ Coupé volontairement : l'automatisation ajouterait
  // `com.apple.security.application-groups` aux droits. Le profil de
  // provisionnement en service n'a jamais porté ce droit (il a été émis pour la
  // liste du paquet Tauri) et un droit hors profil ne se voit qu'après l'envoi,
  // sous la forme d'un build inéligible. `ElectronTeamID`, que cette
  // automatisation posait aussi, est écrit plus haut à la main.
  preAutoEntitlements: false,
  strictVerify: true,
});
console.log(`[macos] signé « ${identiteApp} »`);

if (identitePkg === "") {
  console.log(`[macos] app signée sans .pkg (pas de --pkg-sign) : ${appPath}`);
  process.exit(0);
}

const pkg = path.resolve(argument("--pkg-out", path.join(sortie, "Tentacle-TV.pkg")));
await flat({ app: appPath, platform: "mas", identity: identitePkg, pkg, install: "/Applications" });
console.log(`[macos] paquet App Store : ${pkg}`);
