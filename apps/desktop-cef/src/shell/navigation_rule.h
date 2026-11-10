#pragma once
// Politique de navigation et d'ouverture externe — règle PURE, sans CEF, la même que le bureau
// Electron (`apps/desktop-electron/src/main/security.ts`) :
//   - le cadre principal ne quitte jamais l'origine de l'application ; une navigation vers
//     ailleurs (lien, `location =`) part dans le navigateur du système (`will-navigate`) ;
//   - une REDIRECTION du cadre principal vers ailleurs est bloquée sans rien ouvrir
//     (`will-redirect` : personne ne l'a demandée) ; les cadres (bande-annonce, greffons)
//     gardent les leurs ;
//   - toute fenêtre que la page ouvre (`window.open`, `target=_blank`, clic du milieu) part
//     dehors, sauf le PiP (`setWindowOpenHandler`, crochet de l'axe pip) ;
//   - « dehors » = liste FERMÉE de schémas (`EXTERNAL_SCHEMES`) : `shell.openExternal` peut
//     exécuter n'importe quoi si on lui passe n'importe quoi.

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace tentacle::nav {

/// Schéma en minuscules, sans « : » (« https »), ou "" si l'URL n'en a pas de valide
/// (`[A-Za-z][A-Za-z0-9+.-]*:`, espaces et contrôles de tête/queue retirés comme `new URL`).
std::string schemeOf(std::string_view url);

/// Origine « schéma://hôte[:port] » en minuscules (identifiants retirés), ou "" sans autorité
/// (« mailto: », « about:blank », « data: »).
std::string originOf(std::string_view url);

/// La liste fermée d'Electron : http, https, mailto, ms-windows-store, macappstore, itms-apps.
bool externalSchemeAllowed(std::string_view url);

/// L'origine de l'application : celle de l'URL de départ (`tentacle://app` ; en mode banc
/// `dev:server`, celle du serveur). Posée une fois, avant le premier navigateur.
void setAppOrigin(std::string_view startUrl);
const std::string& appOrigin();

/// `isAppOrigin` d'Electron : même schéma et même hôte (port compris) que l'application.
bool isAppUrl(std::string_view url);

enum class Verdict {
  allow,             // la navigation suit son cours
  deny,              // annulée, rien d'ouvert
  denyOpenExternal,  // annulée, l'URL part dans le navigateur du système (si son schéma est permis)
};

/// Cadre principal (Electron : `will-navigate`, `will-redirect`).
Verdict mainFrameNavigation(std::string_view url, bool isRedirect);

/// Fenêtre ouverte par la page, quand le PiP ne la prend pas (`setWindowOpenHandler`).
Verdict windowOpen(std::string_view url);

/// `navigateOnDragDrop` d'Electron vaut faux : un dépôt ne fait JAMAIS naviguer la page. CEF,
/// lui, navigue quand la page ne prend pas le dépôt (fichier → file://, lien ou image → son
/// URL). Les URL d'un dépôt sont retenues `kDropWindowMs` ; une navigation du cadre principal
/// vers l'une d'elles (ou vers file:// si le dépôt portait des fichiers) est annulée, sans rien
/// ouvrir. Horloge en millisecondes, fournie par l'appelant.
inline constexpr uint64_t kDropWindowMs = 2000;
void noteDrop(std::vector<std::string> urls, bool hasFiles, uint64_t nowMs);
bool isDropNavigation(std::string_view url, uint64_t nowMs);

}  // namespace tentacle::nav
