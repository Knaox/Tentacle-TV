#pragma once
// Le processus de rendu est tombé (plantage, mémoire, tué) : que fait-on de la page ? Sans
// rien, elle reste la dernière image reçue — figée, sourde aux clics — ou noire si rien n'avait
// encore été peint : « comme une page sans contenu ». La règle, pure (ni CEF ni horloge) :
//   1. une première chute : la MÊME page est rechargée, tout de suite ;
//   2. une deuxième dans la minute : la page d'ACCUEIL (la route elle-même peut être la cause) ;
//   3. les suivantes : l'accueil, de plus en plus tard (2, 5, 10, 30 s) — jamais abandonné,
//      jamais une boucle serrée.
// Une minute sans chute, et le compteur repart.

#include <cstdint>
#include <string>

namespace tentacle::recovery {

constexpr uint64_t kCrashWindowMs = 60'000;

enum class Target { samePage, startPage };

struct Step {
  Target target = Target::samePage;
  int delayMs = 0;
  int strike = 1;  // la n-ième chute de la série
};

class CrashPolicy {
 public:
  /// Une chute constatée à `nowMs` (horloge monotone) : ce qu'il faut recharger, et quand.
  Step onCrash(uint64_t nowMs);
  int strikes() const { return strikes_; }

 private:
  int strikes_ = 0;
  uint64_t lastMs_ = 0;
};

/// La cause, en mots, d'après `cef_termination_status_t` (valeurs de CEF 156, recopiées pour
/// rester sans CEF) : 0 anormale, 1 tué, 2 plantage, 3 mémoire épuisée, 4 lancement raté,
/// 5 intégrité du code.
const char* statusName(int status);

/// La ligne du journal d'une chute.
std::string describe(int status, int errorCode, const std::string& errorText, const Step& step);

}  // namespace tentacle::recovery
