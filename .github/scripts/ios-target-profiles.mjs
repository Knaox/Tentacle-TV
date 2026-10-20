// Pose le profil de diffusion de chaque cible iOS (app, extension de la Live
// Activity) dans le projet, juste avant l'archive — mobile.yml.
//
//   node .github/scripts/ios-target-profiles.mjs apps/mobile/ios/TentacleTV.xcodeproj/project.pbxproj \
//     TentacleTV="Profil app" TransferLiveActivity="Profil extension"
import fs from 'node:fs';
import { withTargetProfiles } from './lib/ios-target-profiles.mjs';

const [path, ...pairs] = process.argv.slice(2);
const profiles = Object.fromEntries(pairs.map((pair) => {
  const at = pair.indexOf('=');
  return [pair.slice(0, at), pair.slice(at + 1)];
}));
try {
  fs.writeFileSync(path, withTargetProfiles(fs.readFileSync(path, 'utf8'), profiles));
  for (const [target, profile] of Object.entries(profiles)) console.log(`${target} → « ${profile} »`);
} catch (error) {
  console.error(`::error file=${path}::${error.message}`);
  process.exit(1);
}
