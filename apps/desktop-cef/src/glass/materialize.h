#pragma once
// La MATÉRIALISATION d'un verre (lot lg8) — `materialize.ts` d'Electron, à l'identique : à
// l'entrée, il part d'un cadre un peu plus bas et un peu plus petit et s'y pose pendant que
// son conteneur s'allume ; à la sortie, il y retourne pendant que son conteneur s'éteint.
//
// La page joue EXACTEMENT le même geste sur ce qu'elle dessine dans la forme : même décalage,
// même échelle, même origine, même durée, même Bézier — elle les envoie, le natif ne décide
// rien. Le fondu passe par le CONTENEUR : un verre ignore son propre alpha.

#include <map>
#include <string>

#include "glass/backend.h"

namespace tentacle::glass {

/// Le cadre de départ (et d'arrivée à la sortie) d'un verre posé en `frame` (points AppKit,
/// origine en BAS) : réduit de `scale` autour de l'origine, puis décalé de `rise` px CSS vers
/// le bas de l'écran.
Rect materializeFrom(const Rect& frame, const Materialize& m, double zoom);

/// L'entrée : durée de la région, Bézier de la page.
NativeMotion enterMotion(const Materialize& m, double durationMs);
/// La sortie : sa propre durée (plus courte), sa propre Bézier.
NativeMotion exitMotion(const Materialize& m);

/// Les entrées DÉCALÉES (l'ordre des formes) : un minuteur par région, annulé si elle part
/// avant d'avoir paru — jamais un geste sur une vue rendue.
class DelayedEntries {
 public:
  explicit DelayedEntries(Timers& timers) : timers_(timers) {}
  /// Joue `start` après `delayMs` — TOUJOURS par un minuteur, même à 0 : le cadre de départ
  /// doit avoir été validé par Core Animation avant l'animation (mesuré : posé puis animé dans
  /// la même passe, le verre saute à destination, sans monter).
  void schedule(const std::string& id, double delayMs, std::function<void()> start);
  /// L'entrée n'a plus lieu d'être (la région part, la page s'en va).
  void cancel(const std::string& id);
  void cancelAll();

 private:
  Timers& timers_;
  std::map<std::string, TimerId> pending_;
};

}  // namespace tentacle::glass
