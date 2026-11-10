#pragma once
// Session graphique Linux : Wayland ou X11 — le choix de l'utilisateur (Auto / Wayland / X11),
// le même fichier qu'Electron (`session-graphique.json` du dossier de données, champ
// "session"), la même variable d'essai (TENTACLE_LINUX_SESSION).
//
// Ce qui change par rapport à Electron (apps/desktop-electron/src/main/linux/graphicsSession.ts) :
// sous CEF, la vidéo est une SOUS-SURFACE de notre fenêtre (Wayland) ou dessinée dans notre
// propre surface (X11) — elle suit toujours la fenêtre, sans colle KWin. Le fenêtré est donc
// « libre » sous tous les compositeurs Wayland, et `auto` n'a plus de raison de se rabattre sur
// XWayland (le détour d'Electron pour GNOME et wlroots) : il prend la session du bureau.
//
// Décision pure (decide*, parse*) testée par ctest ; l'état du processus est figé au démarrage
// (startupSession), avant SDL et CEF — la plateforme ne se change qu'en relançant.

#include <filesystem>
#include <functional>
#include <optional>
#include <string>
#include <string_view>

namespace tentacle::platform {

enum class SessionChoice { kAuto, kWayland, kX11 };
enum class DisplayServer { kWayland, kX11, kUnknown };

struct DecidedSession {
  SessionChoice choice = SessionChoice::kAuto;
  DisplayServer desktop = DisplayServer::kUnknown;  // ce que le bureau annonce
  DisplayServer montage = DisplayServer::kX11;      // ce que l'app prend (SDL et Ozone)
};

using EnvLookup = std::function<std::optional<std::string>(const char* name)>;

// Nom du fichier, dans le dossier de données (le même qu'Electron).
inline constexpr char kSessionFile[] = "session-graphique.json";

std::optional<SessionChoice> parseSessionChoice(std::string_view text);
const char* sessionChoiceName(SessionChoice c);         // "auto" | "wayland" | "x11"
const char* displayServerName(DisplayServer d);         // "wayland" | "x11" | "inconnue"

// Ce que le bureau annonce : WAYLAND_DISPLAY tranche (DISPLAY est aussi posé sous Wayland,
// c'est XWayland) ; XDG_SESSION_TYPE=x11 le contredit. Règle d'Electron.
DisplayServer desktopSession(const EnvLookup& env);
// Le choix et ce qu'il implique. `wayland` demandé hors session Wayland → X11 (un réglage
// transporté d'une machine à l'autre ne bloque personne, comme Electron).
DecidedSession decideSession(const EnvLookup& env, SessionChoice choice);
// Le choix enregistré (`forced` = TENTACLE_LINUX_SESSION l'emporte s'il est valide).
SessionChoice readSessionChoice(const std::filesystem::path& dataFolder,
                                const std::optional<std::string>& forced);
// Le contenu écrit par linux_session_set (octet pour octet celui d'Electron).
std::string sessionFileContent(SessionChoice c);

// --- état du processus ------------------------------------------------------------------
// Décidée UNE fois (premier appel), d'après l'environnement et le dossier de données.
const DecidedSession& startupSession();
// window.tentacle.montage / .fenetrage (comme le preload d'Electron), "" si sans objet.
const char* linuxMontage();
const char* linuxWindowing();

}  // namespace tentacle::platform
