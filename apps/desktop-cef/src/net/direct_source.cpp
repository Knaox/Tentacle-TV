// L'adoption d'une source directe (voir direct_source.h et directSources.ts).

#include "net/direct_source.h"

#include <regex>

#include "net/fs_platform.h"

namespace tentacle::net::direct {

std::optional<std::string> pluginOfTrack(const std::string& trackKey) {
  static const std::regex re("^ext:([a-zA-Z0-9._-]{1,64}):");
  std::smatch m;
  if (std::regex_search(trackKey, m, re)) return m[1].str();
  return std::nullopt;
}

void adoptDirect(cf::Json source, const std::string& trackKey, const std::optional<cf::ServerSession>& session,
                 cf::PluginManifests& manifests, Relay& relay, std::function<int64_t()> now,
                 std::function<void(cf::Json, bool)> done) {
  cf::Json direct = source.contains("direct") ? source["direct"] : cf::Json();
  source.erase("direct");
  const auto pluginId = pluginOfTrack(trackKey);
  if (!direct.is_object() || !session || source.value("origin", "") != "plugin" || !pluginId) {
    return done(std::move(source), false);
  }
  manifests.mediaHosts(*session, *pluginId, [=, &relay](std::vector<std::string> mediaHosts) mutable {
    const std::string url = direct.value("url", "");
    if (!cf::allowedUrl(url, mediaHosts)) return done(std::move(source), false);
    const cf::Json expiresAt = direct.contains("expiresAt") ? direct["expiresAt"] : cf::Json();
    const int64_t t = now ? now() : nowMs();
    if (expiresAt.is_number() && expiresAt.get<double>() <= double(t + 30'000)) return done(std::move(source), false);
    const std::string local = relay.adopt(url, source.value("url", ""), session->headers);
    if (local.empty()) return done(std::move(source), false);
    source["url"] = local;
    done(std::move(source), true);
  });
}

}  // namespace tentacle::net::direct
