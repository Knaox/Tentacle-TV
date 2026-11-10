#pragma once
// Octave (axe medias) — la copie d'un titre GARDÉE HORS LIGNE, lue par le moteur audio à la
// place du serveur (`ipc/audioKept.ts` d'Electron). Le chemin vient de NOTRE base, jamais de la
// page : elle dit seulement « ce titre, pour ce compte » (`AudioBridgeSource.kept`). Le fichier
// est revérifié à chaque lecture (présent, taille exacte) : effacé hors de l'app, il passe en
// défaut et le serveur reprend.

#include <functional>
#include <optional>
#include <string>

namespace tentacle::offline {

/// Le chemin ABSOLU (UTF-8) de la copie gardée de `trackKey` par `userId`, ou rien. `done` est
/// rappelé sur le FIL PRINCIPAL, une fois. Électron : `keptPathFor(kept, trackKey)` →
/// `keptAudioPath(kept.userId, kept.trackKey ?? trackKey)`.
void keptAudioPath(std::string userId, std::string trackKey, std::function<void(std::optional<std::string>)> done);

/// La même, SYNCHRONE — pour `music::setKeptLookup` (axe medias), appelée par `audio_play` sur
/// le fil principal, comme Electron (synchrone dans son processus principal). Le fil hors ligne
/// répond en quelques millisecondes ; au-delà de 500 ms (disque endormi), le serveur, comme si
/// rien n'était gardé. Jamais depuis le fil hors ligne lui-même.
std::optional<std::string> keptAudioPathSync(const std::string& userId, const std::string& trackKey);

}  // namespace tentacle::offline
