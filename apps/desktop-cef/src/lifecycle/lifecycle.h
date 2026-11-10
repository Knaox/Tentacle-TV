#pragma once
// Cycle de vie de l'application (axe systeme) — ce que les AUTRES modules en appellent.
//
// Le bureau Electron tient, autour de sa fenêtre et de son processus, des règles que la page
// ne voit pas et que Tentacle CEF reprend à l'identique :
//   - fermer la fenêtre pendant un transfert le laisse finir, processus vivant et navigateur
//     détruit (`backgroundTransfers.ts`, `backgroundDrain.ts`) ; quitter demande « quitter
//     quand même ? » (`quitGuard.ts`) ; la seule notification de l'app le dit ;
//   - l'anti-suspension du système pendant les transferts (`powerSave.ts`, `downloadsRuntime.ts`) ;
//   - l'adieu à Jellyfin : à la sortie, l'arrêt des lectures encore ouvertes est posté
//     (`playbackFarewell.ts`, `quitFarewell.ts`).
//
// Tout se fait sur le FIL PRINCIPAL (= fil UI de CEF), sauf mention contraire. Chaque fonction
// peut être appelée avant que l'app ne soit lancée (depuis l'init d'un module) : ce qui est
// déclaré est gardé.

#include <functional>
#include <string>

namespace tentacle::lifecycle {

// ---- Transferts (axe horsligne) -----------------------------------------------------------

/// Ce que la fermeture demande au moteur de transferts (`downloadsRuntime.ts`).
struct TransfersProbe {
  /// Transferts pas finis, en cours ou en file (`transfersInFlight`). Ne CONSTRUIT PAS le moteur
  /// (pas de moteur, pas de transfert : 0) et n'ouvre pas la base pour répondre. Une exception
  /// vaut 0 — on ne retient pas une fermeture sur un doute.
  std::function<int()> inFlight;
  /// Un transfert tourne, ou le serveur prépare ce qu'on attend (`transfersBusy` = `onBusy` ||
  /// `awaitingServer`). Sert à la fin des transferts fenêtre fermée (10 min sans mouvement : on quitte).
  std::function<bool()> busy;
  /// Le réglage « Continuer en arrière-plan » de CET appareil (clé `background_transfers` de la
  /// base locale, la même que le mobile ; tout sauf "0" = allumé), lu au moment de la fermeture.
  /// Une exception vaut vrai (le défaut). Les commandes `downloads_background_get/set` restent à
  /// l'axe horsligne.
  std::function<bool()> backgroundEnabled;
};
void setTransfersProbe(TransfersProbe probe);

/// Anti-suspension du SYSTÈME (« prevent-app-suspension ») tant que `on` est vrai — appelée par
/// le moteur à chaque `onBusy` / `onHeld` (`syncWakeLock`). L'écran reste libre de s'éteindre.
/// Idempotente ; rendue d'office à la sortie (macOS : IOPMAssertion ; Linux : renfort logind par
/// `systemd-inhibit` ; Windows : PowerSetRequest).
void keepSystemAwake(bool on);

/// Anti-veille de l'ÉCRAN (« prevent-display-sleep ») pendant la lecture — derrière
/// `prevent_display_sleep_start/stop` (pont). Idempotente ; rendue d'office à la sortie.
void preventDisplaySleep(bool on);

/// Retour de veille du système (`powerMonitor.on("resume")`) : le moteur reprend ses pauses
/// SYSTÈME. Plusieurs abonnés ; rappelés sur le fil principal.
void onSystemResume(std::function<void()> callback);

/// La fenêtre est partie pour de bon (navigateur détruit) — que l'app quitte ou finisse ses
/// transferts sans elle. Electron y arrête la musique (`window.on("closed", stopAudio)`) ;
/// plus aucune page ne la commanderait. Plusieurs abonnés ; fil principal.
void onWindowClosed(std::function<void()> callback);

// ---- Adieu à Jellyfin (axe reseau : le relais `jellyfin_session_post`) ----------------------

/// Un report de lecture tel que la page le confie au relais (`SessionPost` d'Electron).
struct SessionPost {
  std::string baseUrl;
  std::string path;  // /Sessions/Playing, /Sessions/Playing/Progress, /Sessions/Playing/Stopped
  std::string token;
  std::string authHeader;
  std::string body;  // corps JSON sérialisé, tel que Jellyfin le recevra
};

/// L'arrêt à poster à la sortie pour une lecture restée ouverte (`FarewellStop` d'Electron).
struct FarewellStop {
  std::string baseUrl;
  std::string token;
  std::string authHeader;
  std::string body;  // corps JSON sérialisé de /Sessions/Playing/Stopped
};

/// Chaque report relayé passe ici AVANT son envoi (`playbackFarewell.note`).
void noteSessionPost(const SessionPost& post);

/// Un envoi du relais commence (`playbackFarewell.track`) : rend la fonction à appeler UNE fois
/// quand il finit, succès ou échec, depuis N'IMPORTE QUEL fil. La sortie l'attend (1,5 s au plus).
std::function<void()> trackSessionPost();

/// Comment poster un arrêt à la sortie (`postFarewellStop`) : POST `<baseUrl>/Sessions/Playing/Stopped`
/// avec les en-têtes du relais (`jellyfinRequestHeaders`). `done` une fois, depuis n'importe quel
/// fil. Sans émetteur déclaré, la sortie n'attend que les envois en vol.
using FarewellSender = std::function<void(const FarewellStop& stop, std::function<void()> done)>;
void setFarewellSender(FarewellSender sender);

}  // namespace tentacle::lifecycle
