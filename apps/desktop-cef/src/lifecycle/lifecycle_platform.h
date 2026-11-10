#pragma once
// Ce que le cycle de vie attend de l'OS (implémenté dans src/platform/<os>/lifecycle_*).
// Ce que SDL3 fait déjà pour les trois (ouvrir une URL, sélecteur de dossier, focus de la
// fenêtre, boîte de message) reste dans le code portable de src/lifecycle/.

#include <SDL3/SDL.h>

#include <functional>
#include <optional>
#include <string>
#include <vector>

#include "lifecycle/power_save.h"

namespace tentacle::lifecycle::platform {

/// Le `powerSaveBlocker` du système : macOS IOPMAssertion, Windows PowerSetRequest, Linux SDL
/// (écran : inhibition du compositeur / économiseur) — l'anti-suspension y passe par logind.
SleepBlocker& sleepBlocker();
/// Linux : le lanceur du renfort logind (`systemd-inhibit`) ; vide ailleurs.
Launcher logindLauncher();

/// La langue du système commence par « fr » (textes natifs : dialogue, notification), comme
/// `app.getLocale()` d'Electron.
bool systemLocaleIsFrench();

/// Une notification du système, silencieuse (la SEULE de l'app : transferts en arrière-plan).
void notify(const std::string& title, const std::string& body);

/// Les textes de la boîte « quitter quand même ? » (`quitGuard.ts`).
struct QuitTexts {
  std::string title, message, detail, quitApp, cancelLabel;
};
/// La boîte native, « Annuler » par défaut (Entrée et Échap). `answer(true)` = quitter ;
/// rappelée UNE fois, plus tard ; une boîte qui ne peut pas s'afficher vaut `answer(true)`.
void askQuit(SDL_Window* window, const QuitTexts& texts, std::function<void(bool quit)> answer);

/// Sélecteur de dossier (`dialog.showOpenDialog`, openDirectory + createDirectory) ;
/// `done(nullopt)` si annulé. Rappelée une fois, sur le fil principal.
void pickFolder(SDL_Window* window, std::function<void(std::optional<std::string>)> done);

/// Retour de veille du système (`powerMonitor` « resume ») : `onResume` sur le fil principal.
void watchSystemResume(std::function<void()> onResume);

/// Lance une nouvelle instance de l'app (`app.relaunch`), qui attend la fin de CE processus
/// avant de démarrer (`--relaunch-after=<pid>`, sinon le verrou d'instance unique l'arrêterait).
bool spawnSuccessor(const std::vector<std::string>& argv);
/// Au démarrage de l'instance relancée : attend que `pid` soit sorti (borné).
void waitForProcessExit(long pid, int timeoutMs);
long currentPid();

/// macOS : liens `tentacle://` (Apple event GetURL) et réouverture (clic dans le Dock) remis par
/// le système. À poser AVANT SDL_Init (le lien du lancement arrive juste après). Ailleurs : rien
/// (Windows et Linux passent par la ligne de commande, et la seconde instance par CEF).
void installSystemEvents(std::function<void(const std::string& url)> openUrl,
                         std::function<void()> reopen);

/// La fenêtre principale d'Electron (`window.ts`, `macosTitleBar.ts`) : macOS, barre de titre
/// masquée, contenu sous la bande, feux placés, sans ombre ; ailleurs, l'icône. Avant l'affichage.
void prepareMainWindow(SDL_Window* window);
/// La bande d'hôte que la page dessine (38 points sur macOS, 0 ailleurs).
double titleBarHeight();
/// Panneau « À propos » (`setAboutPanelOptions`) : nom, version, icône. macOS seulement.
void setAboutPanel(const std::string& name, const std::string& version);
/// Ramène la fenêtre au premier plan (seconde instance, lien reçu) : restaurée si réduite.
void focusWindow(SDL_Window* window);

}  // namespace tentacle::lifecycle::platform
