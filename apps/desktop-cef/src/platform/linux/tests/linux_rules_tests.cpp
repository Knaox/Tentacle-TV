// Règles pures de Linux (ctest, sans CEF ni affichage) : session graphique (portée de
// apps/desktop-electron/src/main/linux/graphicsSession.test.ts, différences de CEF dites),
// langues du système, EDID HDR (edidHdr.test.ts).

#include <cstdio>
#include <filesystem>
#include <fstream>
#include <map>
#include <string>

#include "platform/linux/graphics_session.h"
#include "platform/linux/locale_linux.h"

using namespace tentacle::platform;

int linuxRuleFailures = 0;  // partagé avec edid_linux_tests.cpp

namespace {

void check(bool ok, const char* what) {
  if (!ok) {
    std::fprintf(stderr, "ÉCHEC : %s\n", what);
    ++linuxRuleFailures;
  }
}

EnvLookup envOf(std::map<std::string, std::string> m) {
  return [m](const char* k) -> std::optional<std::string> {
    auto it = m.find(k);
    if (it == m.end()) return std::nullopt;
    return it->second;
  };
}

void sessionTests() {
  const auto wayland = envOf({{"WAYLAND_DISPLAY", "wayland-0"}, {"DISPLAY", ":0"}, {"XDG_SESSION_TYPE", "wayland"}});
  check(desktopSession(wayland) == DisplayServer::kWayland, "DISPLAY posé sous Wayland : ce n'est pas X11");
  check(desktopSession(envOf({{"DISPLAY", ":0"}, {"XDG_SESSION_TYPE", "x11"}})) == DisplayServer::kX11, "vraie session X11");
  check(desktopSession(envOf({{"WAYLAND_DISPLAY", "wayland-1"}})) == DisplayServer::kWayland, "WAYLAND_DISPLAY sans XDG_SESSION_TYPE");
  check(desktopSession(envOf({{"WAYLAND_DISPLAY", "w"}, {"DISPLAY", ":0"}, {"XDG_SESSION_TYPE", "x11"}})) == DisplayServer::kX11,
        "XDG_SESSION_TYPE=x11 contredit un WAYLAND_DISPLAY résiduel");
  check(desktopSession(envOf({})) == DisplayServer::kUnknown, "aucun affichage : inconnue");

  check(decideSession(wayland, SessionChoice::kX11).montage == DisplayServer::kX11, "« x11 » impose XWayland");
  check(decideSession(envOf({{"DISPLAY", ":0"}}), SessionChoice::kWayland).montage == DisplayServer::kX11,
        "« wayland » n'est honoré que s'il y a un compositeur");
  check(decideSession(envOf({}), SessionChoice::kAuto).montage == DisplayServer::kX11, "sans affichage connu : X11");
  // Différence de CEF : la vidéo suit la fenêtre partout (sous-surface) — GNOME et sway
  // gardent Wayland en auto, sans le détour XWayland d'Electron.
  const auto gnome = envOf({{"WAYLAND_DISPLAY", "wayland-0"}, {"DISPLAY", ":0"}, {"XDG_CURRENT_DESKTOP", "GNOME"}});
  check(decideSession(gnome, SessionChoice::kAuto).montage == DisplayServer::kWayland, "GNOME en auto : Wayland sous CEF");
  check(decideSession(wayland, SessionChoice::kWayland).montage == DisplayServer::kWayland, "wayland explicite sous Wayland");

  check(parseSessionChoice("x11") == SessionChoice::kX11 && !parseSessionChoice("X11"), "choix analysé tel quel");
  check(sessionFileContent(SessionChoice::kWayland) == "{\n  \"session\": \"wayland\"\n}\n",
        "fichier identique à celui d'Electron");

  const auto dir = std::filesystem::temp_directory_path() / "tentacle-linux-rules";
  std::filesystem::create_directories(dir);
  std::filesystem::remove(dir / kSessionFile);
  check(readSessionChoice(dir, std::nullopt) == SessionChoice::kAuto, "fichier absent : auto (premier lancement)");
  std::ofstream(dir / kSessionFile) << sessionFileContent(SessionChoice::kX11);
  check(readSessionChoice(dir, std::nullopt) == SessionChoice::kX11, "fichier relu");
  check(readSessionChoice(dir, std::string("wayland")) == SessionChoice::kWayland, "TENTACLE_LINUX_SESSION l'emporte");
  check(readSessionChoice(dir, std::string("n'importe")) == SessionChoice::kX11, "valeur d'environnement inconnue ignorée");
  std::ofstream(dir / kSessionFile) << "{pas du json";
  check(readSessionChoice(dir, std::nullopt) == SessionChoice::kAuto, "fichier illisible : auto");
  std::filesystem::remove_all(dir);
}

void localeTests() {
  check(acceptLanguagesFrom(envOf({{"LANG", "fr_CH.UTF-8"}})) == "fr-CH,fr", "LANG régional");
  check(acceptLanguagesFrom(envOf({{"LANG", "fr_FR.UTF-8"}, {"LANGUAGE", "fr_FR:en_GB:en"}})) == "fr-FR,fr,en-GB,en",
        "LANGUAGE en liste, langues de base");
  check(acceptLanguagesFrom(envOf({{"LANG", "C"}, {"LANGUAGE", "fr"}})) == "", "LANGUAGE ignoré sous la locale C");
  check(acceptLanguagesFrom(envOf({{"LC_ALL", "de_DE@euro"}, {"LANG", "fr_FR"}})) == "de-DE,de", "LC_ALL l'emporte");
  check(acceptLanguagesFrom(envOf({})) == "", "rien : défaut de CEF");
}

}  // namespace

void edidTests();  // edid_linux_tests.cpp

int main() {
  sessionTests();
  localeTests();
  edidTests();
  if (linuxRuleFailures == 0) std::printf("règles Linux : tout passe\n");
  return linuxRuleFailures == 0 ? 0 : 1;
}
