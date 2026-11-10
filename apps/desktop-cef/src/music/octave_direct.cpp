// Octave et le relais local des flux directs (axe reseau) : le `checked()` d'Electron
// (`ipc/audio.ts`) — une source d'extension dont CET appareil lit le flux en direct passe par
// `http://127.0.0.1:<port>/d/<jeton>`, le serveur restant le repli ; une coupure du relais relit
// le titre à la position. Sans le relais (bancs), `direct` est ignoré : le serveur.
#include "music/octave_shell.h"
#include "net/client_fetch_run.h"
#include "net/net_shell.h"

namespace tentacle::music {

void installDirectSources() {
  setDirectAdopter([](const Source& source, const std::string& trackKey, const DirectSession& session,
                      std::function<void(Source)> done) {
    net::cf::ServerSession server{session.serverOrigin, {session.headers.begin(), session.headers.end()}};
    reseau::adoptDirectSource(toJson(source), trackKey, server, [source, done](net::cf::Json adopted, bool) {
      Source out;
      // Une forme inattendue : la source d'avant, sans le direct (le serveur).
      if (parseSource(adopted, out)) {
        out = source;
        out.direct.reset();
      }
      done(std::move(out));
    });
  });
  reseau::setDirectCutListener([](const std::string& localUrl) { sourceCut(localUrl); });
  // Les hôtes déclarés lus d'avance : le premier flux direct n'attend pas cette lecture.
  setDirectPrefetch([](const DirectSession& session) {
    if (net::cf::PluginManifests* manifests = reseau::pluginManifests())
      manifests->of(net::cf::ServerSession{session.serverOrigin, {session.headers.begin(), session.headers.end()}}, "",
                    [](auto) {});
  });
}

}  // namespace tentacle::music
