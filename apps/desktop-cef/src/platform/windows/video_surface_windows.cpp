// VideoSurface Windows — ébauche (propriétaire : vidéo-HDR).
// Cible : un visuel DirectComposition sous celui de la page, portant la swapchain de mpv
// (`--gpu-context=d3d11 --d3d11-output-mode=composition --d3d11-composition-size=WxH`, déjà
// dans mpv amont) ; HDR par `target-colorspace-hint`. Rien n'est encore construit :
// createVideoSurface rend nullptr, et le lecteur reste sans sortie vidéo (vo=null).

#include "platform/video_surface.h"

namespace tentacle {

void prepareWindowForVideo(void*) {}

std::unique_ptr<VideoSurface> createVideoSurface(void*) { return nullptr; }

}  // namespace tentacle
