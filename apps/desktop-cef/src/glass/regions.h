#pragma once
// Les régions de verre d'UNE fenêtre : ce que la page a demandé, et les vues natives qui le
// rendent — `regions.ts` d'Electron, à l'identique.
//
// Le gestionnaire ne parle jamais à AppKit directement (`backend.h`) : il décide, la couche
// native exécute. Ses règles :
//  1. Rien de posé qui ne sert. Sans région, ni racine, ni conteneur. Réglage coupé : tout est
//     retiré, seules les DESCRIPTIONS restent.
//  2. N'écrire que ce qui change.  3. Une poignée rendue n'est plus jamais touchée.
//  4. Les mouvements de la page, rejoués par AppKit (`transition` non nul) : déplacement au
//     ressort de la page (`spring_curve.h`) ; une région seule, ou un groupe entier, entre et
//     sort par le fondu de son conteneur ; un membre qui quitte un groupe qui reste fond vers
//     son centre, un membre qui rejoint un groupe visible en naît.
//
// Fil : le fil principal seulement.

#include <functional>
#include <map>
#include <memory>
#include <set>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "glass/backend.h"
#include "glass/materialize.h"
#include "glass/stage.h"

namespace tentacle::glass {

class GlassRegions {
 public:
  GlassRegions(GlassBackend& backend, Timers& timers, std::function<void(const std::string&)> log);

  /// Un lot : le réglage, les départs, les poses, les fondus d'entrée — et le ménage une fois.
  void apply(const Batch& batch, double zoom);
  void setEnabled(bool next);
  /// La surface de la page est-elle transparente (lecture) ? Voir `GlassStage::setSurfaceVisible`.
  void setSurfaceVisible(bool visible) { stage_.setSurfaceVisible(visible); }
  /// La page est partie (rechargement, processus perdu) : plus rien de ce qu'elle avait demandé.
  void clear();
  /// La fenêtre est détruite : rendre les références sans toucher à AppKit.
  void forget();
  /// `{enabled, surfaceVisible, root, groups, nativeViews, regions, leaving}` (`snapshot.ts`).
  nlohmann::json snapshot();

 private:
  struct Entry {
    Region region;
    Rect rect;  // en points, origine en haut à gauche
    double radius = 0;
    std::string groupKey;
    double zoom = 1;  // de la page, à la dernière pose : le décalage d'une matérialisation est en px CSS
    long seq = 0;
    ViewHandle view = nullptr;
  };
  using EntryPtr = std::shared_ptr<Entry>;
  /// Les fondus d'entrée d'un lot, par conteneur, dans l'ordre d'arrivée (la `Map` d'Electron).
  using Reveal = std::vector<std::pair<std::string, double>>;
  struct Shrinking {
    TimerId timer = 0;
    std::string groupKey;
  };

  void depart(const std::vector<std::string>& ids, const std::set<std::string>& arriving);
  void shrink(const Entry& entry, ViewHandle view);
  void upsert(const Region& region, double zoom, double height, Reveal& reveal);
  /// `reveal` nul : remontage d'un réglage rallumé, sans mouvement.
  void mount(const EntryPtr& entry, double height, Reveal* reveal);
  void restack(const Entry& entry);
  bool hasLiveView(const std::string& key) const;
  double topZ(const std::string& key) const;
  double spacingOf(const std::string& key) const;
  void prune();
  void demolish();
  void overflow();
  EntryPtr find(const std::string& id) const;
  void erase(const std::string& id);

  GlassBackend& backend_;
  Timers& timers_;
  std::function<void(const std::string&)> log_;
  bool enabled_ = true;
  GlassStage stage_;
  DelayedEntries entries_;
  // Les régions, dans l'ordre d'arrivée (celui de la `Map` d'Electron).
  std::vector<EntryPtr> regions_;
  /// Verres qui fondent vers leur centre en quittant un groupe qui reste.
  std::map<ViewHandle, Shrinking> shrinking_;
  long seq_ = 0;
  bool overflowTold_ = false;
};

}  // namespace tentacle::glass
