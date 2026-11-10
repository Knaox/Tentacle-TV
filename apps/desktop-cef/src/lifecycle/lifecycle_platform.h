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
#include "lifecycle/texts.h"

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
/// Reprend ces gestionnaires une fois SDL et CEF initialisés (chacun pose le sien pour GetURL).
void reclaimSystemEvents();

/// La fenêtre principale d'Electron (`window.ts`, `macosTitleBar.ts`) : macOS, barre de titre
/// masquée, contenu sous la bande, feux placés, sans ombre ; ailleurs, l'icône. Avant l'affichage.
void prepareMainWindow(SDL_Window* window);
/// La bande d'hôte que la page dessine (38 points sur macOS, 0 ailleurs).
double titleBarHeight();
/// Panneau « À propos » (`setAboutPanelOptions`) : nom, version, icône. macOS seulement.
void setAboutPanel(const std::string& name, const std::string& version);
/// La page reçoit-elle le focus de la fenêtre (`window.tentacle.windowFocus`) ? macOS seulement,
/// comme Electron : la page y ternit la fenêtre inactive à la façon du système.
bool hasWindowFocusBridge();
/// Ramène la fenêtre au premier plan (seconde instance, lien reçu) : restaurée si réduite.
/// Sous `--background` (bancs, sessions), jamais d'activation : `setNoActivation(true)`.
void focusWindow(SDL_Window* window);
void setNoActivation(bool on);
/// Diagnostic des bancs (`lifecycle.debug.window`) : cadre, feux, ombre — JSON ; "{}" hors macOS.
std::string windowDebug(SDL_Window* window);
/// Diagnostic des bancs : la feuille native attachée à la fenêtre (boîte, sélecteur) — textes,
/// boutons et touches ; `end` ≥ 0 la ferme avec ce code (NSAlertFirstButtonReturn = 1000…).
std::string sheetDebug(SDL_Window* window, int end);

}  // namespace tentacle::lifecycle::platform
