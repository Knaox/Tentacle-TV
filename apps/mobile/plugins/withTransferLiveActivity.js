/**
 * Le config plugin de la Live Activity des transferts hors ligne.
 *
 * Il ajoute au projet iOS l'extension de widget `TransferLiveActivity` (ses
 * sources vivent dans `targets/TransferLiveActivity/`, recopiées dans
 * `ios/TransferLiveActivity/` à chaque prebuild — jamais retouchées là), la
 * fait embarquer par l'application, et déclare `NSSupportsLiveActivities`.
 *
 * Idempotent : un projet qui a déjà la cible n'en reçoit pas une seconde ;
 * seules les sources sont recopiées. Le projet iOS est COMMITÉ (la CI ne fait
 * pas de prebuild) : ce plugin garde `expo prebuild` cohérent avec lui.
 *
 * La version de l'extension suit celle de l'application (App Store l'exige) :
 * reprise de l'Info.plist de l'app au prebuild, et la CI patche les deux.
 */

const fs = require("fs");
const path = require("path");
const { withDangerousMod, withInfoPlist, withXcodeProject } = require("@expo/config-plugins");

const TARGET = "TransferLiveActivity";
const SOURCES = ["TransferActivityAttributes.swift", "TransferLiveActivityBundle.swift", "TransferLiveActivityWidget.swift"];
const DEPLOYMENT_TARGET = "16.2";

function copySources(projectRoot, iosRoot) {
  const from = path.join(projectRoot, "targets", TARGET);
  const to = path.join(iosRoot, TARGET);
  fs.mkdirSync(to, { recursive: true });
  for (const file of [...SOURCES, "Info.plist"]) fs.copyFileSync(path.join(from, file), path.join(to, file));
}

/** Les réglages de compilation de la cible, posés sur Debug et Release. */
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

/** L'équipe de signature de l'application, reprise pour l'extension. */
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

function addTarget(project, bundleId) {
  const target = project.addTarget(TARGET, "app_extension", TARGET, `${bundleId}.${TARGET}`);
  const group = project.addPbxGroup([...SOURCES, "Info.plist"], TARGET, TARGET);
  // `addPbxGroup` fait une entrée de compilation de chaque fichier : celle de
  // l'Info.plist ne sert à rien (il n'est jamais copié), elle part.
  const buildFiles = project.pbxBuildFileSection();
  for (const key of Object.keys(buildFiles)) {
    if (buildFiles[key]?.fileRef_comment === "Info.plist" && group.pbxGroup.children.some((c) => c.value === buildFiles[key].fileRef)) {
      delete buildFiles[key];
      delete buildFiles[`${key}_comment`];
    }
  }
  const mainGroup = project.getFirstProject().firstProject.mainGroup;
  project.addToPbxGroup(group.uuid, mainGroup);
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

  // L'application dépend de l'extension : construite avant d'être embarquée.
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency ??= {};
  objects.PBXContainerItemProxy ??= {};
  project.addTargetDependency(project.getFirstTarget().uuid, [target.uuid]);

  const listId = target.pbxNativeTarget.buildConfigurationList;
  const list = project.pbxXCConfigurationList()[listId];
  const configs = project.pbxXCBuildConfigurationSection();
  const settings = targetSettings(bundleId, appTeam(project));
  for (const { value } of list.buildConfigurations) {
    const config = configs[value];
    // L'addTarget du paquet `xcode` pose un INFOPLIST_FILE à sa façon : remplacé.
    config.buildSettings = { ...config.buildSettings, ...settings };
    delete config.buildSettings.GCC_PREPROCESSOR_DEFINITIONS;
  }
  // Le produit s'embarque sous PlugIns : la phase de copie de l'app le reçoit
  // (`addTarget` l'a créée, sans nom lisible).
  const phases = project.hash.project.objects.PBXCopyFilesBuildPhase ?? {};
  for (const key of Object.keys(phases)) {
    const phase = phases[key];
    if (typeof phase === "object" && phase.name === '"Copy Files"' && phase.dstSubfolderSpec === 13) {
      phase.name = '"Embed Foundation Extensions"';
    }
  }
}

function withTransferLiveActivity(config) {
  const bundleId = config.ios?.bundleIdentifier;
  if (!bundleId) throw new Error("withTransferLiveActivity : ios.bundleIdentifier manquant.");

  config = withInfoPlist(config, (mod) => {
    mod.modResults.NSSupportsLiveActivities = true;
    return mod;
  });

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

module.exports = withTransferLiveActivity;
module.exports.TARGET = TARGET;
module.exports.SOURCES = SOURCES;
