/**
 * Un écran branché sait-il afficher du HDR ? Lu dans son EDID, AVANT la fenêtre.
 *
 * C'est ce qui décide, en session `auto` sous GNOME ou wlroots, entre Wayland
 * (HDR, lecture plein écran forcée) et XWayland (lecture fenêtrée, sans HDR) —
 * voir `graphicsSession.ts`. La question se pose avant `whenReady`, quand ni
 * Chromium ni mpv ne savent encore rien des écrans : le noyau, lui, a l'EDID
 * dans `/sys/class/drm/*\/edid`.
 *
 * Ce qu'on lit : l'extension CTA-861 (étiquette 0x02), son bloc étendu « HDR
 * Static Metadata » (étiquette 7, étiquette étendue 6), dont le premier octet
 * liste les fonctions de transfert prises en charge — bit 2 SMPTE ST 2084
 * (PQ), bit 3 HLG. Un écran qui en annonce une est tenu pour HDR, que le HDR
 * soit allumé ou non dans les réglages du bureau : l'utilisateur peut
 * l'allumer, et il ne doit pas perdre le HDR parce qu'il ne l'avait pas encore
 * fait.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const EDID_BLOCK = 128;
const CTA_EXTENSION = 0x02;
const EXTENDED_TAG = 7;
const HDR_STATIC_METADATA = 6;
/** Bits des fonctions de transfert : 2 = PQ (ST 2084), 3 = HLG. */
const HDR_EOTF_MASK = 0b1100;

/** L'EDID annonce-t-il PQ ou HLG ? Jamais d'exception : un EDID abîmé vaut « non ». */
export function edidSupportsHdr(edid: Buffer): boolean {
  if (edid.length < EDID_BLOCK) return false;
  for (let start = EDID_BLOCK; start + EDID_BLOCK <= edid.length; start += EDID_BLOCK) {
    if (edid[start] !== CTA_EXTENSION) continue;
    // Octet 2 : décalage des descripteurs détaillés, donc fin des blocs de données.
    const end = start + Math.min(edid[start + 2] ?? 0, EDID_BLOCK - 1);
    let at = start + 4;
    while (at < end) {
      const header = edid[at] ?? 0;
      const length = header & 0x1f;
      if (header >> 5 === EXTENDED_TAG && length >= 2 && edid[at + 1] === HDR_STATIC_METADATA) {
        if (((edid[at + 2] ?? 0) & HDR_EOTF_MASK) !== 0) return true;
      }
      at += 1 + length;
    }
  }
  return false;
}

/** Un écran HDR est-il branché ? Rend `false` si le noyau ne dit rien. */
export function hdrDisplayConnected(root = "/sys/class/drm"): boolean {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (!entry.startsWith("card") || !entry.includes("-")) continue;
    try {
      if (readFileSync(path.join(root, entry, "status"), "utf8").trim() !== "connected") continue;
      if (edidSupportsHdr(readFileSync(path.join(root, entry, "edid")))) return true;
    } catch {
      // Un connecteur illisible n'empêche pas de lire les autres.
    }
  }
  return false;
}
