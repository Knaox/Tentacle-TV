#pragma once
// Le fil principal retenu : QUI l'a tenu, et combien de temps. Tout le socle vit sur ce fil
// (pompe de CEF, saisie, composition) : une étape qui dure, c'est l'app entière figée — le clic
// qui « ne répond pas ». Chaque évènement et chaque passe de travail sont chronométrés ; au-delà
// de `kJournalMs`, une ligne au journal dit l'étape et, s'il y en a un, le geste précis qui a
// pris le temps (`Scope` imbriqué : « bulle d'aide : afficher »). Lu par les bancs
// (`shell.debug.stalls`). Règle pure : ni SDL, ni CEF.

#include <chrono>
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace tentacle::stall {

/// Trois images à 60 Hz : en deçà, personne ne voit rien.
constexpr double kJournalMs = 50.0;
constexpr std::size_t kRecentMax = 16;

struct Record {
  std::string what;    // l'étape (« clic », « travail de CEF »…)
  std::string detail;  // le geste le plus long à l'intérieur, ou ""
  double ms = 0;
};

class Meter {
 public:
  /// Une étape finie. Rend vrai quand elle mérite une ligne au journal.
  bool note(const std::string& what, double ms);
  /// Un geste nommé, à l'intérieur de l'étape en cours : le plus long est gardé comme détail.
  void noteInner(const std::string& what, double ms);
  double maxMs() const { return maxMs_; }
  const std::string& maxWhat() const { return maxWhat_; }
  uint64_t count() const { return count_; }
  /// Les derniers arrêts journalisés, du plus ancien au plus récent.
  const std::vector<Record>& recent() const { return recent_; }
  void reset();

 private:
  double maxMs_ = 0;
  std::string maxWhat_;
  uint64_t count_ = 0;
  std::vector<Record> recent_;
  std::string innerWhat_;
  double innerMs_ = 0;
};

/// La ligne du journal d'un arrêt.
std::string describe(const Record& r);

/// Le compteur du fil principal.
Meter& meter();

/// Chronomètre une étape (`inner` faux) ou un geste à l'intérieur d'une étape (`inner` vrai),
/// et écrit la ligne du journal quand l'étape a retenu le fil.
class Scope {
 public:
  explicit Scope(const char* what, bool inner = false)
      : what_(what), inner_(inner), t0_(std::chrono::steady_clock::now()) {}
  ~Scope();
  Scope(const Scope&) = delete;
  Scope& operator=(const Scope&) = delete;

 private:
  const char* what_;
  bool inner_;
  std::chrono::steady_clock::time_point t0_;
};

/// Exécute `fn`, le compte comme un geste de l'étape en cours, et rend sa durée (ms).
template <typename F>
double timedInner(const char* what, F&& fn) {
  const auto t0 = std::chrono::steady_clock::now();
  fn();
  const double ms =
      std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
  meter().noteInner(what, ms);
  return ms;
}

}  // namespace tentacle::stall
