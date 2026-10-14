import { TRAILER_PREVIEW_HLS_MIME, type TrailerPreview } from "@tentacle-tv/shared";
import { getBackendBase } from "../lib/backendBase";
import type { TrailerPreviewStream } from "./previewTypes";

/**
 * L'adresse absolue d'un chemin du serveur Tentacle : derrière l'adresse du
 * serveur enregistrée sur le bureau, derrière l'origine de la page sur le web
 * (même origine, ou le mandataire de Vite en développement).
 */
export function backendAbsoluteUrl(path: string): string {
  // Concaténé comme partout ailleurs (`${backendUrl}/api/…`) : un serveur publié
  // sous un sous-chemin le garde.
  const base = getBackendBase() || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base.replace(/\/+$/, "")}${path}`;
}

/** Le flux de lecture d'un aperçu trouvé. */
export function previewStreamOf(preview: TrailerPreview): TrailerPreviewStream {
  const hls = preview.mimeType === TRAILER_PREVIEW_HLS_MIME;
  return {
    src: backendAbsoluteUrl(preview.path),
    mimeType: preview.mimeType,
    kind: hls ? "hls" : "mp4",
    heights: hls ? [...preview.heights].sort((a, b) => b - a) : [],
    burnedSubtitles: preview.version === "subtitled",
  };
}
