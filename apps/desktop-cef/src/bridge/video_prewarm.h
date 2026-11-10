// Le préchauffage du lecteur (`mpv_prewarm`), repris de la coquille Electron
// (`main/ipc/videoPrewarm.ts`) — Linux, vidéo en sous-surface Wayland.
//
// Mesuré sous CEF le 10/11/2026 (bench/lecteur/depart.mjs, RTX, fichier local) : de `mpv_init` à
// la première image, 0,8 à 1,0 s à CHAQUE titre — la sortie vidéo de mpv (périphérique Vulkan,
// chaîne d'échange) naît au premier `loadfile`. Une instance MINCE la paie d'avance : née sans
// fichier, sa sortie montée (`force-window`), elle attend sous la page qu'un `mpv_init` aux
// MÊMES options la reprenne. Trois naissances, comme Electron : la demande de la page (une fois
// connectée, au repos), le recyclage après chaque lecture, le réveil de la machine. Jamais sur
// batterie (elle tiendrait éveillé le GPU dédié d'un portable hybride), jamais à travers une
// veille (un périphérique Vulkan peut en revenir perdu). Différence voulue avec Electron : pas
// de parking de l'instance CHAUDE d'après lecture (jusqu'à 2 Go de VRAM retenus) — elle
// s'arrête, une mince la remplace.
//
// ⚠️ Faire naître la sortie vidéo RETIENT NOTRE FIL GL : sur NVIDIA, pendant que mpv crée son
// périphérique Vulkan, chaque appel GL du compositeur attend (mesuré : la copie de l'image de la
// page bloquée 540 à 640 ms, l'app figée d'autant — à chaque « Lire » sans préchauffage). D'où
// la seconde différence : une instance ne naît qu'au REPOS (`WhenIdle` : ni image peinte ni
// saisie depuis `kPrewarmQuietMs`), quand rien ne bouge à l'écran et que personne ne clique.
// Pas de repos avant la lecture suivante : elle part à froid, comme avant.
//
// Ici, la règle seule (qui, quand) : la naissance et la reprise sont au lecteur (`PlayerPort`).
#pragma once

#include <functional>
#include <memory>
#include <optional>
#include <string>

#include "ports.h"
#include "registry.h"

namespace bridge {

/// Le repos exigé avant de faire naître l'instance : ni image peinte ni saisie depuis ce délai.
constexpr int kPrewarmQuietMs = 3000;
/// Après le réveil : le temps que le pilote et le compositeur se remettent (Electron).
constexpr int kPrewarmResumeMs = 5000;

/// La machine est-elle sur batterie ? Lu dans `/sys/class/power_supply` (Linux ; ailleurs le
/// dossier n'existe pas : faux) : une batterie de la MACHINE (pas celle d'une souris, `scope`
/// « Device ») qui se décharge. `root` : injecté par les tests.
bool onBattery(const std::string& root = "/sys/class/power_supply");

class VideoPrewarm {
 public:
  using Defer = std::function<void(int ms, std::function<void()> task)>;
  /// Exécute `task` quand la page est au repos depuis `quietMs` (tout de suite si elle l'est).
  using WhenIdle = std::function<void(int quietMs, std::function<void()> task)>;
  using OnBattery = std::function<bool()>;

  /// La commande `mpv_prewarm` n'est déclarée que si le lecteur sait préchauffer : ailleurs,
  /// la page ne la voit pas dans `capabilities` et ne demande rien.
  VideoPrewarm(Registry& registry, PlayerPort& player, Defer defer, WhenIdle whenIdle, OnBattery onBattery);
  ~VideoPrewarm();

  /// Une lecture vient de s'arrêter (`mpv_destroy`) : une instance mince la remplace bientôt.
  void afterPlayback();
  /// La machine sort de veille : l'instance garée part, une neuve naît plus tard.
  void onSystemResume();
  /// Ce qui s'est passé au dernier essai, pour le journal et les bancs.
  const std::string& lastOutcome() const { return lastOutcome_; }

 private:
  /// Fait naître une instance mince si tout le permet ; rend ce qui s'est passé.
  std::string prewarm(const std::string& why);
  /// Au prochain repos de la page (une seule attente à la fois).
  void atRest(const std::string& why);

  PlayerPort& player_;
  Defer defer_;
  WhenIdle whenIdle_;
  bool waiting_ = false;
  OnBattery onBattery_;
  std::optional<Json> lastRequest_;  // les options (déjà filtrées) de la dernière demande de la page
  std::string lastOutcome_;
  std::shared_ptr<bool> alive_ = std::make_shared<bool>(true);
};

}  // namespace bridge
