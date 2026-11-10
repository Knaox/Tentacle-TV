#pragma once
// Le moteur de transferts de l'app (fil hors ligne) et son branchement au cycle de vie.

#include "offline/core/engine.h"

namespace tentacle::offline {

/// Le moteur, construit au PREMIER besoin (fil hors ligne).
DownloadEngine& downloadsEngine();
/// Le moteur s'il existe — sans le construire (pas de moteur, pas de transfert).
DownloadEngine* existingEngine();
/// Le réglage « Continuer en arrière-plan » vient de changer (lu par la fermeture).
void noteBackgroundSetting(bool on);

/// Fil principal, à l'installation : `lifecycle::setTransfersProbe`, reprise au réveil.
void installEngineRuntime();
/// Fil hors ligne, à l'extinction (avant la fermeture de la base).
void shutdownEngineRuntime();

}  // namespace tentacle::offline
