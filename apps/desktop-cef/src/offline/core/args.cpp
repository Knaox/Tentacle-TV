#include "offline/core/args.h"

#include <cctype>
#include <cmath>

namespace tentacle::offline::args {
namespace {

[[noreturn]] void refuse(const char* key, const std::string& why) {
  throw Invalid(std::string(key) + " : " + why);
}

const Json& required(const Json& payload, const char* key) {
  const Json* value = field(payload, key);
  if (value == nullptr) refuse(key, "requis");
  return *value;
}

std::string checkedString(const Json& value, const char* key, size_t min, size_t max) {
  if (!value.is_string()) refuse(key, "chaîne attendue");
  std::string s = value.get<std::string>();
  const size_t length = utf16Length(s);
  if (length < min) refuse(key, "trop courte");
  if (length > max) refuse(key, "trop longue");
  return s;
}

bool isFinite(const Json& value) {
  if (value.is_number_integer()) return true;
  return value.is_number_float() && std::isfinite(value.get<double>());
}

int64_t checkedInteger(const Json& value, const char* key, std::optional<int64_t> min) {
  if (!isFinite(value)) refuse(key, "nombre attendu");
  int64_t n = 0;
  if (value.is_number_integer()) {
    n = value.get<int64_t>();
  } else {
    const double d = value.get<double>();
    if (std::trunc(d) != d) refuse(key, "entier attendu");
    n = static_cast<int64_t>(d);
  }
  if (min && n < *min) refuse(key, "trop petit");
  return n;
}

}  // namespace

const Json* field(const Json& payload, const char* key) {
  if (!payload.is_object()) return nullptr;
  const auto it = payload.find(key);
  return it == payload.end() ? nullptr : &*it;
}

std::string str(const Json& payload, const char* key, size_t min, size_t max) {
  return checkedString(required(payload, key), key, min, max);
}

std::optional<std::string> optStr(const Json& payload, const char* key, size_t max) {
  const Json* value = field(payload, key);
  if (value == nullptr || value->is_null()) return std::nullopt;
  return checkedString(*value, key, 0, max);
}

std::optional<std::string> nullableStr(const Json& payload, const char* key, size_t min, size_t max) {
  const Json& value = required(payload, key);
  if (value.is_null()) return std::nullopt;
  return checkedString(value, key, min, max);
}

std::string oneOf(const Json& payload, const char* key, std::initializer_list<const char*> allowed) {
  const std::string value = str(payload, key);
  for (const char* candidate : allowed) {
    if (value == candidate) return value;
  }
  refuse(key, "valeur inattendue");
}

bool boolean(const Json& payload, const char* key) {
  const Json& value = required(payload, key);
  if (!value.is_boolean()) refuse(key, "booléen attendu");
  return value.get<bool>();
}

Json number(const Json& payload, const char* key) {
  const Json& value = required(payload, key);
  if (!isFinite(value)) refuse(key, "nombre attendu");
  return value;
}

Json optNumber(const Json& payload, const char* key) {
  const Json* value = field(payload, key);
  if (value == nullptr || value->is_null()) return nullptr;
  if (!isFinite(*value)) refuse(key, "nombre attendu");
  return *value;
}

int64_t integer(const Json& payload, const char* key, std::optional<int64_t> min) {
  return checkedInteger(required(payload, key), key, min);
}

std::optional<int64_t> optInteger(const Json& payload, const char* key, bool requiredKey,
                                  std::optional<int64_t> min) {
  const Json* value = field(payload, key);
  if (value == nullptr) {
    if (requiredKey) refuse(key, "requis");
    return std::nullopt;
  }
  if (value->is_null()) return std::nullopt;
  return checkedInteger(*value, key, min);
}

bool isHttpUrl(const std::string& raw) {
  // L'analyseur d'URL retire les blancs de tête et de queue ; on fait de même.
  size_t start = 0;
  size_t end = raw.size();
  while (start < end && static_cast<unsigned char>(raw[start]) <= 0x20) ++start;
  while (end > start && static_cast<unsigned char>(raw[end - 1]) <= 0x20) --end;
  const std::string url = raw.substr(start, end - start);
  std::string lower;
  for (const char c : url.substr(0, 8)) lower.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
  size_t at = 0;
  if (lower.rfind("http://", 0) == 0) at = 7;
  else if (lower.rfind("https://", 0) == 0) at = 8;
  else return false;
  const size_t authorityEnd = url.find_first_of("/?#\\", at);
  const std::string authority = url.substr(at, authorityEnd == std::string::npos ? std::string::npos : authorityEnd - at);
  // Identifiants (`user:pass@`) refusés, hôte vide refusé, blanc dans l'hôte refusé.
  if (authority.empty() || authority.find('@') != std::string::npos) return false;
  for (const char c : authority) {
    if (static_cast<unsigned char>(c) <= 0x20) return false;
  }
  return authority[0] != ':';
}

std::string httpUrl(const Json& payload, const char* key) {
  std::string value = str(payload, key);
  if (!isHttpUrl(value)) refuse(key, "adresse http(s) attendue");
  return value;
}

size_t utf16Length(const std::string& utf8) {
  size_t units = 0;
  for (size_t i = 0; i < utf8.size();) {
    const auto c = static_cast<unsigned char>(utf8[i]);
    const size_t width = c < 0x80 ? 1 : c < 0xe0 ? 2 : c < 0xf0 ? 3 : 4;
    units += width == 4 ? 2 : 1;  // hors du plan de base : une paire de substitution
    i += width;
  }
  return units;
}

}  // namespace tentacle::offline::args
