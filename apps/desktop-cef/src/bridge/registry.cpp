#include "registry.h"

#include <algorithm>
#include <stdexcept>

namespace bridge {
namespace {

// Une seule occurrence dans `tentacle-bridge.js` : un jeton répété dans un commentaire
// a déjà fait échouer l'injection (ReferenceError au chargement, pont absent).
constexpr const char* kConfigToken = "__TENTACLE_SHIM_CONFIG__";

bool contains(const std::vector<std::string>& list, const std::string& name) {
  return std::find(list.begin(), list.end(), name) != list.end();
}

}  // namespace

void Registry::command(const std::string& name, Handler handler) {
  if (contains(commands_, name)) throw std::logic_error("commande déclarée deux fois : " + name);
  commands_.push_back(name);
  ipc_.registerHandler(kPrefix + name, std::move(handler));
}

void Registry::event(const std::string& name) {
  if (!contains(events_, name)) events_.push_back(name);
}

void Registry::emit(const std::string& name, const Json& payload) {
  // Un évènement non déclaré ne partirait vers aucun écouteur de la page (le shim
  // filtre) : c'est un oubli de déclaration, à voir tout de suite.
  if (!contains(events_, name)) throw std::logic_error("évènement non déclaré : " + name);
  ipc_.emit(kPrefix + name, payload);
}

std::string Registry::injectedScript(const std::string& shimSource, const ShimConfig& config) const {
  const auto first = shimSource.find(kConfigToken);
  if (first == std::string::npos || shimSource.find(kConfigToken, first + 1) != std::string::npos) {
    throw std::logic_error("le shim doit contenir exactement un jeton de configuration");
  }
  const Json json = {
      {"origins", config.origins},
      {"serverUrl", config.serverUrl},
      {"version", config.version},
      {"platform", config.platform},
      {"titleBarHeight", config.titleBarHeight},
      {"windowFocus", config.windowFocus},
      {"montage", config.montage},
      {"windowing", config.windowing},
      {"liquidGlass", config.liquidGlass},
      {"commands", commands_},
      {"events", events_},
  };
  // `ensure_ascii` : tout non-ASCII part en \uXXXX — U+2028/2029 compris (leçon
  // `95bc630` de la référence : jamais de JSON fait main dans du JS).
  std::string script = shimSource;
  script.replace(first, std::char_traits<char>::length(kConfigToken), json.dump(-1, ' ', true));
  return script;
}

}  // namespace bridge
