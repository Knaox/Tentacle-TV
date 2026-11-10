// Boîtes natives Linux, portées d'Electron 43 :
//   - boîtes de message : GTK, comme `GtkMessageBox` (shell/browser/ui/message_box_gtk.cc) —
//     `GTK_MESSAGE_OTHER`, boutons « OK »/« Cancel » traduits par GTK (`_OK`, `_Cancel` du
//     domaine gtk30), transitoire de la fenêtre de l'app sous X11, modale, non bloquante.
//     GTK est chargé à la demande (dlopen) : aucune dépendance de construction ; sans GTK 3
//     (ou si GTK 4 est déjà dans le processus), repli sur `SDL_ShowMessageBox` ;
//   - panneaux de fichiers : AUCUN ici. Electron passe par `ui::SelectFileDialog` de Chromium
//     (portail XDG, sinon GTK, sinon KDE) : c'est la boîte que CEF montre par défaut.

#include <SDL3/SDL.h>
#include <dlfcn.h>
#include <libintl.h>

#include <cctype>
#include <memory>
#include <string>
#include <vector>

#include "shell/main_thread.h"
#include "shell/native_dialogs.h"

namespace tentacle::platform {
namespace {

constexpr int kGtkMessageOther = 4;   // GTK_MESSAGE_OTHER (MessageBoxType::kNone)
constexpr int kGtkButtonsNone = 0;    // GTK_BUTTONS_NONE
constexpr int kPumpIntervalMs = 16;   // tant qu'une boîte GTK vit, ses évènements passent

// Le strict nécessaire de GTK 3 / GDK 3 / GLib, résolu à l'exécution.
struct Gtk {
  bool ok = false;
  int (*init_check)(int*, char***) = nullptr;
  void (*set_allowed_backends)(const char*) = nullptr;
  void* (*message_dialog_new)(void*, int, int, int, const char*, ...) = nullptr;
  void* (*dialog_add_button)(void*, const char*, int) = nullptr;
  void (*dialog_set_default_response)(void*, int) = nullptr;
  void (*window_set_modal)(void*, int) = nullptr;
  void (*window_present)(void*) = nullptr;
  void (*widget_show)(void*) = nullptr;
  void (*widget_realize)(void*) = nullptr;
  void (*widget_destroy)(void*) = nullptr;
  void* (*widget_get_window)(void*) = nullptr;
  void* (*display_get_default)() = nullptr;
  void* (*x11_foreign_new)(void*, unsigned long) = nullptr;
  void (*window_set_transient_for)(void*, void*) = nullptr;
  unsigned long (*signal_connect_data)(void*, const char*, void*, void*, void*, int) = nullptr;
  int (*main_context_iteration)(void*, int) = nullptr;
};

template <typename T>
void bind(void* lib, T& fn, const char* name) {
  fn = reinterpret_cast<T>(dlsym(lib, name));
}

Gtk& gtk() {
  static Gtk g = [] {
    Gtk g;
    // GTK 4 déjà chargé (Chromium avec --gtk-version=4) : GTK 3 dans le même processus abandonne.
    if (dlopen("libgtk-4.so.1", RTLD_LAZY | RTLD_NOLOAD)) return g;
    void* lib = dlopen("libgtk-3.so.0", RTLD_LAZY | RTLD_GLOBAL);
    if (!lib) return g;
    bind(lib, g.init_check, "gtk_init_check");
    bind(lib, g.set_allowed_backends, "gdk_set_allowed_backends");
    bind(lib, g.message_dialog_new, "gtk_message_dialog_new");
    bind(lib, g.dialog_add_button, "gtk_dialog_add_button");
    bind(lib, g.dialog_set_default_response, "gtk_dialog_set_default_response");
    bind(lib, g.window_set_modal, "gtk_window_set_modal");
    bind(lib, g.window_present, "gtk_window_present");
    bind(lib, g.widget_show, "gtk_widget_show");
    bind(lib, g.widget_realize, "gtk_widget_realize");
    bind(lib, g.widget_destroy, "gtk_widget_destroy");
    bind(lib, g.widget_get_window, "gtk_widget_get_window");
    bind(lib, g.display_get_default, "gdk_display_get_default");
    bind(lib, g.x11_foreign_new, "gdk_x11_window_foreign_new_for_display");
    bind(lib, g.window_set_transient_for, "gdk_window_set_transient_for");
    bind(lib, g.signal_connect_data, "g_signal_connect_data");
    bind(lib, g.main_context_iteration, "g_main_context_iteration");
    if (!g.init_check || !g.message_dialog_new || !g.dialog_add_button || !g.signal_connect_data ||
        !g.widget_show || !g.widget_destroy || !g.main_context_iteration) {
      return g;
    }
    // GDK suit le même serveur graphique que SDL : sinon la boîte naîtrait sous XWayland quand
    // l'app est sous Wayland (ou l'inverse), et la parenté serait impossible.
    const char* driver = SDL_GetCurrentVideoDriver();
    if (g.set_allowed_backends && driver) g.set_allowed_backends(driver);
    g.ok = g.init_check(nullptr, nullptr) != 0;
    return g;
  }();
  return g;
}

// `TranslateToStock` d'Electron : les libellés de GTK, dans la langue du système.
const char* gtkLabel(const std::string& text) {
  std::string lower(text);
  for (char& c : lower) c = char(std::tolower(static_cast<unsigned char>(c)));
  if (lower == "cancel") return dgettext("gtk30", "_Cancel");
  if (lower == "no") return dgettext("gtk30", "_No");
  if (lower == "ok") return dgettext("gtk30", "_OK");
  if (lower == "yes") return dgettext("gtk30", "_Yes");
  return nullptr;
}

struct GtkBox {
  void* dialog = nullptr;
  int cancelId = 0;
  bool settled = false;
  MessageDone done;
};

// Les évènements de la boîte arrivent sur la connexion de GDK, que la boucle SDL ne surveille
// pas : on les fait passer à intervalle court tant qu'elle vit.
void pump(std::shared_ptr<GtkBox> box) {
  if (box->settled) return;
  while (gtk().main_context_iteration(nullptr, 0)) {
  }
  postToMainDelayed([box] { pump(box); }, kPumpIntervalMs);
}

void onResponse(void* /*dialog*/, int response, void* data) {
  auto* holder = static_cast<std::shared_ptr<GtkBox>*>(data);
  auto box = *holder;
  if (box->settled) return;
  box->settled = true;
  gtk().widget_destroy(box->dialog);
  box->done(response < 0 ? box->cancelId : response);
}

class GtkDialog final : public NativeDialog {
 public:
  explicit GtkDialog(std::shared_ptr<GtkBox> box) : box_(std::move(box)) {}
  void dismiss() override {
    if (!box_ || box_->settled) return;
    box_->settled = true;
    gtk().widget_destroy(box_->dialog);
  }

 private:
  std::shared_ptr<GtkBox> box_;
};

class NoDialog final : public NativeDialog {
 public:
  void dismiss() override {}
};

}  // namespace

std::unique_ptr<NativeDialog> showMessageBox(SDL_Window* parent, const dialogs::MessageBox& b,
                                             MessageDone done) {
  Gtk& g = gtk();
  if (!g.ok) {
    // Sans GTK : la boîte de SDL (X11 dessinée par SDL, zenity/kdialog sous Wayland), modale.
    postToMain([parent, b, done] {
      std::vector<SDL_MessageBoxButtonData> buttons;
      for (size_t i = 0; i < b.buttons.size(); ++i) {
        SDL_MessageBoxButtonFlags flags = 0;
        if (int(i) == b.defaultId) flags |= SDL_MESSAGEBOX_BUTTON_RETURNKEY_DEFAULT;
        if (int(i) == b.cancelId) flags |= SDL_MESSAGEBOX_BUTTON_ESCAPEKEY_DEFAULT;
        buttons.push_back({flags, int(i), b.buttons[i].c_str()});
      }
      const SDL_MessageBoxData data{SDL_MESSAGEBOX_INFORMATION, parent, "Tentacle TV",
                                    b.message.c_str(), int(buttons.size()), buttons.data(),
                                    nullptr};
      int pressed = b.cancelId;
      if (!SDL_ShowMessageBox(&data, &pressed) || pressed < 0) pressed = b.cancelId;
      done(pressed);
    });
    return std::make_unique<NoDialog>();
  }

  auto box = std::make_shared<GtkBox>();
  box->cancelId = b.cancelId;
  box->done = std::move(done);
  box->dialog = g.message_dialog_new(nullptr, 0, kGtkMessageOther, kGtkButtonsNone, "%s",
                                     b.message.c_str());
  for (size_t i = 0; i < b.buttons.size(); ++i) {
    const char* label = gtkLabel(b.buttons[i]);
    g.dialog_add_button(box->dialog, label ? label : b.buttons[i].c_str(), int(i));
  }
  if (g.dialog_set_default_response) g.dialog_set_default_response(box->dialog, b.defaultId);

  // Parenté (X11 seulement, comme `SetGtkTransientForAura`) : modale à la fenêtre de l'app.
  const Uint64 xid = SDL_GetNumberProperty(SDL_GetWindowProperties(parent),
                                           SDL_PROP_WINDOW_X11_WINDOW_NUMBER, 0);
  if (xid && g.widget_realize && g.widget_get_window && g.display_get_default &&
      g.x11_foreign_new && g.window_set_transient_for) {
    g.widget_realize(box->dialog);
    if (void* foreign = g.x11_foreign_new(g.display_get_default(), (unsigned long)xid)) {
      g.window_set_transient_for(g.widget_get_window(box->dialog), foreign);
    }
    if (g.window_set_modal) g.window_set_modal(box->dialog, 1);
  }
  // La donnée du signal vit autant que la boîte (fuite assumée d'un pointeur par boîte).
  auto* holder = new std::shared_ptr<GtkBox>(box);
  g.signal_connect_data(box->dialog, "response", reinterpret_cast<void*>(&onResponse), holder,
                        nullptr, 0);
  g.widget_show(box->dialog);
  if (g.window_present) g.window_present(box->dialog);
  pump(box);
  return std::make_unique<GtkDialog>(box);
}

bool hasNativeFileDialog() { return false; }

std::unique_ptr<NativeDialog> showFileDialog(SDL_Window*, const dialogs::FileRequest&,
                                             FileDone done) {
  // Jamais appelé (hasNativeFileDialog() est faux) : annulé par sécurité.
  postToMain([done] { done(std::nullopt); });
  return std::make_unique<NoDialog>();
}

}  // namespace tentacle::platform
