#include "platform/linux/wayland_move_linux.h"

#include <SDL3/SDL.h>
#include <wayland-client.h>

#include <algorithm>
#include <cstdio>
#include <cstring>

#include "platform/linux/linux_window.h"
// L'en-tête client seul : xdg_toplevel_move ne crée aucun objet et ne lit aucun symbole
// d'interface (le code privé d'xdg-shell vit dans SDL3).
#include "xdg-shell-client-protocol.h"

namespace tentacle::platform {
namespace {

struct Watcher {
  wl_display* display = nullptr;
  wl_event_queue* queue = nullptr;
  wl_registry* registry = nullptr;
  wl_seat* seat = nullptr;
  wl_pointer* pointer = nullptr;
  wl_surface* focus = nullptr;      // la surface sous le pointeur
  wl_surface* pressedOn = nullptr;  // celle de l'appui en cours
  uint32_t pressSerial = 0;
  int held = 0;  // boutons tenus
};
Watcher* g = nullptr;

void onEnter(void*, wl_pointer*, uint32_t, wl_surface* s, wl_fixed_t, wl_fixed_t) {
  g->focus = s;
  g->held = 0;
}
// Un départ pendant un appui, c'est le compositeur qui prend la main (déplacement) : il ne
// nous rendra pas le relâcher, l'appui est fini pour nous.
void onLeave(void*, wl_pointer*, uint32_t, wl_surface*) {
  g->focus = g->pressedOn = nullptr;
  g->held = 0;
}
void onMotion(void*, wl_pointer*, uint32_t, wl_fixed_t, wl_fixed_t) {}
void onButton(void*, wl_pointer*, uint32_t serial, uint32_t, uint32_t, uint32_t state) {
  if (state == WL_POINTER_BUTTON_STATE_PRESSED) {
    if (g->held++ == 0) {
      g->pressSerial = serial;
      g->pressedOn = g->focus;
    }
  } else if (g->held > 0 && --g->held == 0) {
    g->pressedOn = nullptr;
  }
}
void onAxis(void*, wl_pointer*, uint32_t, uint32_t, wl_fixed_t) {}
void onFrame(void*, wl_pointer*) {}
void onAxisSource(void*, wl_pointer*, uint32_t) {}
void onAxisStop(void*, wl_pointer*, uint32_t, uint32_t) {}
void onAxisDiscrete(void*, wl_pointer*, uint32_t, int32_t) {}
// Siège lié en version 5 : rien de ce qui vient après (axis_value120, warp…) n'arrive. Une
// structure mise à zéro puis remplie : ses derniers champs changent d'une version de
// wayland-client à l'autre (1.26 : warp).
wl_pointer_listener pointerListener() {
  wl_pointer_listener l{};
  l.enter = onEnter;
  l.leave = onLeave;
  l.motion = onMotion;
  l.button = onButton;
  l.axis = onAxis;
  l.frame = onFrame;
  l.axis_source = onAxisSource;
  l.axis_stop = onAxisStop;
  l.axis_discrete = onAxisDiscrete;
  return l;
}
const wl_pointer_listener kPointer = pointerListener();

void onCapabilities(void*, wl_seat* seat, uint32_t caps) {
  if ((caps & WL_SEAT_CAPABILITY_POINTER) && !g->pointer) {
    g->pointer = wl_seat_get_pointer(seat);
    wl_pointer_add_listener(g->pointer, &kPointer, nullptr);
  }
}
void onSeatName(void*, wl_seat*, const char*) {}
const wl_seat_listener kSeat = {.capabilities = onCapabilities, .name = onSeatName};

void onGlobal(void*, wl_registry* r, uint32_t name, const char* iface, uint32_t version) {
  if (g->seat || std::strcmp(iface, wl_seat_interface.name) != 0) return;
  g->seat = static_cast<wl_seat*>(wl_registry_bind(r, name, &wl_seat_interface, std::min(version, 5u)));
  wl_seat_add_listener(g->seat, &kSeat, nullptr);
}
void onGlobalRemove(void*, wl_registry*, uint32_t) {}
const wl_registry_listener kRegistry = {.global = onGlobal, .global_remove = onGlobalRemove};

// Nos évènements s'empilent dans NOTRE file à chaque lecture de SDL : on les sert au fil des
// évènements de souris (fil principal, pendant la pompe de SDL), sinon chaque mouvement de la
// souris y resterait. Une autre file que celle de SDL : aucune réentrance de son traitement.
// Un observateur ne voit pas ce qu'un filtre avale : la fenêtre PiP appelle drainPointerPresses.
bool SDLCALL drain(void*, SDL_Event* e) {
  if (e->type >= SDL_EVENT_MOUSE_MOTION && e->type <= SDL_EVENT_MOUSE_REMOVED) drainPointerPresses();
  return true;
}

}  // namespace

void watchPointerPresses(SDL_Window* anyWindow) {
  const LinuxWindow* w = anyWindow ? linuxWindow(anyWindow) : nullptr;
  if (g || !w || !w->wayland || !w->wlDisplay) return;
  g = new Watcher();  // vit autant que l'app
  g->display = w->wlDisplay;
  g->queue = wl_display_create_queue(g->display);
  auto* wrapper = static_cast<wl_display*>(wl_proxy_create_wrapper(g->display));
  wl_proxy_set_queue(reinterpret_cast<wl_proxy*>(wrapper), g->queue);
  g->registry = wl_display_get_registry(wrapper);
  wl_proxy_wrapper_destroy(wrapper);
  wl_registry_add_listener(g->registry, &kRegistry, nullptr);
  wl_display_roundtrip_queue(g->display, g->queue);  // le siège
  wl_display_roundtrip_queue(g->display, g->queue);  // ses capacités, puis le pointeur
  SDL_AddEventWatch(drain, nullptr);
  if (!g->pointer) std::fprintf(stderr, "[fenêtre] pas de pointeur Wayland : glisser le PiP impossible\n");
}

void drainPointerPresses() {
  if (g) wl_display_dispatch_queue_pending(g->display, g->queue);
}

bool beginCompositorMove(SDL_Window* window) {
  if (!g || !g->pointer || !window) return false;
  drainPointerPresses();  // l'appui qui a commencé le geste
  auto* toplevel = static_cast<xdg_toplevel*>(
      SDL_GetPointerProperty(SDL_GetWindowProperties(window), SDL_PROP_WINDOW_WAYLAND_XDG_TOPLEVEL_POINTER, nullptr));
  if (!toplevel || g->held == 0 || !g->pressedOn) return false;
  xdg_toplevel_move(toplevel, g->seat, g->pressSerial);
  wl_display_flush(g->display);
  return true;
}

}  // namespace tentacle::platform
