/**
 * Les titres transférés AVANT que la finalisation sache poser `hvc1`.
 *
 * En copiant du HEVC dans un MP4, ffmpeg nomme l'entrée d'échantillon `hev1` ;
 * AVFoundation n'ouvre le HEVC que sous `hvc1`. Les fichiers déjà sur
 * l'appareil se lisent donc avec le son et sans l'image, et les retélécharger
 * coûterait des centaines de mégaoctets pour quatre octets. Une passe au
 * démarrage suffit — et contrairement à `heal`, elle n'a besoin d'aucun
 * réseau : tout se joue sur le disque.
 *
 * Une seule fois dans la vie de l'installation : les transferts suivants
 * sortent déjà promus de la finalisation.
 */

import { safeJoin, settingGet, settingSet } from "@tentacle-tv/offline-core";
import { canPromoteHevcTag, promoteHevcTag } from "../../modules/offline-storage";
import { localDb } from "./database";
import { offlineVolume } from "./volume";

/** Clé de stockage : elle vit en base, elle ne se renomme pas. */
const DONE_KEY = "hevc_tag_repair";

/** Balaie les titres déjà là, en tâche de fond, jamais attendue. */
export function runHevcRepair(): void {
  // Sans module (Expo Go, build antérieur), la passe n'aurait rien fait :
  // ne pas la marquer faite, pour qu'un build complet la rejoue.
  if (!canPromoteHevcTag()) return;
  const db = localDb();
  if (settingGet(db, DONE_KEY) !== null) return;
  void promoteAll()
    .then(() => settingSet(db, DONE_KEY, "1"))
    .catch(() => {
      // Best-effort : elle repassera au prochain démarrage.
    });
}

async function promoteAll(): Promise<void> {
  const volume = offlineVolume();
  // Seul l'Allégé passe par un conteneur MP4 fabriqué par Jellyfin ; l'Original
  // est le fichier du serveur, tel quel.
  const rows = localDb()
    .prepare("SELECT rel_path FROM files WHERE status = 'complete' AND variant = 'light'")
    .all();
  for (const row of rows) {
    const relPath = String(row["rel_path"] ?? "");
    if (!relPath.endsWith(".mp4")) continue;
    await promoteHevcTag(safeJoin(volume, relPath));
  }
}
