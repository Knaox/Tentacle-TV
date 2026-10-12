#!/usr/bin/env node
// Construit le `resources.pri` d'un paquet MSIX assemblé, à côté de son
// `AppxManifest.xml` — à lancer AVANT `makeappx pack`, sous Windows (SDK).
//
//   node .github/scripts/msix-resources.mjs --stage <dossier du paquet>
//
// Seul `Assets/` est indexé : il est recopié dans un dossier à part, sans quoi
// MakePri indexerait tout le paquet (les node_modules du serveur, les .pak
// d'Electron). L'index est relu (`makepri dump`) : chaque visuel nommé par le
// manifeste doit y avoir ses variantes, sinon rien ne part.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { candidatesFor, defaultLanguage, findMakePri, manifestAssets, missingAssets, priConfig } from './lib/msix-resources.mjs';

function stageArg(argv) {
  const at = argv.indexOf('--stage');
  const value = at === -1 ? undefined : argv[at + 1];
  if (value === undefined || value.startsWith('--')) throw new Error('--stage <dossier du paquet> manquant');
  return resolve(value);
}

function main() {
  const stage = stageArg(process.argv.slice(2));
  const manifestPath = join(stage, 'AppxManifest.xml');
  if (!existsSync(manifestPath)) throw new Error(`${stage} n'a pas d'AppxManifest.xml`);
  const manifest = readFileSync(manifestPath, 'utf8');
  const files = readdirSync(join(stage, 'Assets'));
  const missing = missingAssets(manifest, files);
  if (missing.length > 0) throw new Error(`visuels sans aucune variante dans Assets/ : ${missing.join(', ')}`);

  const makepri = findMakePri();
  if (makepri === null) throw new Error('makepri introuvable : installer le SDK Windows');
  const work = mkdtempSync(join(tmpdir(), 'msix-pri-'));
  try {
    const project = join(work, 'project');
    cpSync(join(stage, 'Assets'), join(project, 'Assets'), { recursive: true });
    const config = join(work, 'priconfig.xml');
    writeFileSync(config, priConfig(defaultLanguage(manifest)));
    const pri = join(stage, 'resources.pri');
    console.log(`[msix-resources] ${makepri}`);
    execFileSync(makepri, ['new', '/pr', project, '/cf', config, '/mn', manifestPath, '/of', pri, '/o'], {
      stdio: ['ignore', 'ignore', 'inherit'],
    });

    const dump = join(work, 'dump.xml');
    execFileSync(makepri, ['dump', '/if', pri, '/of', dump, '/o'], { stdio: ['ignore', 'ignore', 'inherit'] });
    const indexed = readFileSync(dump, 'utf8');
    for (const asset of manifestAssets(manifest)) {
      const name = asset.replace(/^Assets\//, '');
      if (!indexed.includes(`name="${name}"`)) throw new Error(`${asset} absent de resources.pri`);
      console.log(`[msix-resources] ${asset} : ${candidatesFor(asset, files).length} variantes`);
    }
    console.log(`[msix-resources] ${pri}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`[msix-resources] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
