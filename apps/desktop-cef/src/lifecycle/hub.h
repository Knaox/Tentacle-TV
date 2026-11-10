#pragma once
// Ce que les modules ont déclaré au cycle de vie (lifecycle.h), lu par sa colle
// (lifecycle_shell.cpp). Interne à src/lifecycle/ — fil principal.

#include <functional>

#include "lifecycle/lifecycle.h"
#include "lifecycle/playback_farewell.h"

namespace tentacle::lifecycle::hub {

/// Transferts pas finis ; 0 sans moteur déclaré ou si le comptage échoue.
int transfersInFlight();
bool transfersBusy();
/// Le réglage « Continuer en arrière-plan » ; vrai par défaut (et si la lecture échoue).
bool backgroundEnabled();

PlaybackFarewell& farewell();
/// L'axe reseau a-t-il branché son émetteur (`setFarewellSender`) ?
bool hasFarewellSender();
/// Poste un arrêt par l'émetteur de l'axe reseau ; sans émetteur, `done` tout de suite.
void sendFarewellStop(const FarewellStop& stop, std::function<void()> done);

void fireWindowClosed();
void fireSystemResume();
/// Rend les deux blocages d'économie d'énergie (sortie : `releaseDisplayWakeLock`,
/// `stopDownloadsRuntime`).
void releaseWakeLocks();

}  // namespace tentacle::lifecycle::hub
