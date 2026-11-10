// Souris FACTICE pour un KWin VIRTUEL de banc (protocole org_kde_kwin_fake_input) : un vrai pointeur
// Wayland, que CDP ne donne pas (ni bulle d'aide, ni survol natif). N'agit QUE sur le compositeur désigné
// par WAYLAND_DISPLAY, lancé avec KWIN_WAYLAND_NO_PERMISSION_CHECKS=1 (kwin.sh) — jamais la vraie session.
//
// Usage : fakeinput <cmd>...   cmd ∈
//   move X Y            position absolue (coordonnées logiques du compositeur)
//   down | up           bouton gauche
//   click               down + up
//   drag X1 Y1 X2 Y2 N  appui en (X1,Y1), N pas jusqu'à (X2,Y2), relâche
//   wheel DY            molette verticale (15 = un cran vers le bas)
//   sleep MS
#include <linux/input-event-codes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <wayland-client.h>
#include "fake-input-client.h"

static struct org_kde_kwin_fake_input *fake = NULL;

static void reg_global(void *data, struct wl_registry *reg, uint32_t name, const char *iface, uint32_t version) {
  (void)data;
  if (strcmp(iface, "org_kde_kwin_fake_input") == 0) {
    fake = wl_registry_bind(reg, name, &org_kde_kwin_fake_input_interface, version < 4 ? version : 4);
  }
}
static void reg_remove(void *data, struct wl_registry *reg, uint32_t name) { (void)data; (void)reg; (void)name; }
static const struct wl_registry_listener reg_listener = { reg_global, reg_remove };

static void msleep(long ms) {
  struct timespec ts = { ms / 1000, (ms % 1000) * 1000000L };
  nanosleep(&ts, NULL);
}

int main(int argc, char **argv) {
  struct wl_display *dpy = wl_display_connect(NULL);
  if (!dpy) { fprintf(stderr, "pas de compositeur\n"); return 1; }
  struct wl_registry *reg = wl_display_get_registry(dpy);
  wl_registry_add_listener(reg, &reg_listener, NULL);
  wl_display_roundtrip(dpy);
  if (!fake) { fprintf(stderr, "org_kde_kwin_fake_input absent\n"); return 2; }
  org_kde_kwin_fake_input_authenticate(fake, "tentacle-banc", "banc Tentacle CEF");
  wl_display_roundtrip(dpy);
  for (int i = 1; i < argc; i++) {
    const char *c = argv[i];
    if (strcmp(c, "move") == 0 && i + 2 < argc) {
      double x = atof(argv[++i]), y = atof(argv[++i]);
      org_kde_kwin_fake_input_pointer_motion_absolute(fake, wl_fixed_from_double(x), wl_fixed_from_double(y));
    } else if (strcmp(c, "down") == 0) {
      org_kde_kwin_fake_input_button(fake, BTN_LEFT, 1);
    } else if (strcmp(c, "up") == 0) {
      org_kde_kwin_fake_input_button(fake, BTN_LEFT, 0);
    } else if (strcmp(c, "click") == 0) {
      org_kde_kwin_fake_input_button(fake, BTN_LEFT, 1);
      wl_display_roundtrip(dpy);
      msleep(60);
      org_kde_kwin_fake_input_button(fake, BTN_LEFT, 0);
    } else if (strcmp(c, "drag") == 0 && i + 5 < argc) {
      double x1 = atof(argv[++i]), y1 = atof(argv[++i]), x2 = atof(argv[++i]), y2 = atof(argv[++i]);
      int n = atoi(argv[++i]);
      if (n < 1) n = 1;
      org_kde_kwin_fake_input_pointer_motion_absolute(fake, wl_fixed_from_double(x1), wl_fixed_from_double(y1));
      wl_display_roundtrip(dpy);
      msleep(80);
      org_kde_kwin_fake_input_button(fake, BTN_LEFT, 1);
      wl_display_roundtrip(dpy);
      msleep(120);
      for (int s = 1; s <= n; s++) {
        double x = x1 + (x2 - x1) * s / n, y = y1 + (y2 - y1) * s / n;
        org_kde_kwin_fake_input_pointer_motion_absolute(fake, wl_fixed_from_double(x), wl_fixed_from_double(y));
        wl_display_roundtrip(dpy);
        msleep(16);
      }
      msleep(80);
      org_kde_kwin_fake_input_button(fake, BTN_LEFT, 0);
    } else if (strcmp(c, "wheel") == 0 && i + 1 < argc) {
      org_kde_kwin_fake_input_axis(fake, WL_POINTER_AXIS_VERTICAL_SCROLL, wl_fixed_from_double(atof(argv[++i])));
    } else if (strcmp(c, "sleep") == 0 && i + 1 < argc) {
      wl_display_roundtrip(dpy);
      msleep(atol(argv[++i]));
    } else {
      fprintf(stderr, "commande inconnue : %s\n", c);
      return 3;
    }
    wl_display_roundtrip(dpy);
  }
  wl_display_roundtrip(dpy);
  wl_display_disconnect(dpy);
  return 0;
}
