/**
 * Octave mobile — l'HÔTE des feuilles de playlist, monté UNE fois au-dessus de la coquille (registre :
 * `overlays`) : gérer, créer, renommer, partager (lien, personnes du serveur), importer. L'import reste monté même feuille fermée — un
 * import en cours continue, son avis dira la fin.
 */

import { ImportFlow } from "./ImportSheet";
import { ManageSheet, NameSheet } from "./ManageSheets";
import { ShareSheet } from "./ShareSheet";
import { MembersSheet } from "../members/MembersSheet";
import { usePlaylistSheet } from "./playlistSheetStore";

export function PlaylistSheetsHost() {
  const sheet = usePlaylistSheet();
  return (
    <>
      <ImportFlow open={sheet?.kind === "import"} prefill={sheet?.kind === "import" ? sheet.prefill : undefined} autoStart={sheet?.kind === "import" && !!sheet.autoStart} into={sheet?.kind === "import" ? (sheet.into ?? null) : null} />
      {sheet?.kind === "manage" ? <ManageSheet key={sheet.playlist.jellyfinId} playlist={sheet.playlist} /> : null}
      {sheet?.kind === "rename" ? <NameSheet key={`rename:${sheet.playlist.jellyfinId}`} playlist={sheet.playlist} /> : null}
      {sheet?.kind === "create" ? <NameSheet key="create" /> : null}
      {sheet?.kind === "share" ? <ShareSheet key={`share:${sheet.playlist.jellyfinId}`} playlist={sheet.playlist} /> : null}
      {sheet?.kind === "members" ? <MembersSheet key={`members:${sheet.playlist.jellyfinId}`} playlist={sheet.playlist} /> : null}
    </>
  );
}
