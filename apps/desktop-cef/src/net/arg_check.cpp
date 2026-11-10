// Vérification des arguments des commandes (voir arg_check.h).

#include "net/arg_check.h"

#include "net/web_url.h"

namespace tentacle::net {

bool isHttpUrl(const std::string& raw) {
  const auto url = parseHttpUrl(raw);
  return url && url->username.empty() && url->password.empty();
}

ArgCheck::ArgCheck(std::string command, const bridge::Json& args)
    : command_(std::move(command)), args_(args.is_null() ? bridge::Json::object() : args) {
  if (!args_.is_object()) error_ = "objet attendu";
}

const bridge::Json* ArgCheck::field(const char* name) const {
  if (!args_.is_object()) return nullptr;
  auto it = args_.find(name);
  return it == args_.end() || it->is_null() ? nullptr : &*it;
}

void ArgCheck::invalid(const std::string& name, const std::string& why) {
  if (error_.empty()) error_ = name + " : " + why;
}

std::optional<std::string> ArgCheck::str(const char* name, size_t minLength, size_t maxLength) {
  const bridge::Json* v = field(name);
  if (!v || !v->is_string()) {
    invalid(name, "chaine attendue");
    return std::nullopt;
  }
  std::string s = v->get<std::string>();
  if (s.size() < minLength || s.size() > maxLength) {
    invalid(name, "longueur refusee");
    return std::nullopt;
  }
  return s;
}

std::optional<std::string> ArgCheck::optStr(const char* name) {
  const bridge::Json* v = field(name);
  if (!v) return std::nullopt;
  if (!v->is_string()) {
    invalid(name, "chaine attendue");
    return std::nullopt;
  }
  return v->get<std::string>();
}

std::optional<std::string> ArgCheck::httpUrl(const char* name) {
  auto s = str(name);
  if (s && !isHttpUrl(*s)) {
    invalid(name, "adresse http(s) attendue");
    return std::nullopt;
  }
  return s;
}

std::optional<double> ArgCheck::number(const char* name) {
  const bridge::Json* v = field(name);
  if (!v || !v->is_number()) {
    invalid(name, "nombre attendu");
    return std::nullopt;
  }
  return v->get<double>();
}

std::optional<bool> ArgCheck::boolean(const char* name) {
  const bridge::Json* v = field(name);
  if (!v || !v->is_boolean()) {
    invalid(name, "booleen attendu");
    return std::nullopt;
  }
  return v->get<bool>();
}

std::string networkError(const HttpResponse& r) {
  if (r.timedOut) return "This operation was aborted";
  if (r.tooLarge) return "reponse trop grande";
  return "fetch failed (net error " + std::to_string(r.error) + ")";
}

}  // namespace tentacle::net
