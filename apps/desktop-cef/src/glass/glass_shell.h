#pragma once
// Le verre natif dans l'app (`install.ts` d'Electron). Depuis `src/app/modules.cpp`, sur le fil
// principal :
//   tentacle::glass::install(ctx);   // APRÈS pont::install, AVANT pont::installShim
//   tentacle::glass::shutdown();     // dans shutdownModules, AVANT pont::shutdown
//
// Sans verre natif (`availability.h` : autre système, macOS < 26, TENTACLE_LIQUID_GLASS=off),
// rien n'est branché : ni canal de la page, ni vue — `window.tentacle.liquidGlass` est absent
// et l'option de Réglages › Apparence avec lui. Seul l'instantané du banc dit pourquoi.
//
// Canaux (hors `window.tentacle.capabilities`, comme les canaux du verre d'Electron) :
//   liquidGlass.batch {enabled?, upserts, removes}   un lot par tâche (le shim regroupe)
//   liquidGlass.sample [{x, y, width, height, under?}] → [luminance | null]
//   liquidGlass.pageStarted                         un nouveau document : le verre d'avant part
//   liquidGlass.debug.snapshot → {supported, availability, refractsVideo, enabled,
//     surfaceVisible, root, groups, nativeViews, regions, leaving}   (bancs : relu dans AppKit)

namespace tentacle {
struct AppContext;
}

namespace tentacle::glass {

void install(AppContext& ctx);
/// Retire tout le verre de la fenêtre (encore vivante) et rend ses références.
void shutdown();

}  // namespace tentacle::glass
