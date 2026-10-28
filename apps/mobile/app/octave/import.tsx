import { useEffect } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { arrivingShareLink, useMusicShareLinkImport } from "@tentacle-tv/api-client";
import { recognizeReleaseUrl, recognizeTentacleShare } from "@tentacle-tv/shared/music";
import { octavePaths, sharedAudioFiles, sharedImportLink } from "@tentacle-tv/shared/octave/mode";
import { setOctaveMode } from "@/octave/mode/octaveModeStore";
import { openPlaylistSheet } from "@/octave/playlists";
import { openReleaseSheet } from "@/octave/releases";
import { adoptSharedFiles } from "@/octave/releases/phoneReleaseFiles";

/**
 * Octave — `tentacle://octave/import`, quatre arrivées :
 * - `?share=<lien>` : « Ouvrir dans l'app Tentacle » de la page d'un lien de playlist partagée (la même
 *   adresse que celle du web). La feuille d'import s'ouvre avec lui déjà collé ; rien ne part sans le geste
 *   « Importer ».
 * - `?shared=<texte>` : le PARTAGE SYSTÈME vers Tentacle TV (feuille de partage d'iOS, intent `SEND`
 *   d'Android, qui rendent le texte reçu tel quel). Le lien de playlist qu'il contient (`sharedImportLink`)
 *   part aussitôt : le partage est le geste.
 * - `?shared=<texte>` avec le lien d'une page BANDCAMP (album, titre ; lot « sf ») : la feuille « Importer une
 *   sortie » s'ouvre et l'importe aussitôt.
 * - `?file=…` (répété) : des FICHIERS AUDIO partagés (`sharedReleaseFiles.ts`) : copiés dans le cache de l'app, ils
 *   arrivent dans la feuille « Importer une sortie », qui attend « Importer ».
 * Dans tous les cas, l'app passe en mode Octave et s'ouvre sur la Bibliothèque. Un lien d'un autre Tentacle sans
 * le droit du partage (règle 15) : rien ne s'ouvre. Sans le point `releases` de l'extension, la feuille des sorties
 * ne se montre pas.
 */
export default function OctaveImportRoute() {
  const params = useLocalSearchParams<{ share?: string; shared?: string; file?: string | string[]; fileName?: string | string[]; fileType?: string | string[] }>();
  const { share, shared } = params;
  const allowed = useMusicShareLinkImport();
  const fromPage = arrivingShareLink(typeof share === "string" ? share : null, allowed);
  const sharedText = typeof shared === "string" ? shared : null;
  const fromSystem = sharedImportLink(sharedText);
  const systemLink = fromSystem && (allowed || !recognizeTentacleShare(fromSystem)) ? fromSystem : null;
  const link = fromPage ?? systemLink;
  const autoStart = !fromPage && !!systemLink;
  // Une page Bandcamp n'est jamais une playlist : elle va à l'import des sorties.
  const releaseUrl = !link && sharedText ? (recognizeReleaseUrl(sharedText)?.url ?? null) : null;
  const fileParams = JSON.stringify([params.file ?? null, params.fileName ?? null, params.fileType ?? null]);
  useEffect(() => {
    if (!link) return;
    setOctaveMode(true);
    openPlaylistSheet({ kind: "import", prefill: link, autoStart });
  }, [autoStart, link]);
  useEffect(() => {
    if (!releaseUrl) return;
    setOctaveMode(true);
    openReleaseSheet({ kind: "link", url: releaseUrl, autoStart: true });
  }, [releaseUrl]);
  useEffect(() => {
    const [file, fileName, fileType] = JSON.parse(fileParams) as (string | string[] | undefined)[];
    const files = sharedAudioFiles({ file: file ?? undefined, fileName: fileName ?? undefined, fileType: fileType ?? undefined });
    if (files.length === 0) return;
    setOctaveMode(true);
    void adoptSharedFiles(files).then((adopted) => {
      if (adopted.length > 0) openReleaseSheet({ kind: "files", files: adopted });
    });
  }, [fileParams]);
  return <Redirect href={octavePaths.library as never} />;
}
