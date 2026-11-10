// Octave — la TRANSITION DOUCE dans mpv, règles pures : port de `crossfadeFilter.ts` (le gain
// de chaque instance est un filtre `volume` de libavfilter dont l'expression suit le TEMPS DU
// FLUX) et de `crossfadeTiming.ts` (quand armer le fondu). Le POURQUOI est dans ces fichiers.
//
// ⚠️ `af-command` vise l'étiquette SANS `@` et la cible `volume` (mesuré : refus sinon).
// Jamais en mode exclusif : la sortie « bit pour bit » n'a ni filtre ni second flux.
#pragma once

#include <optional>
#include <string>
#include <vector>

#include "music/engine_state.h"

namespace tentacle::music {

constexpr const char* kXfLabel = "xf";
// La sortie courte d'un titre quitté par un geste : des gains constants tous les 10 ms.
constexpr int kCutStepMs = 10;
// À moins de cela du départ du fondu, on l'arme ; en deçà de TOO_LATE, trop tard.
constexpr double kArmAheadS = 2;
constexpr double kTooLateS = 0.4;
// Le temps qu'une instance en pause, déjà chargée, met à faire sortir son son (mesuré).
constexpr int kResumeLatencyMs = 30;

// Ce que la transition douce lit d'une instance.
struct DeckTimeline {
  double positionS = 0;
  double offsetS = 0;                // début de la chronologie de l'entrée mpv dans le titre
  std::optional<double> durationS;
  bool complete = false;
  bool playing = false;
  bool loaded = false;               // un fichier chargé (départ fait, pause comprise), sans erreur
  bool ended = false;                // arrêtée sur la vraie fin de son dernier titre
};

std::string lavfiEscape(const std::string& expr);
// La chaîne `af` d'une instance : le gain du fondu (`expr`), PUIS la mesure du niveau.
std::string deckChain(const std::string& expr = "1");
std::string fadeInExpr(double durationS);
std::string fadeOutExpr(double startS, double durationS);
std::vector<std::string> gainCommand(const std::string& expr);
std::vector<double> cutSteps(int ms);

struct ArmDecision {
  enum class Kind { Wait, Arm, Late } kind = Kind::Wait;
  double startS = 0;  // courbe de sortie, chronologie de l'ENTRÉE mpv
  int delayMs = 0;    // lancement du suivant
  bool operator==(const ArmDecision&) const = default;
};
ArmDecision armDecision(const DeckTimeline& tl, double fadeS);
DeckTimeline deckTimeline(const EntryPtr& current, const LiveProps& props, const EngineFlags& flags, double positionS);

}  // namespace tentacle::music
