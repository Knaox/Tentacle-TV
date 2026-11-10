#pragma once
// La SCÈNE du verre d'une fenêtre — `stage.ts` d'Electron, à l'identique : la racine posée
// entre la vidéo et la page, et les `NSGlassEffectContainerView` qu'elle porte.
//
// Un conteneur par GROUPE (ses verres FUSIONNENT quand ils s'approchent à moins de `spacing`
// points — le « liquide »), et un conteneur SOLO par région sans groupe : un verre ignore son
// propre alpha, seul celui de son conteneur l'estompe — chaque région seule peut donc entrer
// et sortir en fondu.
//
// Un conteneur qui sort en fondu QUITTE la table aussitôt (`retire`) : une région du même
// groupe arrivée pendant le fondu en ouvre un neuf. Racine et conteneurs n'existent que tant
// qu'un verre vit dessous (`prune`).

#include <functional>
#include <list>
#include <map>
#include <optional>
#include <string>
#include <vector>

#include "glass/backend.h"

namespace tentacle::glass {

/// Marge laissée à l'animation d'AppKit avant de retirer ce qui s'est estompé.
inline constexpr double kLeaveMarginMs = 40;

class GlassStage {
 public:
  GlassStage(GlassBackend& backend, Timers& timers) : backend_(backend), timers_(timers) {}

  bool has(const std::string& key) const { return groups_.count(key) > 0; }
  /// La vue de contenu du groupe, créée au besoin à l'alpha `alpha` — nullptr si la fenêtre
  /// refuse la racine.
  ViewHandle content(const std::string& key, double spacing, double alpha = 1);
  /// Fondu d'entrée d'un conteneur né transparent ; `ease` : la Bézier d'une matérialisation.
  void reveal(const std::string& key, double durationMs, const std::optional<Ease>& ease = std::nullopt);
  /// Fondu de sortie d'un conteneur ENTIER, puis retrait de ses verres et de lui. Les poignées
  /// `views` sont rendues au bout du fondu — jamais avant.
  void retire(const std::string& key, double durationMs, std::vector<ViewHandle> views,
              const std::optional<Ease>& ease = std::nullopt);
  /// Pose le conteneur d'un groupe parmi les autres : sous le premier plus profond (`topZ`).
  void restack(const std::string& key, const std::function<double(const std::string&)>& topZ);
  /// La distance de fusion d'un groupe — écrite seulement si elle change.
  void setSpacing(const std::string& key, double spacing);
  /// Surface de la page opaque : tout le verre est masqué ; caché, il ne coûte plus rien.
  void setSurfaceVisible(bool visible);
  bool isSurfaceVisible() const { return surfaceVisible_; }
  /// Démolit les groupes que `used` ne réclame plus, puis la racine si plus rien ne vit dessous.
  void prune(const std::function<bool(const std::string&)>& used);
  /// Solde tout de suite les fondus de sortie en cours (réglage coupé, page partie).
  void settleRetiring();
  /// La fenêtre est détruite : rendre les références, sans un message à ses vues.
  void forget();
  /// Les verres qui s'estompent avec leur conteneur — pour l'instantané du banc.
  std::vector<ViewHandle> retiringViews() const;
  bool hasRoot() const { return root_ != nullptr; }
  int groupCount() const { return static_cast<int>(groups_.size()); }
  /// Les `NSGlassEffectView` réellement présentes, comptées dans AppKit.
  int nativeViews();

 private:
  struct GroupEntry {
    GroupHandle handle;
    long seq = 0;
    double spacing = 0;
  };
  struct Retiring {
    GroupHandle handle;
    std::vector<ViewHandle> views;
    TimerId timer = 0;
  };

  void finish(const Retiring& entry);
  ViewHandle ensureRoot();

  GlassBackend& backend_;
  Timers& timers_;
  ViewHandle root_ = nullptr;
  // L'ordre d'insertion compte (`[...this.groups]` d'Electron) : on le garde à part.
  std::map<std::string, GroupEntry> groups_;
  std::vector<std::string> order_;
  std::list<Retiring> retiring_;
  bool surfaceVisible_ = true;
  long seq_ = 0;
};

}  // namespace tentacle::glass
