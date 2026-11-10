// MPRIS (Linux) — l'objet `/org/mpris/MediaPlayer2` sur le bus : les appels reçus (lecture,
// saut…), le nom possédé, les signaux (`PropertiesChanged`, `Seeked`). Fil D-Bus seulement.
#include <unistd.h>

#include <algorithm>
#include <cstdio>
#include <cstring>
#include <optional>

#include "media_session_linux.h"

namespace tentacle::media_session::mpris {
namespace {

// Rate et Volume en LECTURE seule : le système ne règle ni la vitesse ni le volume (aucun
// curseur affiché). Position et CanControl n'émettent jamais `PropertiesChanged` (spécification).
constexpr char kIntrospection[] = R"xml(<node>
  <interface name="org.mpris.MediaPlayer2">
    <method name="Raise"/>
    <method name="Quit"/>
    <property name="CanQuit" type="b" access="read"/>
    <property name="CanRaise" type="b" access="read"/>
    <property name="HasTrackList" type="b" access="read"/>
    <property name="Identity" type="s" access="read"/>
    <property name="DesktopEntry" type="s" access="read"/>
    <property name="SupportedUriSchemes" type="as" access="read"/>
    <property name="SupportedMimeTypes" type="as" access="read"/>
  </interface>
  <interface name="org.mpris.MediaPlayer2.Player">
    <method name="Next"/>
    <method name="Previous"/>
    <method name="Pause"/>
    <method name="PlayPause"/>
    <method name="Stop"/>
    <method name="Play"/>
    <method name="Seek"><arg direction="in" name="Offset" type="x"/></method>
    <method name="SetPosition">
      <arg direction="in" name="TrackId" type="o"/>
      <arg direction="in" name="Position" type="x"/>
    </method>
    <method name="OpenUri"><arg direction="in" name="Uri" type="s"/></method>
    <signal name="Seeked"><arg name="Position" type="x"/></signal>
    <property name="PlaybackStatus" type="s" access="read"/>
    <property name="Rate" type="d" access="read"/>
    <property name="Metadata" type="a{sv}" access="read"/>
    <property name="Volume" type="d" access="read"/>
    <property name="Position" type="x" access="read">
      <annotation name="org.freedesktop.DBus.Property.EmitsChangedSignal" value="false"/>
    </property>
    <property name="MinimumRate" type="d" access="read"/>
    <property name="MaximumRate" type="d" access="read"/>
    <property name="CanGoNext" type="b" access="read"/>
    <property name="CanGoPrevious" type="b" access="read"/>
    <property name="CanPlay" type="b" access="read"/>
    <property name="CanPause" type="b" access="read"/>
    <property name="CanSeek" type="b" access="read"/>
    <property name="CanControl" type="b" access="read">
      <annotation name="org.freedesktop.DBus.Property.EmitsChangedSignal" value="false"/>
    </property>
  </interface>
</node>)xml";

// Les propriétés qui changent pendant la lecture et que l'on SIGNALE (les autres sont fixes).
constexpr const char* kEmitted[] = {"PlaybackStatus", "Metadata", "Rate", "CanGoNext", "CanGoPrevious", "CanSeek"};

constexpr guint32 kNameDoNotQueue = 0x4;
constexpr guint32 kNamePrimaryOwner = 1;
constexpr guint32 kNameAlreadyOwner = 4;

void methodThunk(GDBusConnection*, const gchar*, const gchar*, const gchar* iface, const gchar* method,
                 GVariant* params, GDBusMethodInvocation* invocation, gpointer self) {
  static_cast<Service*>(self)->onMethodCall(iface, method, params, invocation);
}

GVariant* propertyThunk(GDBusConnection*, const gchar*, const gchar*, const gchar* iface, const gchar* name,
                        GError** error, gpointer self) {
  GVariant* value = static_cast<const Service*>(self)->property(iface, name);
  if (!value) g_set_error(error, G_DBUS_ERROR, G_DBUS_ERROR_UNKNOWN_PROPERTY, "Propriété inconnue : %s", name);
  return value;
}

const GDBusInterfaceVTable kVtable = {methodThunk, propertyThunk, nullptr, {}};

GVariant* busCall(GDBusConnection* conn, const char* method, GVariant* params) {
  return g_dbus_connection_call_sync(conn, "org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus",
                                     method, params, G_VARIANT_TYPE("(u)"), G_DBUS_CALL_FLAGS_NONE, kCallTimeoutMs,
                                     nullptr, nullptr);
}

}  // namespace

GDBusNodeInfo* parseIntrospection() {
  GError* error = nullptr;
  GDBusNodeInfo* node = g_dbus_node_info_new_for_xml(kIntrospection, &error);
  if (!node) {
    std::fprintf(stderr, "[mpris] introspection invalide : %s\n", error ? error->message : "?");
    g_clear_error(&error);
  }
  return node;
}

void Service::onMethodCall(const char* iface, const char* method, GVariant* params, GDBusMethodInvocation* invocation) {
  // Racine : Raise et Quit existent (la spécification les exige), sans effet (CanRaise, CanQuit faux).
  if (std::strcmp(iface, kPlayerInterface) == 0) {
    const std::string m = method;
    if (m == "OpenUri") {
      g_dbus_method_invocation_return_dbus_error(invocation, "org.freedesktop.DBus.Error.NotSupported",
                                                 "OpenUri n'est pas pris en charge");
      return;
    }
    if (m == "Play") send(Command::Play);
    else if (m == "Pause") send(Command::Pause);
    else if (m == "PlayPause") send(Command::Toggle);
    else if (m == "Stop") send(Command::Stop);
    else if (m == "Next" && state_.controls.next) send(Command::Next);
    else if (m == "Previous" && state_.controls.previous) send(Command::Previous);
    else if (m == "Seek") {
      gint64 offset = 0;
      g_variant_get(params, "(x)", &offset);
      seekBy(offset);
    } else if (m == "SetPosition") {
      const gchar* track = nullptr;
      gint64 position = 0;
      g_variant_get(params, "(&ox)", &track, &position);
      setPosition(track, position);
    }
  }
  g_dbus_method_invocation_return_value(invocation, nullptr);
}

void Service::send(Command command, double position) const {
  if (host_.onCommand) host_.onCommand(CommandEvent{command, position});
}

void Service::seekBy(int64_t offsetUs) {
  if (!state_.controls.seek) return;  // CanSeek faux : sans effet (spécification)
  // Relatif chez MPRIS, ABSOLU pour le cœur : depuis la position que voient les clients.
  double target = positionMs() + double(offsetUs) / 1000.0;
  const std::optional<double>& duration = state_.playback.durationMs;
  if (duration && *duration > 0 && target > *duration) {
    // Au-delà de la fin : « comme Next » (spécification) ; sans titre suivant, la fin.
    if (state_.controls.next) return send(Command::Next);
    target = *duration;
  }
  send(Command::Seek, std::max(0.0, target));
}

void Service::setPosition(const char* track, int64_t positionUs) {
  // Sans effet si le titre a changé, la position est négative ou au-delà de la fin.
  if (!state_.controls.seek || !state_.hasNow || !track || trackId() != track || positionUs < 0) return;
  const double target = double(positionUs) / 1000.0;
  const std::optional<double>& duration = state_.playback.durationMs;
  if (duration && *duration > 0 && target > *duration) return;
  send(Command::Seek, target);
}

void Service::reconcile() {
  // Sans bus (ou bus fermé : fin de session), l'état suit et rien ne part.
  if (!conn_ || g_dbus_connection_is_closed(conn_)) return;
  if (!state_.active) {
    exportFailed_ = false;  // la prochaine activation retentera
    if (exported_) unexportObject();
  } else if (!exported_) {
    if (!exportFailed_) exportObject();
  } else {
    emitChanges();
    if (seekPending_) emitSignal(kPlayerInterface, "Seeked", g_variant_new("(x)", gint64(positionUs())));
  }
  seekPending_ = false;  // un lecteur qui apparaît est lu en entier : rien à signaler
}

void Service::exportObject() {
  GError* error = nullptr;
  GDBusInterfaceInfo* root = node_ ? g_dbus_node_info_lookup_interface(node_, kRootInterface) : nullptr;
  GDBusInterfaceInfo* player = node_ ? g_dbus_node_info_lookup_interface(node_, kPlayerInterface) : nullptr;
  // Enregistré sur CE fil : GDBus rappelle l'objet dans `ctx_` (contexte thread-default).
  if (root && player) {
    rootId_ = g_dbus_connection_register_object(conn_, kObjectPath, root, &kVtable, this, nullptr, &error);
    if (rootId_)
      playerId_ = g_dbus_connection_register_object(conn_, kObjectPath, player, &kVtable, this, nullptr, &error);
  }
  if (!rootId_ || !playerId_) {
    std::fprintf(stderr, "[mpris] objet non publié : %s\n", error ? error->message : "introspection");
    g_clear_error(&error);
    unexportObject();
    exportFailed_ = true;
    return;
  }
  // Le nom APRÈS l'objet : un client qui le voit apparaître lit aussitôt les propriétés.
  const std::string instance = std::string(kBusName) + ".instance" + std::to_string(getpid());
  for (const std::string& name : {std::string(kBusName), instance}) {
    if (!requestName(name)) continue;
    std::lock_guard lock(mu_);
    name_ = name;
    break;
  }
  if (name_.empty()) {
    std::fprintf(stderr, "[mpris] aucun nom MPRIS disponible\n");
    unexportObject();
    exportFailed_ = true;
    return;
  }
  exported_ = true;
  // Ce que les clients vont lire : la référence des prochains `PropertiesChanged`.
  emitted_.clear();
  for (const char* name : kEmitted) emitted_[name].reset(g_variant_ref_sink(playerProperty(name)));
}

bool Service::requestName(const std::string& name) {
  GVariant* reply = busCall(conn_, "RequestName", g_variant_new("(su)", name.c_str(), kNameDoNotQueue));
  if (!reply) return false;
  guint32 code = 0;
  g_variant_get(reply, "(u)", &code);
  g_variant_unref(reply);
  return code == kNamePrimaryOwner || code == kNameAlreadyOwner;  // 3 : déjà pris par un autre
}

void Service::unexportObject() {
  std::string name;
  {
    std::lock_guard lock(mu_);
    name.swap(name_);
  }
  // Le nom D'ABORD : les widgets retirent le lecteur avant que l'objet ne disparaisse.
  if (!name.empty()) {
    if (GVariant* reply = busCall(conn_, "ReleaseName", g_variant_new("(s)", name.c_str()))) g_variant_unref(reply);
  }
  if (playerId_) g_dbus_connection_unregister_object(conn_, playerId_);
  if (rootId_) g_dbus_connection_unregister_object(conn_, rootId_);
  playerId_ = rootId_ = 0;
  exported_ = false;
  emitted_.clear();
}

void Service::emitChanges() {
  GVariantBuilder changed;
  g_variant_builder_init(&changed, G_VARIANT_TYPE_VARDICT);
  bool any = false;
  for (const char* name : kEmitted) {
    VariantPtr value(g_variant_ref_sink(playerProperty(name)));
    VariantPtr& last = emitted_[name];
    if (last && g_variant_equal(last.get(), value.get())) continue;
    g_variant_builder_add(&changed, "{sv}", name, value.get());
    last = std::move(value);
    any = true;
  }
  if (!any) {
    g_variant_builder_clear(&changed);
    return;
  }
  GVariantBuilder invalidated;
  g_variant_builder_init(&invalidated, G_VARIANT_TYPE_STRING_ARRAY);
  emitSignal("org.freedesktop.DBus.Properties", "PropertiesChanged",
             g_variant_new("(sa{sv}as)", kPlayerInterface, &changed, &invalidated));
}

void Service::emitSignal(const char* iface, const char* signal, GVariant* params) {
  GError* error = nullptr;
  if (!g_dbus_connection_emit_signal(conn_, nullptr, kObjectPath, iface, signal, params, &error)) {
    std::fprintf(stderr, "[mpris] signal %s perdu : %s\n", signal, error ? error->message : "?");
    g_clear_error(&error);
  }
}

void Service::shutdown() {
  stopping_ = true;
  if (conn_) {
    unexportObject();
    g_dbus_connection_flush_sync(conn_, nullptr, nullptr);
    g_dbus_connection_close_sync(conn_, nullptr, nullptr);
    GDBusConnection* conn = nullptr;
    {
      std::lock_guard lock(mu_);
      std::swap(conn, conn_);
    }
    g_object_unref(conn);
  }
  art_.clear();
  g_main_loop_quit(loop_);
}

}  // namespace tentacle::media_session::mpris
