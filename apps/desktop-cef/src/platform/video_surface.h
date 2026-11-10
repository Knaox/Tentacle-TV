#pragma once
// Surface vidéo native, par OS (propriétaire : vidéo-HDR). Voir docs/INTERFACES.md.
//
// macOS : NOTRE CAMetalLayer. Le compositeur du socle la range SOUS la page
// (setVideoLayer → nativeLayer()) et lui donne son cadre (setFrame). mpv y dessine par le
// contexte `moltenvk` de notre libmpv (--wid = la couche) ; MoltenVK y pose lui-même
// colorspace (ITUR_2100_PQ…), EDR et métadonnées HDR quand libplacebo choisit une sortie HDR.
// Linux : sous-surface Wayland SOUS la page (mpv en Vulkan par le contexte `wlhostvk` de notre
// libmpv, HDR possible), sinon l'API de rendu OpenGL de libmpv (X11, libmpv de la distribution).
// Windows : un visuel DirectComposition du compositeur du socle ; mpv y présente SA chaîne
// d'échange (`--gpu-context=d3d11 --d3d11-output-mode=composition`), que le lecteur lui remet
// (`display-swapchain`).
//
// Tous les appels : fil principal (UI) uniquement.

#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace tentacle {

struct RectPt {  // en points, coordonnées logiques de la fenêtre, origine en haut à gauche
    double x = 0, y = 0, width = 0, height = 0;
};

struct PixelSize {
    int w = 0, h = 0;
};

// État de la couche tel que le système le voit (preuves HDR) — lu sur le fil principal.
struct SurfaceColorState {
    std::string colorspace;   // ex. « kCGColorSpaceITUR_2100_PQ », vide si nil
    std::string pixelFormat;  // ex. « BGR10A2Unorm »
    bool wantsEdr = false;    // wantsExtendedDynamicRangeContent
    bool hasEdrMetadata = false;
    bool opaque = false;
    // La fenêtre qui porte la couche (preuve du plein écran natif, pas seulement le drapeau SDL).
    bool windowFullscreen = false;  // macOS : NSWindowStyleMaskFullScreen
    RectPt windowFrame;             // cadre de la fenêtre, en points (origine écran)
};

class VideoSurface {
public:
    virtual ~VideoSurface() = default;

    virtual void show() = 0;
    virtual void hide() = 0;
    virtual bool visible() const = 0;
    // Cadre dans le conteneur du compositeur, en points (origine en haut à gauche).
    virtual void setFrame(RectPt frame) = 0;
    virtual double backingScale() const = 0;
    // macOS : le CALayer* (CAMetalLayer*) que le compositeur range SOUS la page.
    virtual void* nativeLayer() = 0;

    // Taille en pixels du cadre courant (= taille du swapchain à donner à mpv).
    virtual PixelSize pixelSize() const = 0;
    // Valeur à passer à mpv `--wid` (macOS : la CAMetalLayer*), 0 si aucune.
    virtual int64_t mpvWid() const = 0;
    // `--gpu-context` à utiliser avec ce wid (macOS : « moltenvk »).
    virtual const char* mpvGpuContext() const = 0;

    virtual SurfaceColorState colorState() const = 0;
    // Rappel (fil principal) quand la taille en pixels change (cadre, écran, Retina).
    virtual void onPixelSizeChanged(std::function<void(PixelSize)> cb) = 0;

    // Option de mpv qui porte la taille du swapchain (--wid sans fenêtre de mpv) : macOS
    // « moltenvk-surface-size » ; Linux (sous-surface Wayland) « wlhostvk-surface-size ».
    virtual const char* mpvSurfaceSizeOption() const { return "moltenvk-surface-size"; }
    // API de rendu de libmpv (Linux : X11, ou libmpv sans contexte d'intégration Wayland).
    // Vrai = la surface a créé son contexte de rendu sur ce cœur de mpv (`mpv_handle*`) et le
    // compositeur y dessinera : le lecteur pose alors vo=libmpv, jamais gpu-context ni wid.
    // Faux (défaut : macOS, Windows) = chemin --wid. Fil principal.
    virtual bool attachRenderApi(void* mpvHandle) { return false; }
    // Avant de rendre la surface au lecteur (vo=null posé) : libère le contexte de rendu.
    virtual void detachRenderApi() {}
    // Options posées à l'attache, AVANT `vo` (défaut : aucune ; Windows : gpu-api=d3d11, mode
    // composition, target-colorspace-hint=no comme Electron).
    virtual std::vector<std::pair<std::string, std::string>> mpvAttachOptions() const { return {}; }
    // Vrai si mpv crée lui-même la chaîne d'échange que la surface doit afficher (Windows) :
    // MpvPlayerPort relit `display-swapchain` à chaque (re)configuration de la sortie et la
    // remet par setMpvSwapchain (adresse d'un IDXGISwapChain*, 0 : plus de sortie).
    virtual bool wantsMpvSwapchain() const { return false; }
    virtual void setMpvSwapchain(int64_t address) {}
};

// À appeler sur la fenêtre principale AVANT sa première mise à l'écran (fenêtre SDL3 créée
// avec SDL_WINDOW_HIDDEN, puis SDL_ShowWindow). macOS : SDL3 marque sa NSWindow en sRGB
// (constaté) ; on lui rend l'espace de couleur par défaut de l'écran. FACULTATIF : mesuré le
// 03/11, une fenêtre SDL3 restée sRGB obtient la même marge EDR (8,44). Linux/Windows : rien.
void prepareWindowForVideo(void* nativeWindow);

// `nativeWindow` : macOS NSWindow* ; Windows HWND ; Linux wl_surface* / Window X11.
// La couche naît ici : créer la surface juste avant le premier `loadfile` d'une vidéo.
// Retourne nullptr si l'OS n'est pas pris en charge ou si la fenêtre est invalide.
std::unique_ptr<VideoSurface> createVideoSurface(void* nativeWindow);

}  // namespace tentacle
