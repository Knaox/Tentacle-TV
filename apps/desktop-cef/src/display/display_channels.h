// Les canaux de l'écran et des annexes du lecteur que la coquille Electron déclare sur les trois
// OS (`ipc/videoHdr.ts`, `ipc/video.ts`), plus les commandes propres à un OS (Windows :
// `check_msix_update`, `download_and_install_msix_update` — `ipc/updates.ts`) :
//   display_hdr_state {}        → { supporte, enabled, bascule, autoAutorise, edrCapable,
//                                   coucheHdr, espaceCouche, transmission, pic }
//   display_hdr_auto { on }     → null   (la préférence de bascule de la page)
//   mpv_harden_child_window {}  → false  (aucune fenêtre fille de mpv ici : rien à durcir)
//
// Branchement (src/app/modules.cpp), entre `pont::install` et `pont::installShim` :
//   display::install(ctx, pont::registry());
// et `display::shutdown()` APRÈS `pont::shutdown()` (l'écran est rendu en dernier).
#pragma once

namespace bridge {
class Registry;
}

namespace tentacle {
struct AppContext;
}

namespace tentacle::display {

void install(AppContext& ctx, bridge::Registry& registry);
void shutdown();

}  // namespace tentacle::display

namespace tentacle::platform {
// Commandes propres à l'OS (src/platform/<os>/os_commands_<os>.*) : Windows, le Microsoft Store.
void installOsCommands(AppContext& ctx, bridge::Registry& registry);
void shutdownOsCommands();
}  // namespace tentacle::platform
