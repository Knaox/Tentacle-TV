import { chromium, type Browser } from "playwright-core";

/**
 * Le Chrome du système, sans tête — aucun navigateur téléchargé.
 * `E2E_CHROME` : un autre exécutable (Chromium d'une distribution Linux…).
 */
export async function launchChrome(): Promise<Browser> {
  const executablePath = process.env.E2E_CHROME;
  return chromium.launch({ headless: true, ...(executablePath ? { executablePath } : { channel: "chrome" }) });
}
