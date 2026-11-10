#pragma once
// La base locale, vue par le cœur hors ligne : une connexion SQLite, des requêtes
// préparées, des lignes lues par NOM de colonne.
//
// C'est le pendant du `DatabaseHandle` d'Electron (`packages/offline-core/src/core/
// adapters.ts`) : `prepare(sql).get/all/run`, `exec` (plusieurs instructions), `close`. Le
// cœur garde ainsi les requêtes SQL d'Electron TELLES QUELLES — elles portent la base que
// les deux coquilles partagent (`tentacle-local.db`).
//
// Une connexion vit sur UN fil (le fil hors ligne, `glue/offline_thread.h`) : rien ici
// n'est protégé contre deux fils, exactement comme la boucle d'évènements d'Electron.

#include <cstdint>
#include <filesystem>
#include <initializer_list>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>

struct sqlite3;
struct sqlite3_stmt;

namespace tentacle::offline {

/// Ce que SQLite rend : NULL, entier, réel, texte, blob.
using Value = std::variant<std::monostate, int64_t, double, std::string, std::vector<uint8_t>>;

/// Ce que l'on LIE. Ni booléen (passer par `bit()`) ni « absent » (passer par `Null`).
using Param = std::variant<std::monostate, int64_t, double, std::string>;
inline constexpr std::monostate Null{};

/// Une ligne, colonnes dans l'ordre du SELECT.
struct Row {
  std::vector<std::pair<std::string, Value>> columns;
  /// `nullptr` : colonne ABSENTE du résultat (≠ colonne nulle, qui vaut `monostate`).
  const Value* find(std::string_view name) const;
};

struct RunResult {
  int64_t changes = 0;
  int64_t lastInsertRowid = 0;
};

// Conversions vers `Param` : ce qui se lie sans surprise.
inline Param param(std::monostate) { return Param{}; }
inline Param param(std::nullptr_t) { return Param{}; }
inline Param param(int v) { return Param{static_cast<int64_t>(v)}; }
inline Param param(long v) { return Param{static_cast<int64_t>(v)}; }
inline Param param(long long v) { return Param{static_cast<int64_t>(v)}; }
inline Param param(unsigned v) { return Param{static_cast<int64_t>(v)}; }
inline Param param(unsigned long v) { return Param{static_cast<int64_t>(v)}; }
inline Param param(unsigned long long v) { return Param{static_cast<int64_t>(v)}; }
inline Param param(double v) { return Param{v}; }
inline Param param(const std::string& v) { return Param{v}; }
inline Param param(std::string_view v) { return Param{std::string(v)}; }
inline Param param(const char* v) { return Param{std::string(v)}; }
inline Param param(const Param& v) { return v; }
template <class T>
Param param(const std::optional<T>& v) {
  return v ? param(*v) : Param{};
}
void param(bool) = delete;  // un booléen passe par `bit()`, comme côté Electron

/// Une requête préparée. Déplaçable, pas copiable.
class Statement {
 public:
  Statement(sqlite3* db, sqlite3_stmt* stmt) : db_(db), stmt_(stmt) {}
  Statement(Statement&& other) noexcept;
  Statement& operator=(Statement&&) = delete;
  Statement(const Statement&) = delete;
  ~Statement();

  template <class... A>
  std::optional<Row> get(const A&... args) {
    return getWith({param(args)...});
  }
  template <class... A>
  std::vector<Row> all(const A&... args) {
    return allWith({param(args)...});
  }
  template <class... A>
  RunResult run(const A&... args) {
    return runWith({param(args)...});
  }

  std::optional<Row> getWith(std::initializer_list<Param> params);
  std::vector<Row> allWith(std::initializer_list<Param> params);
  RunResult runWith(std::initializer_list<Param> params);

 private:
  void bind(std::initializer_list<Param> params);
  bool step();  // vrai : une ligne est prête
  Row readRow() const;
  [[noreturn]] void fail(const char* what) const;

  sqlite3* db_;
  sqlite3_stmt* stmt_;
};

/// La connexion. Lève `std::runtime_error` (message de SQLite) sur tout échec.
class Database {
 public:
  /// Ouvre (et crée au besoin) le fichier. `":memory:"` : une base en mémoire (tests).
  static std::unique_ptr<Database> open(const std::filesystem::path& file);
  static std::unique_ptr<Database> openInMemory();
  ~Database();
  Database(const Database&) = delete;
  Database& operator=(const Database&) = delete;

  /// Plusieurs instructions permises (les paliers de schéma en dépendent).
  void exec(const std::string& sql);
  Statement prepare(const std::string& sql);
  void close();

 private:
  explicit Database(sqlite3* db) : db_(db) {}
  sqlite3* db_;
};

}  // namespace tentacle::offline
