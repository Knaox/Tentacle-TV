// La garde de licence des lecteurs Android.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { aarFfmpegLicenses, aarVerdict, apkVerdict } from '../lib/android-player-license.mjs';

const GMS = 'apply plugin: "com.google.gms.google-services"';
const LIBMPV = "implementation 'dev.jdtech.mpv:libmpv:1.0.0'";

test('GPL + Firebase dans le même APK : refusé', () => {
  const v = apkVerdict([GMS, LIBMPV]);
  assert.equal(v.ok, false);
  assert.match(v.reasons[0], /dev\.jdtech\.mpv:libmpv/);
});

test('GPL sans bibliothèque propriétaire (Android TV) : admis', () => {
  assert.equal(apkVerdict([LIBMPV, 'implementation "org.jellyfin.media3:media3-ffmpeg-decoder:1.8.0+1"']).ok, true);
});

test('un artefact GPL en commentaire ne compte pas', () => {
  assert.equal(apkVerdict([GMS, `// ${LIBMPV}`]).ok, true);
});

test("la licence gravée par FFmpeg se lit dans l'AAR", () => {
  const dir = mkdtempSync(join(tmpdir(), 'aar-'));
  try {
    mkdirSync(join(dir, 'jni', 'arm64-v8a'), { recursive: true });
    writeFileSync(join(dir, 'jni', 'arm64-v8a', 'libavutil.so'), Buffer.from('\0libavutil license: LGPL version 3 or later\0'));
    writeFileSync(join(dir, 'jni', 'arm64-v8a', 'libavcodec.so'), Buffer.from('\0libavcodec license: GPL version 3 or later\0'));
    execFileSync('zip', ['-qr', 'x.aar', 'jni'], { cwd: dir });
    const licenses = aarFfmpegLicenses(join(dir, 'x.aar'));
    assert.deepEqual(licenses.sort(), ['GPL version 3 or later', 'LGPL version 3 or later']);
    assert.equal(aarVerdict(licenses).ok, false);
    assert.equal(aarVerdict(['LGPL version 2.1 or later']).ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
