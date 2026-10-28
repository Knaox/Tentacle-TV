/**
 * Octave mobile — les fichiers audio du TÉLÉPHONE (et l'image de pochette jointe) pour l'import d'une sortie : le
 * sélecteur du système (iOS : Fichiers ; Android : le sélecteur de documents, SAF), plusieurs fichiers d'un coup,
 * COPIÉS dans le cache de l'app (une adresse `file://` qui se relit par tranches, même après une coupure : la reprise en dépend). Une
 * tranche se lit par `FileHandle` (position + `readBytes`) : jamais le fichier entier en mémoire.
 */

import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { copyAsync } from "expo-file-system/legacy";
import { pickReleaseLot, type ReleaseLocalFile } from "@tentacle-tv/api-client";
import { RELEASE_COVER_MIME_TYPES, RELEASE_FILES_PER_JOB } from "@tentacle-tv/shared/music";
import type { SharedAudioFile } from "@tentacle-tv/shared/octave/mode";

/** Un fichier du téléphone choisi pour l'import (copie dans le cache de l'app). */
export interface PhoneAudioFile {
  uri: string;
  name: string;
  size: number;
  type: string;
}

export interface PhonePick {
  files: PhoneAudioFile[];
  ignored: number;
  truncated: boolean;
  covers: number;
}

/** Ce qui vaut la peine d'être envoyé : l'audio et les images de pochette, 100 au plus (règle commune au web). */
export function keepAudio(all: readonly PhoneAudioFile[]): PhonePick {
  const { files, ignored, truncated, covers } = pickReleaseLot(all, RELEASE_FILES_PER_JOB);
  return { files, ignored, truncated, covers };
}

/** Le sélecteur du système ; `null` : rien choisi (annulé). */
export async function pickPhoneAudio(): Promise<PhonePick | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["audio/*", ...RELEASE_COVER_MIME_TYPES], multiple: true, copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  return keepAudio(
    result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.name,
      size: asset.size ?? new File(asset.uri).size,
      type: asset.mimeType ?? "",
    })),
  );
}

/** Des fichiers du téléphone en fichiers d'import : chaque tranche relue sur le disque, à sa place. */
export function toReleaseFiles(files: readonly PhoneAudioFile[]): ReleaseLocalFile[] {
  return files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
    read: async (start, end) => {
      const handle = new File(file.uri).open();
      try {
        handle.offset = start;
        return handle.readBytes(end - start) as unknown as BodyInit;
      } finally {
        handle.close();
      }
    },
  }));
}

/** Le dossier du cache où arrivent les fichiers PARTAGÉS (vidé par le système au besoin, jamais par nous en cours). */
const SHARED_DIR = "octave-shared";

/**
 * Des fichiers partagés vers l'app (Android : `content://`, lisibles tant que l'activité vit ; iOS : `file://` de
 * la boîte de réception) COPIÉS dans le cache de l'app : une adresse `file://` qui se relit par tranches, même pour
 * une reprise plus tard. Un fichier illisible est laissé de côté.
 */
export async function adoptSharedFiles(shared: readonly SharedAudioFile[]): Promise<PhoneAudioFile[]> {
  const dir = new Directory(Paths.cache, SHARED_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  const out: PhoneAudioFile[] = [];
  for (const [i, item] of shared.entries()) {
    try {
      const safe = item.name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120) || "audio";
      const target = new File(dir, `${Date.now()}-${i}-${safe}`);
      await copyAsync({ from: item.uri, to: target.uri });
      out.push({ uri: target.uri, name: item.name, size: target.size, type: item.type });
    } catch {
      // Le droit de lecture expiré, un fichier disparu : on passe au suivant.
    }
  }
  return out;
}
