// VideoSurface Linux — ébauche (propriétaire : vidéo-HDR).
// Cible : une sous-surface Wayland (wl_subsurface) SOUS la surface de la page, où mpv
// dessine par son contexte Vulkan Wayland (gpu-next + color-management-v1 pour le HDR) ;
// X11 : une fenêtre fille. Rien n'est encore construit : createVideoSurface rend nullptr, et
// le lecteur reste sans sortie vidéo (vo=null) — aucune fenêtre mpv à part n'est ouverte.

#include "platform/video_surface.h"

namespace tentacle {

void prepareWindowForVideo(void*) {}

std::unique_ptr<VideoSurface> createVideoSurface(void*) { return nullptr; }

}  // namespace tentacle
