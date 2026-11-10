#pragma once
// Une fausse couche native pour les tests de `regions.h` (`testkit.ts` d'Electron) : un arbre
// de vues en mémoire, et un journal des gestes. Elle LÈVE dès qu'on touche une poignée rendue :
// c'est la règle qui, en vrai, tuerait le processus.

#include <algorithm>
#include <cmath>
#include <deque>
#include <functional>
#include <map>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "glass/backend.h"

namespace glass_tests {

using namespace tentacle::glass;

/// `String(n)` de JavaScript pour les nombres des journaux (entiers sans « .0 »).
inline std::string num(double v) {
  if (std::floor(v) == v && std::abs(v) < 1e15) return std::to_string(static_cast<long long>(v));
  std::ostringstream out;
  out << v;
  return out.str();
}

struct FakeView {
  enum class Kind { Content, Root, Container, GroupContent, Glass } kind;
  std::string name;
  FakeView* parent = nullptr;
  std::vector<FakeView*> children;
  Rect frame;
  double radius = 0;
  int style = 0;
  std::optional<Rgba> tint;
  double alpha = 1;
  bool hidden = false;
  double spacing = 0;
  std::optional<Appearance> appearance;
  bool released = false;
};

inline const char* kindName(FakeView::Kind kind) {
  switch (kind) {
    case FakeView::Kind::Content: return "content";
    case FakeView::Kind::Root: return "root";
    case FakeView::Kind::Container: return "container";
    case FakeView::Kind::GroupContent: return "groupContent";
    case FakeView::Kind::Glass: return "glass";
  }
  return "?";
}

class FakeBackend final : public GlassBackend {
 public:
  // Dans le corps : `store_` doit exister avant la première vue.
  FakeBackend() { content = make(FakeView::Kind::Content, "contentView"); }

  FakeView* content = nullptr;
  std::vector<std::string> ops;
  std::vector<Rect> frames;  // chaque cadre posé par setFrame, dans l'ordre
  double height = 800;

  FakeView* root() const {
    for (FakeView* v : content->children)
      if (v->kind == FakeView::Kind::Root) return v;
    return nullptr;
  }
  /// Les verres d'un conteneur, de bas en haut.
  static std::vector<FakeView*> glasses(const FakeView* container) {
    if (container == nullptr || container->children.empty()) return {};
    return container->children[0]->children;
  }
  /// Les verres d'un groupe, de bas en haut, par le rayon qu'on leur a donné.
  static std::vector<double> stackOf(const FakeView* container) {
    std::vector<double> out;
    for (const FakeView* g : glasses(container)) out.push_back(g->radius);
    return out;
  }

  ViewHandle createRoot() override {
    ops.push_back("createRoot");
    FakeView* r = make(FakeView::Kind::Root, "root");
    r->parent = content;
    content->children.insert(content->children.begin(), r);
    return r;
  }
  double contentHeight() override { return height; }
  void setHidden(ViewHandle h, bool hidden) override {
    ops.push_back(std::string("setHidden ") + (hidden ? "true" : "false"));
    view(h)->hidden = hidden;
  }
  GroupHandle createGroup(ViewHandle rootHandle, double spacing, double alpha) override {
    ++counter_;
    ops.push_back("createGroup " + num(spacing) + " alpha " + num(alpha));
    FakeView* container = make(FakeView::Kind::Container, "container" + std::to_string(counter_));
    FakeView* inner = make(FakeView::Kind::GroupContent, "groupContent" + std::to_string(counter_));
    container->spacing = spacing;
    container->alpha = alpha;
    container->children.push_back(inner);
    inner->parent = container;
    FakeView* parent = view(rootHandle);
    container->parent = parent;
    parent->children.push_back(container);
    return {container, inner};
  }
  void setSpacing(const GroupHandle& group, double spacing) override {
    ops.push_back("setSpacing " + num(spacing));
    view(group.container)->spacing = spacing;
  }
  ViewHandle createGlass(const GlassProps& props) override {
    ++counter_;
    ops.push_back("createGlass");
    FakeView* g = make(FakeView::Kind::Glass, "glass" + std::to_string(counter_));
    g->frame = props.frame;
    g->radius = props.radius;
    g->style = props.style;
    g->tint = props.tint;
    g->appearance = props.appearance;
    return g;
  }
  void setFrame(ViewHandle h, const Rect& frame, const std::optional<NativeMotion>& motion) override {
    ops.push_back("setFrame " + (motion ? "ressort " + num(motion->durationMs) : std::string("direct")));
    frames.push_back(frame);
    view(h)->frame = frame;
  }
  void setRadius(ViewHandle h, double radius) override {
    ops.push_back("setRadius");
    view(h)->radius = radius;
  }
  void setStyle(ViewHandle h, int style) override {
    ops.push_back("setStyle");
    view(h)->style = style;
  }
  void setTint(ViewHandle h, const std::optional<Rgba>& tint) override {
    ops.push_back("setTint");
    view(h)->tint = tint;
  }
  void setAppearance(ViewHandle h, std::optional<Appearance> appearance) override {
    ops.push_back(std::string("setAppearance ") + (appearance ? appearanceName(*appearance) : "null"));
    view(h)->appearance = appearance;
  }
  void setAlpha(ViewHandle h, double alpha, double durationMs, const std::optional<Ease>& ease) override {
    FakeView* v = view(h);
    // Comme AppKit : sur un verre, l'alpha ne fait rien (mesuré) — le test le saurait.
    if (v->kind == FakeView::Kind::Glass) throw std::logic_error("alpha pose sur un verre : sans effet dans AppKit");
    std::string op = std::string("setAlpha ") + kindName(v->kind) + " " + num(alpha) + " " + num(durationMs);
    if (ease) op += " [" + num((*ease)[0]) + "," + num((*ease)[1]) + "," + num((*ease)[2]) + "," + num((*ease)[3]) + "]";
    ops.push_back(op);
    v->alpha = alpha;
  }
  void placeBelow(ViewHandle parentHandle, ViewHandle h, ViewHandle anchor) override {
    ops.push_back("placeBelow");
    FakeView* parent = view(parentHandle);
    FakeView* v = view(h);
    detach(v);
    auto& kids = parent->children;
    auto at = anchor == nullptr ? kids.end() : std::find(kids.begin(), kids.end(), view(anchor));
    if (anchor != nullptr && at == kids.end()) throw std::logic_error("ancre hors du parent");
    kids.insert(at, v);
    v->parent = parent;
  }
  void dispose(ViewHandle h) override {
    FakeView* v = view(h);
    ops.push_back(std::string("dispose ") + kindName(v->kind));
    detach(v);
    v->released = true;
  }
  void release(ViewHandle h) override {
    FakeView* v = view(h);
    ops.push_back(std::string("release ") + kindName(v->kind));
    v->released = true;
  }
  GlassInspection inspect(ViewHandle h) override {
    FakeView* v = view(h);
    // Comme `isHiddenOrHasHiddenAncestor` : une racine cachée cache tout ce qu'elle porte.
    bool hidden = false;
    for (FakeView* p = v; p != nullptr; p = p->parent) hidden = hidden || p->hidden;
    return {v->frame, v->radius, v->style, v->alpha, hidden, std::nullopt};
  }
  int countGlass(ViewHandle rootHandle) override {
    std::function<int(FakeView*)> walk = [&](FakeView* v) {
      if (v->kind == FakeView::Kind::Glass) return 1;
      int total = 0;
      for (FakeView* c : v->children) total += walk(c);
      return total;
    };
    return walk(view(rootHandle));
  }

 private:
  FakeView* make(FakeView::Kind kind, std::string name) {
    store_.push_back(std::make_unique<FakeView>(FakeView{kind, std::move(name)}));
    return store_.back().get();
  }
  FakeView* view(ViewHandle h) {
    auto* v = static_cast<FakeView*>(h);
    if (v->released) throw std::logic_error("poignee rendue touchee : " + v->name);
    return v;
  }
  static void detach(FakeView* v) {
    if (v->parent == nullptr) return;
    auto& kids = v->parent->children;
    kids.erase(std::remove(kids.begin(), kids.end(), v), kids.end());
    v->parent = nullptr;
  }
  std::vector<std::unique_ptr<FakeView>> store_;
  int counter_ = 0;
};

/// Des minuteurs qu'on déclenche à la main.
class ManualTimers final : public Timers {
 public:
  TimerId set(std::function<void()> callback, double) override {
    pending_[++next_] = std::move(callback);
    return next_;
  }
  void clear(TimerId timer) override { pending_.erase(timer); }
  void runAll() {
    auto callbacks = std::move(pending_);
    pending_.clear();
    for (auto& [id, cb] : callbacks) cb();
  }
  size_t size() const { return pending_.size(); }

 private:
  std::map<TimerId, std::function<void()>> pending_;
  TimerId next_ = 0;
};

}  // namespace glass_tests
