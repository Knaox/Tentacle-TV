#pragma once
// Lecture TYPÉE des lignes — le `rows.ts` d'Electron.
//
// Une valeur d'un type inattendu n'est pas une donnée à rattraper : c'est une incohérence
// entre le code et le schéma, donc un défaut. On lève, avec le nom de la colonne.
//
// Deux familles d'entiers : `integer` (int64, pour la logique) et `number` (JSON, qui garde
// un REAL tel quel — la page peut envoyer une position fractionnaire, et Electron la rend
// comme il l'a reçue).

#include <cmath>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>

#include <nlohmann/json.hpp>

#include "offline/core/sqlite.h"

namespace tentacle::offline {

using Json = nlohmann::json;

namespace rows_detail {
inline const Value& pick(const Row& row, std::string_view column) {
  const Value* value = row.find(column);
  if (value == nullptr) throw std::runtime_error("colonne absente du resultat : " + std::string(column));
  return *value;
}
[[noreturn]] inline void refuse(std::string_view column, const char* expected) {
  throw std::runtime_error("colonne " + std::string(column) + " : " + expected + " attendu");
}
}  // namespace rows_detail

inline bool isNull(const Row& row, std::string_view column) {
  return std::holds_alternative<std::monostate>(rows_detail::pick(row, column));
}

inline std::string text(const Row& row, std::string_view column) {
  const Value& v = rows_detail::pick(row, column);
  if (const auto* s = std::get_if<std::string>(&v)) return *s;
  rows_detail::refuse(column, "texte");
}

inline std::optional<std::string> textOrNull(const Row& row, std::string_view column) {
  const Value& v = rows_detail::pick(row, column);
  if (std::holds_alternative<std::monostate>(v)) return std::nullopt;
  if (const auto* s = std::get_if<std::string>(&v)) return *s;
  rows_detail::refuse(column, "texte");
}

inline std::optional<int64_t> integerOrNull(const Row& row, std::string_view column) {
  const Value& v = rows_detail::pick(row, column);
  if (std::holds_alternative<std::monostate>(v)) return std::nullopt;
  if (const auto* i = std::get_if<int64_t>(&v)) return *i;
  if (const auto* d = std::get_if<double>(&v)) return static_cast<int64_t>(std::trunc(*d));
  rows_detail::refuse(column, "entier");
}

inline int64_t integer(const Row& row, std::string_view column) {
  const auto value = integerOrNull(row, column);
  if (!value) rows_detail::refuse(column, "entier");
  return *value;
}

/// Le nombre tel que stocké (entier, ou réel s'il ne l'était pas) ; `null` s'il est nul.
inline Json numberOrNull(const Row& row, std::string_view column) {
  const Value& v = rows_detail::pick(row, column);
  if (std::holds_alternative<std::monostate>(v)) return nullptr;
  if (const auto* i = std::get_if<int64_t>(&v)) return *i;
  if (const auto* d = std::get_if<double>(&v)) return *d;
  rows_detail::refuse(column, "entier");
}

inline Json number(const Row& row, std::string_view column) {
  Json value = numberOrNull(row, column);
  if (value.is_null()) rows_detail::refuse(column, "entier");
  return value;
}

/// Booléen stocké en 0 / 1.
inline bool flag(const Row& row, std::string_view column) { return integer(row, column) != 0; }

/// Booléen prêt à être LIÉ.
inline int64_t bit(bool value) { return value ? 1 : 0; }

/// Un nombre de la page, prêt à être lié : entier s'il l'est, réel sinon (comme node:sqlite,
/// dont l'INTEGER de la colonne garde ensuite la valeur entière).
inline Param numberParam(const Json& value) {
  if (value.is_null()) return Param{};
  if (value.is_number_integer()) return Param{value.get<int64_t>()};
  if (value.is_number()) {
    const double d = value.get<double>();
    if (std::trunc(d) == d && std::abs(d) < 9007199254740992.0) return Param{static_cast<int64_t>(d)};
    return Param{d};
  }
  throw std::runtime_error("nombre attendu");
}

}  // namespace tentacle::offline
