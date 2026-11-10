#pragma once
// Sous-surface Wayland de la vidéo : une wl_subsurface de la surface de la page, placée
// DESSOUS, en mode désynchronisé (mpv présente à son rythme), sans région de saisie (les clics
// vont à la page). mpv y dessine par le contexte `wlhostvk` de notre libmpv
// (scripts/deps/mpv-patches-linux/0004) : Vulkan, HDR par les espaces de couleur de la WSI
// (wp-color-management-v1 côté compositeur). Elle suit la fenêtre sans colle : c'est une
// partie de la fenêtre.

#include <memory>

#include "platform/video_surface.h"

namespace tentacle::platform {

struct LinuxWindow;

// nullptr si ce n'est pas Wayland, si la libmpv n'a pas le contexte `wlhostvk` (libmpv de la
// distribution : API de rendu), si TENTACLE_VIDEO_RENDER_API=1, ou si le compositeur n'offre
// pas wl_subcompositor.
std::unique_ptr<VideoSurface> createVideoSubsurface(const LinuxWindow& window);

}  // namespace tentacle::platform
