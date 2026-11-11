// Pannes PROVOQUÉES du lecteur natif — pour éprouver le repli vers le lecteur web
// (`apps/web/src/pages/Watch.tsx`) sans casser mpv ni retirer libmpv du paquet.
//
// Deux portes, le même mot :
//   TENTACLE_MPV_FAULT=<mode>            au lancement de l'app ;
//   tentacle.invoke("mpv_debug_fault", { mode })   en route (menu de débogage).
//
//   off     rien (le défaut) ;
//   init    `mpv_init` est refusé, comme un mpv qui ne s'initialise pas ;
//   stall   `mpv_init` ne répond jamais (la page abandonne après 8 s) ;
//   load    tout `loadfile` finit en `end-file` en erreur : rien ne s'ouvre ;
//   fatal   la lecture EN COURS tombe (`end-file` en erreur), UNE fois. Au lancement :
//           dix secondes après le départ de la première lecture ;
//   absent  la coquille ne déclare aucun canal `mpv_*` : pas de lecteur natif du tout.
//           Au lancement seulement (la page lit la liste des canaux à son chargement).
//
// Un mode reste jusqu'au suivant (`off`), sauf `fatal`, qui ne tire qu'une fois.
#pragma once

#include <optional>
#include <string>

namespace bridge {

enum class MpvFault { Off, Init, Stall, Load, Fatal, Absent };

/// Le mode nommé par `text` ; `nullopt` pour un mot inconnu.
std::optional<MpvFault> parseMpvFault(const std::string& text);
const char* mpvFaultName(MpvFault fault);
/// `TENTACLE_MPV_FAULT` ; `Off` sans elle, ou si elle est illisible (dit au journal).
MpvFault mpvFaultFromEnv();

/// Ce que la page reçoit d'une lecture qui tombe : `MPV_END_FILE_REASON_ERROR` et
/// `MPV_ERROR_GENERIC` (client.h de mpv) — une panne du LECTEUR, pas du fichier.
constexpr int kMpvEndFileError = 4;
constexpr int kMpvErrorGeneric = -20;
/// `MPV_ERROR_LOADING_FAILED` : ce que rend un `loadfile` qui n'ouvre rien.
constexpr int kMpvErrorLoadingFailed = -13;
/// Délai de la chute demandée au lancement, après le départ de la lecture.
constexpr int kFatalAfterStartMs = 10000;

}  // namespace bridge
