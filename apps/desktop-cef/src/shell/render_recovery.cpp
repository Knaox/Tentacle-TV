#include "shell/render_recovery.h"

namespace tentacle::recovery {

Step CrashPolicy::onCrash(uint64_t nowMs) {
  if (strikes_ > 0 && nowMs - lastMs_ > kCrashWindowMs) strikes_ = 0;
  lastMs_ = nowMs;
  ++strikes_;
  Step step;
  step.strike = strikes_;
  if (strikes_ == 1) return step;
  step.target = Target::startPage;
  static const int kDelays[] = {1000, 2000, 5000, 10000, 30000};
  const int index = strikes_ - 2;
  step.delayMs = kDelays[index < 5 ? index : 4];
  return step;
}

const char* statusName(int status) {
  switch (status) {
    case 0: return "fin anormale";
    case 1: return "tué";
    case 2: return "plantage";
    case 3: return "mémoire épuisée";
    case 4: return "lancement raté";
    case 5: return "intégrité du code refusée";
    default: return "cause inconnue";
  }
}

std::string describe(int status, int errorCode, const std::string& errorText, const Step& step) {
  std::string line = std::string("[rendu] le processus de rendu est tombé (") + statusName(status) +
                     ", code " + std::to_string(errorCode);
  if (!errorText.empty() && errorText != std::to_string(errorCode)) line += " " + errorText;
  line += ") — chute n° " + std::to_string(step.strike) + " : ";
  line += step.target == Target::samePage ? "la page est rechargée" : "retour à l'accueil";
  if (step.delayMs > 0) line += " dans " + std::to_string(step.delayMs / 1000) + " s";
  return line;
}

}  // namespace tentacle::recovery
