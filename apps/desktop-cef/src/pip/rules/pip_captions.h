#pragma once
// Le titre de la fenêtre PiP, selon son mode — et le geste ou le mouvement en cours
// (`pip/pipCaptions.ts`).
//
// Sous Linux (colle KWin), c'est par lui, et par lui seul, que le compositeur reconnaît la
// fenêtre que la vidéo doit suivre et lit le geste à exécuter. Ailleurs, la coquille mène le
// PiP elle-même et le titre n'est plus qu'un nom. ⚠️ Jamais traduit : c'est un identifiant
// entre deux processus, pas un texte.

#include <string>

#include "pip/rules/pip_types.h"

namespace tentacle::pip {

/// Au-dessus de tout, déplaçable sur tout le bureau — comme le PiP d'un navigateur.
inline constexpr const char* kCaptionFloating = "Tentacle TV · Picture-in-Picture";
/// Dans le coin bas-droit de l'application, qu'il suit.
inline constexpr const char* kCaptionDocked = "Tentacle TV · Mini player";

/// Le titre que la colle lit : celui du mode, suivi du geste s'il y en a un. Glisser porte le
/// point SAISI (`[move 162 102]`) : la colle garde ce point sous le curseur.
std::string caption(Mode mode, std::optional<Gesture> gesture,
                    std::optional<Point> grab = std::nullopt);

/// Les mouvements que la colle ANIME sous Linux — ceux que la coquille anime elle-même
/// ailleurs : l'entrée, le retour au lecteur, une nouvelle taille (taille de FENÊTRE).
/// 0 ms = la place d'un coup (« Réduire les animations »).
struct Command {
  enum class Kind { enter, restore, size } kind = Kind::enter;
  double ms = 0;
  double width = 0, height = 0;  // `size` seulement
};

std::string commandCaption(Mode mode, const Command& command);

}  // namespace tentacle::pip
