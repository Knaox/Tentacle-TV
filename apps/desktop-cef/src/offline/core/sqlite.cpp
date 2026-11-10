#include "offline/core/sqlite.h"

#include <sqlite3.h>

#include <stdexcept>

#include "offline/core/utf8_path.h"

namespace tentacle::offline {

const Value* Row::find(std::string_view name) const {
  for (const auto& [column, value] : columns) {
    if (column == name) return &value;
  }
  return nullptr;
}

// --- Statement ----------------------------------------------------------------------------

Statement::Statement(Statement&& other) noexcept : db_(other.db_), stmt_(other.stmt_) {
  other.stmt_ = nullptr;
}

Statement::~Statement() {
  if (stmt_ != nullptr) sqlite3_finalize(stmt_);
}

void Statement::fail(const char* what) const {
  throw std::runtime_error(std::string(what) + " : " + sqlite3_errmsg(db_));
}

void Statement::bind(std::initializer_list<Param> params) {
  sqlite3_reset(stmt_);
  sqlite3_clear_bindings(stmt_);
  int index = 1;
  for (const Param& p : params) {
    int rc = SQLITE_OK;
    if (std::holds_alternative<std::monostate>(p)) {
      rc = sqlite3_bind_null(stmt_, index);
    } else if (const auto* i = std::get_if<int64_t>(&p)) {
      rc = sqlite3_bind_int64(stmt_, index, *i);
    } else if (const auto* d = std::get_if<double>(&p)) {
      rc = sqlite3_bind_double(stmt_, index, *d);
    } else {
      const auto& s = std::get<std::string>(p);
      rc = sqlite3_bind_text(stmt_, index, s.data(), static_cast<int>(s.size()), SQLITE_TRANSIENT);
    }
    if (rc != SQLITE_OK) fail("liaison");
    ++index;
  }
  // Moins de paramètres que de `?` : SQLite lierait NULL en silence — un défaut du code.
  if (index - 1 != sqlite3_bind_parameter_count(stmt_)) {
    throw std::runtime_error("nombre de paramètres inattendu pour : " + std::string(sqlite3_sql(stmt_)));
  }
}

bool Statement::step() {
  const int rc = sqlite3_step(stmt_);
  if (rc == SQLITE_ROW) return true;
  if (rc == SQLITE_DONE) return false;
  fail("exécution");
}

Row Statement::readRow() const {
  Row row;
  const int n = sqlite3_column_count(stmt_);
  row.columns.reserve(static_cast<size_t>(n));
  for (int i = 0; i < n; ++i) {
    Value value;
    switch (sqlite3_column_type(stmt_, i)) {
      case SQLITE_INTEGER:
        value = static_cast<int64_t>(sqlite3_column_int64(stmt_, i));
        break;
      case SQLITE_FLOAT:
        value = sqlite3_column_double(stmt_, i);
        break;
      case SQLITE_TEXT: {
        const auto* text = reinterpret_cast<const char*>(sqlite3_column_text(stmt_, i));
        value = std::string(text, static_cast<size_t>(sqlite3_column_bytes(stmt_, i)));
        break;
      }
      case SQLITE_BLOB: {
        const auto* blob = static_cast<const uint8_t*>(sqlite3_column_blob(stmt_, i));
        value = std::vector<uint8_t>(blob, blob + sqlite3_column_bytes(stmt_, i));
        break;
      }
      default:
        break;
    }
    row.columns.emplace_back(sqlite3_column_name(stmt_, i), std::move(value));
  }
  return row;
}

std::optional<Row> Statement::getWith(std::initializer_list<Param> params) {
  bind(params);
  std::optional<Row> row;
  if (step()) row = readRow();
  sqlite3_reset(stmt_);
  return row;
}

std::vector<Row> Statement::allWith(std::initializer_list<Param> params) {
  bind(params);
  std::vector<Row> rows;
  while (step()) rows.push_back(readRow());
  sqlite3_reset(stmt_);
  return rows;
}

RunResult Statement::runWith(std::initializer_list<Param> params) {
  bind(params);
  while (step()) {
  }
  sqlite3_reset(stmt_);
  return {sqlite3_changes64(db_), sqlite3_last_insert_rowid(db_)};
}

// --- Database -----------------------------------------------------------------------------

std::unique_ptr<Database> Database::open(const std::filesystem::path& file) {
  sqlite3* db = nullptr;
  // Chemin en UTF-8 sur les trois systèmes (Windows : le chemin large, converti — jamais la
  // page de code ANSI, qui perdrait un dossier « Données » ou un prénom accentué).
  const std::string name = file == ":memory:" ? std::string(":memory:") : pathToUtf8(file);
  const int rc = sqlite3_open_v2(name.c_str(), &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE, nullptr);
  if (rc != SQLITE_OK) {
    const std::string message = db != nullptr ? sqlite3_errmsg(db) : "mémoire";
    sqlite3_close(db);
    throw std::runtime_error("ouverture de " + name + " : " + message);
  }
  return std::unique_ptr<Database>(new Database(db));
}

std::unique_ptr<Database> Database::openInMemory() { return open(":memory:"); }

Database::~Database() { close(); }

void Database::exec(const std::string& sql) {
  char* error = nullptr;
  if (sqlite3_exec(db_, sql.c_str(), nullptr, nullptr, &error) != SQLITE_OK) {
    const std::string message = error != nullptr ? error : sqlite3_errmsg(db_);
    sqlite3_free(error);
    throw std::runtime_error(message);
  }
}

Statement Database::prepare(const std::string& sql) {
  if (db_ == nullptr) throw std::runtime_error("base fermée");
  sqlite3_stmt* stmt = nullptr;
  if (sqlite3_prepare_v2(db_, sql.c_str(), static_cast<int>(sql.size()), &stmt, nullptr) != SQLITE_OK) {
    throw std::runtime_error(std::string("préparation : ") + sqlite3_errmsg(db_) + " — " + sql);
  }
  return Statement(db_, stmt);
}

void Database::close() {
  if (db_ == nullptr) return;
  // `sqlite3_close_v2` : une requête préparée encore vivante ne fait pas échouer la
  // fermeture, elle la diffère — le WAL est replié à la dernière finalisation.
  sqlite3_close_v2(db_);
  db_ = nullptr;
}

}  // namespace tentacle::offline
