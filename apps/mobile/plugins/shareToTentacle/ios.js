/**
 * Partage système vers Tentacle TV — la moitié iOS du config plugin `withShareToTentacle` : l'extension de
 * partage `ShareToTentacle` (sources dans `targets/ShareToTentacle/`, recopiées dans `ios/ShareToTentacle/` à
 * chaque prebuild — jamais retouchées là), embarquée par l'application dans la phase des extensions qui porte
 * déjà la Live Activity. Aucun App Group, aucune capacité : l'extension rouvre l'app par le lien profond.
 * Le projet iOS est COMMITÉ (la CI ne fait pas de prebuild) : ce plugin garde `expo prebuild` cohérent avec lui.
 */

const fs = require("fs");
const path = require("path");
const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");

const TARGET = "ShareToTentacle";
const SOURCES = ["ShareViewController.swift"];
const DEPLOYMENT_TARGET = "15.1";
const EMBED = '"Embed Foundation Extensions"';

function copySources(projectRoot, iosRoot) {
  const from = path.join(projectRoot, "targets", TARGET);
  const to = path.join(iosRoot, TARGET);
  fs.mkdirSync(to, { recursive: true });
  for (const file of [...SOURCES, "Info.plist"]) fs.copyFileSync(path.join(from, file), path.join(to, file));
}

function targetSettings(bundleId, team) {
  const settings = {
    INFOPLIST_FILE: `${TARGET}/Info.plist`,
    PRODUCT_BUNDLE_IDENTIFIER: `"${bundleId}.${TARGET}"`,
    PRODUCT_NAME: `"$(TARGET_NAME)"`,
    IPHONEOS_DEPLOYMENT_TARGET: DEPLOYMENT_TARGET,
    SDKROOT: "iphoneos",
    TARGETED_DEVICE_FAMILY: `"1,2"`,
    SWIFT_VERSION: "5.0",
    CLANG_ENABLE_MODULES: "YES",
    APPLICATION_EXTENSION_API_ONLY: "YES",
    CODE_SIGN_STYLE: "Automatic",
    SKIP_INSTALL: "YES",
    GENERATE_INFOPLIST_FILE: "NO",
    LD_RUNPATH_SEARCH_PATHS: `"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"`,
  };
  if (team) settings.DEVELOPMENT_TEAM = team;
  return settings;
}

function appTeam(project) {
  const configs = project.pbxXCBuildConfigurationSection();
  for (const key of Object.keys(configs)) {
    const team = configs[key]?.buildSettings?.DEVELOPMENT_TEAM;
    if (team) return team;
  }
  return null;
}

function hasTarget(project) {
  const targets = project.pbxNativeTargetSection();
  return Object.keys(targets).some((key) => String(targets[key]?.name ?? "").replace(/"/g, "") === TARGET);
}

/**
 * `addTarget` du paquet `xcode` crée une phase « Copy Files » de plus pour le produit : s'il y a déjà la
 * phase des extensions (Live Activity), le produit y passe et la phase neuve disparaît.
 */
function embedInExistingPhase(project, appTargetUuid) {
  const objects = project.hash.project.objects;
  const phases = objects.PBXCopyFilesBuildPhase ?? {};
  const keys = Object.keys(phases).filter((k) => typeof phases[k] === "object" && phases[k].dstSubfolderSpec === 13);
  const existing = keys.find((k) => phases[k].name === EMBED);
  const fresh = keys.find((k) => phases[k].name === '"Copy Files"');
  if (!fresh) return;
  if (!existing) {
    phases[fresh].name = EMBED;
    return;
  }
  phases[existing].files.push(...phases[fresh].files);
  delete phases[fresh];
  delete phases[`${fresh}_comment`];
  const app = objects.PBXNativeTarget[appTargetUuid];
  app.buildPhases = app.buildPhases.filter((p) => p.value !== fresh);
  // Les commentaires disent le nom de la phase : ceux du produit suivent.
  const label = `${TARGET}.appex in Embed Foundation Extensions`;
  for (const file of phases[existing].files) if (file.comment === `${TARGET}.appex in Copy Files`) file.comment = label;
  const buildFiles = project.pbxBuildFileSection();
  for (const key of Object.keys(buildFiles)) if (key.endsWith("_comment") && buildFiles[key] === `${TARGET}.appex in Copy Files`) buildFiles[key] = label;
}

function addTarget(project, bundleId) {
  const appTarget = project.getFirstTarget().uuid;
  const target = project.addTarget(TARGET, "app_extension", TARGET, `${bundleId}.${TARGET}`);
  // Sans l'Info.plist dans le groupe : le paquet `xcode` reprendrait la référence « Info.plist » de la Live
  // Activity (même chemin relatif). `INFOPLIST_FILE` suffit à la cible.
  const group = project.addPbxGroup(SOURCES, TARGET, TARGET);
  project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
  project.addBuildPhase(SOURCES, "PBXSourcesBuildPhase", "Sources", target.uuid);
  project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", target.uuid);
  project.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);

  // Le paquet `xcode` écrit littéralement « undefined » pour les champs qu'il ne connaît pas.
  const refs = project.pbxFileReferenceSection();
  for (const key of Object.keys(refs)) {
    const ref = refs[key];
    if (typeof ref !== "object") continue;
    for (const field of ["explicitFileType", "fileEncoding", "lastKnownFileType"]) {
      if (ref[field] === undefined || ref[field] === "undefined") delete ref[field];
    }
  }

  // La dépendance de l'application envers l'extension : `addTarget` (app_extension) la pose déjà.
  const list = project.pbxXCConfigurationList()[target.pbxNativeTarget.buildConfigurationList];
  const configs = project.pbxXCBuildConfigurationSection();
  const settings = targetSettings(bundleId, appTeam(project));
  for (const { value } of list.buildConfigurations) {
    const { GCC_PREPROCESSOR_DEFINITIONS: _unused, ...base } = configs[value].buildSettings;
    // L'ordre d'Xcode (`isa` en tête) : `ios-target-profiles.mjs` (CI) ne lit que lui.
    configs[value] = { isa: "XCBuildConfiguration", buildSettings: { ...base, ...settings }, name: configs[value].name };
  }
  embedInExistingPhase(project, appTarget);
}

function withShareToTentacleIos(config) {
  const bundleId = config.ios?.bundleIdentifier;
  if (!bundleId) throw new Error("withShareToTentacle : ios.bundleIdentifier manquant.");
  config = withDangerousMod(config, [
    "ios",
    (mod) => {
      copySources(mod.modRequest.projectRoot, mod.modRequest.platformProjectRoot);
      return mod;
    },
  ]);
  return withXcodeProject(config, (mod) => {
    if (!hasTarget(mod.modResults)) addTarget(mod.modResults, bundleId);
    return mod;
  });
}

module.exports = withShareToTentacleIos;
module.exports.TARGET = TARGET;
module.exports.addTarget = addTarget;
module.exports.hasTarget = hasTarget;
