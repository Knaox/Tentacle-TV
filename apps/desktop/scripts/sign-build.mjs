#!/usr/bin/env node
/**
 * Automatically sets TAURI_SIGNING_PRIVATE_KEY from the local key file
 * then runs `tauri build`. No manual export needed.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = resolve(__dirname, "../src-tauri/.tauri-keys/tentacle.key");

let privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY;
if (!privateKey) {
  try {
    privateKey = readFileSync(keyPath, "utf-8").trim();
    console.log("[sign-build] Loaded signing key from .tauri-keys/tentacle.key");
  } catch {
    console.warn("[sign-build] No signing key found — build will NOT be signed");
  }
}

const env = { ...process.env };
if (privateKey) {
  env.TAURI_SIGNING_PRIVATE_KEY = privateKey;
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || "";
}

try {
  execSync("tauri build", { stdio: "inherit", env, cwd: resolve(__dirname, "..") });
} catch (e) {
  process.exit(e.status ?? 1);
}
