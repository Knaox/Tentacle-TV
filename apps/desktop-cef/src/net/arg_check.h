#pragma once
// Les arguments d'une commande de la page, vérifiés comme le font les schémas zod d'Electron
// (`registry.ts`) : une commande dont un argument est refusé n'est jamais exécutée, et le refus
// dit lequel. Champs en trop ignorés, `null`/absent = objet vide (`raw ?? {}`).

#include <optional>
#include <string>

#include "net/cef_fetch.h"
#include "ports.h"

namespace tentacle::net {

/// `true` pour une URL absolue http(s) sans identifiants (`ipc/httpUrl.ts`).
bool isHttpUrl(const std::string& raw);

class ArgCheck {
 public:
  ArgCheck(std::string command, const bridge::Json& args);
  /// Une chaîne d'au moins `minLength` caractères (UTF-16 en JS ; octets ici, suffisant pour
  /// « non vide »), au plus `maxLength` octets.
  std::optional<std::string> str(const char* name, size_t minLength = 0, size_t maxLength = SIZE_MAX);
  std::optional<std::string> optStr(const char* name);
  std::optional<std::string> httpUrl(const char* name);
  std::optional<double> number(const char* name);
  std::optional<bool> boolean(const char* name);
  const bridge::Json* field(const char* name) const;
  void invalid(const std::string& name, const std::string& why = "valeur refusee");
  bool ok() const { return error_.empty(); }
  /// « arguments invalides pour <commande>: <champ> … », comme Electron.
  std::string error() const { return "arguments invalides pour " + command_ + ": " + error_; }

 private:
  std::string command_;
  bridge::Json args_;
  std::string error_;
};

/// Le motif d'un échec réseau, comme le message d'un `net.fetch` rejeté.
std::string networkError(const HttpResponse& r);

}  // namespace tentacle::net
