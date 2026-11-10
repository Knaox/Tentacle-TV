#pragma once
// Le cycle de vie dans la boucle de l'app (src/app/app.cpp) — fil principal :
//
//   platform::initApplication();
//   lifecycle::app::beforeSdl(argc, argv, opts);        // argv, relance, Apple events, indices SDL
//   … SDL_Init, fenêtre …
//   lifecycle::app::prepareWindow(window);              // cadre d'Electron, avant l'affichage
//   if (!CefInitialize(…)) return lifecycle::app::handedToRunningInstance() ? 0 : 1;
//   … modules, Shell …
//   lifecycle::app::attach(shell.get(), window);
//   while (lifecycle::app::running()) {
//     attendre (lifecycle::app::waitTimeoutMs(), -1 = sans limite) ;
//     pour chaque évènement : pompe CEF, puis `if (lifecycle::app::handleEvent(e)) continue;`,
//     puis `if (lifecycle::app::windowAlive()) shell->handleEvent(e)` ;
//     lifecycle::app::afterEvents();
//   }
//   … shutdownModules, CefShutdown …
//   lifecycle::app::afterShutdown();

#include <SDL3/SDL.h>

namespace tentacle {
struct AppOptions;
class Shell;
}  // namespace tentacle

namespace tentacle::lifecycle::app {

/// Avant SDL_Init, après `platform::initApplication()` : garde la ligne de commande (relance,
/// lien du lancement), attend la sortie de l'instance qu'on remplace (`--relaunch-after`), écoute
/// les liens et la réouverture du système (macOS), et dit à SDL que fermer la dernière fenêtre
/// n'est PAS quitter (la fermeture passe par la garde).
void beforeSdl(int argc, char** argv, const AppOptions& opts);
/// La fenêtre est créée (cachée) : le cadre d'Electron, la taille minimale, l'icône.
void prepareWindow(SDL_Window* window);
/// CefInitialize a rendu faux : vrai si c'est parce qu'une instance tourne déjà et a reçu
/// notre ligne de commande (on sort alors sans bruit, code 0).
bool handedToRunningInstance();
/// Le navigateur va être créé : la page, la fenêtre et le déroulé de sortie se branchent.
void attach(Shell* shell, SDL_Window* window);
/// Fermer, quitter, réveil : consommés ici (vrai). Le reste suit son chemin.
bool handleEvent(const SDL_Event& e);
/// La fenêtre et sa page existent encore (sinon, plus de saisie à leur envoyer).
bool windowAlive();
/// Après chaque lot d'évènements : constate la page fermée.
void afterEvents();
/// Délai d'attente de la boucle : court pendant que la page se ferme, sinon -1.
int waitTimeoutMs();
/// Faux quand il est temps de nettoyer et de sortir.
bool running();
/// Une nouvelle instance, puis la sortie sans question (`window.tentacle.relaunch()` ; le
/// secours d'affichage, shell/page_rescue.h).
void requestRelaunch();
/// Après CefShutdown : rend ce qui est tenu pour tout le système (anti-veille, anti-suspension).
void afterShutdown();

}  // namespace tentacle::lifecycle::app
