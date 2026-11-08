#pragma once
// LA règle de décision, pure (aucun réseau, aucune horloge, aucun fichier) : testée hors
// ligne par src/update/tests. Le moteur ne fait qu'appliquer ce qu'elle rend.
//
//   mineure                 → installée en silence au prochain redémarrage, AUCUNE notification
//   majeure                 → une notification (« Plus tard » : rappel ; « Ne plus m'avertir
//                             jusqu'à la prochaine grosse » : silence jusqu'à la majeure suivante)
//   critique / < minVersion → obligatoire : non masquable, bloque l'app… SAUF si l'installation
//                             est impossible (pas de réseau, archive refusée, retour arrière) :
//                             alors un avertissement qui ne bloque pas.

#include <cstdint>
#include <string>

#include "update/manifest.h"
#include "update/state.h"
#include "update/version.h"

namespace tentacle::update {

enum class Prompt { None, Toast, Blocking };
const char* promptName(Prompt p);

struct Decision {
  bool install = false;    // télécharger, vérifier, préparer ; appliquée au prochain redémarrage
  bool mandatory = false;  // mise à jour de sécurité
  Prompt prompt = Prompt::None;
  bool canMute = false;    // « Ne plus m'avertir… » proposé (majeure non obligatoire)
  std::string muteKey;     // la majeure de référence (à mémoriser par « Plus tard » / « Ne plus… »)
  std::string reason;      // code stable : journaux, tests, page
};

struct DecisionInput {
  Version current;
  std::string channel;
  std::string platformKey;  // clé de `Manifest::assets` pour cet appareil
  const Manifest& manifest;
  const DeviceState& state;
  int64_t now = 0;          // secondes Unix
};

Decision decide(const DecisionInput& in);

// Où en est l'installation, du point de vue de l'affichage.
enum class Phase { Idle, Checking, Downloading, Verifying, Staging, Ready, Applying, Failed };
const char* phaseName(Phase p);

// Ce qu'on montre vraiment : une obligatoire ne bloque que si elle PEUT s'installer
// (téléchargement en cours ou prête). Échec (réseau absent, archive refusée) → avertissement ;
// après un échec (`retrying`), les nouveaux essais se font sans voile, qui ne revient qu'une
// fois la mise à jour prête.
Prompt effectivePrompt(const Decision& d, Phase phase, bool retrying = false);

}  // namespace tentacle::update
