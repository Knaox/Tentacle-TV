#pragma once
// Le fil hors ligne : la « boucle d'évènements » du module.
//
// Electron fait tourner son cœur hors ligne sur la boucle du processus principal, en
// synchrone pour la base et le disque. Ici, le fil principal est AUSSI celui de l'interface
// (CEF hors écran, peinture, saisie) : une écriture disque ou une requête SQL y figerait
// l'image. Tout le hors ligne vit donc sur UN fil à lui (`CefThread`) — base, disque,
// moteur, requêtes réseau (`CefURLRequest` y rend ses rappels) — et seul ce fil y touche :
// comme chez Electron, aucune concurrence, de l'entrelacement seulement.

#include <cstdint>
#include <functional>

namespace tentacle::offline::thread {

/// Fil principal, à l'installation (après `CefInitialize`).
void start();
/// Fil principal, à l'arrêt : `last` s'exécute sur le fil hors ligne, puis le fil est joint
/// (les tâches déjà postées passent avant).
void stop(std::function<void()> last);

bool current();
void post(std::function<void()> task);
void postDelayed(std::function<void()> task, int64_t delayMs);

}  // namespace tentacle::offline::thread
