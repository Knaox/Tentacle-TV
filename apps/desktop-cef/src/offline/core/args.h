#pragma once
// Validation des charges de la page — les schémas zod des commandes d'Electron
// (`apps/desktop-electron/src/main/ipc/downloads*.ts`, `session.ts`).
//
// Même règle qu'Electron : une commande dont les arguments ne passent pas n'est JAMAIS
// exécutée. Les identifiants finissent dans des chemins et des URL : les valider ici, c'est
// ce qui empêche la page — ou un serveur qui la nourrit — de faire écrire n'importe où.
// Une charge absente vaut `{}` (comme `raw ?? {}`) ; les clés inconnues sont ignorées.

#include <cstdint>
#include <optional>
#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

namespace tentacle::offline::args {

using Json = nlohmann::json;

/// Refus d'une charge : `arguments invalides pour <commande>: <raison>` côté journal.
struct Invalid : std::runtime_error {
  using std::runtime_error::runtime_error;
};

/// La valeur d'une clé : `nullptr` si absente (≠ `null` explicite, qui est une valeur JSON).
const Json* field(const Json& payload, const char* key);

/// Chaîne obligatoire, bornée en longueur (UNITÉS UTF-16, comme zod : `.min()` / `.max()`).
std::string str(const Json& payload, const char* key, size_t min = 0, size_t max = SIZE_MAX);
/// `.nullish()` : absente ou `null` → rien.
std::optional<std::string> optStr(const Json& payload, const char* key, size_t max = SIZE_MAX);
/// `.nullable()` : `null` permis, absence refusée.
std::optional<std::string> nullableStr(const Json& payload, const char* key, size_t min = 0, size_t max = SIZE_MAX);
/// Une chaîne parmi une liste fermée.
std::string oneOf(const Json& payload, const char* key, std::initializer_list<const char*> allowed);

bool boolean(const Json& payload, const char* key);

/// `z.number()` : un nombre fini (rendu tel quel, entier ou réel).
Json number(const Json& payload, const char* key);
/// `z.number().nullish()`.
Json optNumber(const Json& payload, const char* key);
/// `z.number().int()` (bornes facultatives : `.nonnegative()` → min 0).
int64_t integer(const Json& payload, const char* key, std::optional<int64_t> min = std::nullopt);
/// `z.number().int().nullish()` / `.nullable()` (`required` : la clé doit être là).
std::optional<int64_t> optInteger(const Json& payload, const char* key, bool required = false,
                                  std::optional<int64_t> min = std::nullopt);

/// `HTTP_URL` d'Electron : absolue, `http:` ou `https:`, sans identifiants.
bool isHttpUrl(const std::string& raw);
std::string httpUrl(const Json& payload, const char* key);

/// Longueur d'une chaîne UTF-8 en unités UTF-16 (ce que mesurent `.length` et zod).
size_t utf16Length(const std::string& utf8);

}  // namespace tentacle::offline::args
