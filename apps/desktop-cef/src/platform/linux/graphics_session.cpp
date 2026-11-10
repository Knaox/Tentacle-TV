#include "platform/linux/graphics_session.h"

#include <cstdlib>
#include <fstream>
#include <sstream>

#include <nlohmann/json.hpp>

#include "shell/paths.h"

namespace tentacle::platform {

std::optional<SessionChoice> parseSessionChoice(std::string_view t) {
  if (t == "auto") return SessionChoice::kAuto;
  if (t == "wayland") return SessionChoice::kWayland;
  if (t == "x11") return SessionChoice::kX11;
  return std::nullopt;
}

const char* sessionChoiceName(SessionChoice c) {
  switch (c) {
    case SessionChoice::kWayland: return "wayland";
    case SessionChoice::kX11: return "x11";
    default: return "auto";
  }
}

const char* displayServerName(DisplayServer d) {
  switch (d) {
    case DisplayServer::kWayland: return "wayland";
    case DisplayServer::kX11: return "x11";
    default: return "inconnue";
  }
}

DisplayServer desktopSession(const EnvLookup& env) {
  const auto wl = env("WAYLAND_DISPLAY");
  const auto type = env("XDG_SESSION_TYPE");
  if (wl && !wl->empty() && type.value_or("") != "x11") return DisplayServer::kWayland;
  const auto x = env("DISPLAY");
  if (x && !x->empty()) return DisplayServer::kX11;
  return DisplayServer::kUnknown;
}

DecidedSession decideSession(const EnvLookup& env, SessionChoice choice) {
  DecidedSession d;
  d.choice = choice;
  d.desktop = desktopSession(env);
  // Sous-surface : la vidéo suit la fenêtre sous tout compositeur. `auto` prend donc la
  // session du bureau, sans le détour XWayland d'Electron (GNOME, wlroots).
  const bool wayland = d.desktop == DisplayServer::kWayland && choice != SessionChoice::kX11;
  d.montage = wayland ? DisplayServer::kWayland : DisplayServer::kX11;
  return d;
}

SessionChoice readSessionChoice(const std::filesystem::path& dataFolder,
                                const std::optional<std::string>& forced) {
  if (forced) {
    if (auto c = parseSessionChoice(*forced)) return *c;
  }
  std::ifstream in(dataFolder / kSessionFile);
  if (!in) return SessionChoice::kAuto;  // premier lancement : le cas normal
  std::stringstream text;
  text << in.rdbuf();
  const auto j = nlohmann::json::parse(text.str(), nullptr, false);
  if (j.is_object() && j.contains("session") && j["session"].is_string()) {
    if (auto c = parseSessionChoice(j["session"].get<std::string>())) return *c;
  }
  return SessionChoice::kAuto;
}

std::string sessionFileContent(SessionChoice c) {
  // `${JSON.stringify({ session: choice }, null, 2)}\n` d'Electron.
  return std::string("{\n  \"session\": \"") + sessionChoiceName(c) + "\"\n}\n";
}

namespace {

std::optional<std::string> processEnv(const char* name) {
  const char* v = std::getenv(name);
  if (!v) return std::nullopt;
  return std::string(v);
}

}  // namespace

const DecidedSession& startupSession() {
  static const DecidedSession decided = [] {
    const auto choice = readSessionChoice(paths::userData(), processEnv("TENTACLE_LINUX_SESSION"));
    return decideSession(processEnv, choice);
  }();
  return decided;
}

const char* linuxMontage() { return displayServerName(startupSession().montage); }

const char* linuxWindowing() {
  // Wayland : la sous-surface suit la fenêtre, fenêtrée comme en plein écran. Hors Wayland,
  // la question ne se pose pas (Electron : `null`).
  return startupSession().montage == DisplayServer::kWayland ? "libre" : "";
}

}  // namespace tentacle::platform
