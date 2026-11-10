// Branchement des modules du lot. Chaque propriétaire ajoute ici UNE ligne (déclaration +
// appel) — c'est la seule retouche permise dans src/app/ hors socle. Ordre des lignes (et
// d'écriture, pour éviter les conflits) : socle, puis pont, puis octave.
// La vraie surface vidéo : createMainVideoSurface(ctx) puis ctx.compositor->setVideoLayer().

#include "app/app.h"
#include "glue/pont_shell.h"  // pont : window.tentacle (src/bridge)
#include "music/octave_shell.h"  // octave : mode musique (src/music)
#include "net/net_shell.h"  // reseau : tentacle://art, tentacle://plugin, relais (src/net)
#include "pip/glue/pip_install.h"  // pip : image dans l'image (src/pip)
#include "update/update_shell.h"  // maj : mise à jour automatique (src/update)
#include "lifecycle/lifecycle_shell.h"  // systeme : cycle de vie (src/lifecycle)

namespace tentacle {

void initModules(AppContext& ctx) {
  pont::install(ctx);  // pont — octave déclare ses canaux entre ces deux lignes
  music::installInShell(pont::registry());  // octave : canaux audio_*
  pont::setOnVideoClaim([] { music::videoClaim(); });  // octave : une vidéo met la musique en pause
  lifecycle::install(ctx, pont::registry());  // systeme : liens d'app, liens externes, dossier, relance, focus
  lifecycle::setVideoControls({pont::videoRunning, pont::stopVideo, pont::pauseVideo});  // systeme : le lecteur vu de la fermeture
  lifecycle::onWindowClosed([] { music::shutdownMusic(); });  // systeme : la musique s'arrête avec la fenêtre (Electron)
  reseau::install(ctx);  // reseau : schémas tentacle://art|plugin, canaux jellyfin_*, client_fetch_*…
  pip::install(ctx, pont::registry());  // pip : commandes pip_*, fenêtre PiP
  pont::installShim(ctx);  // pont — en dernier : capabilities figées
  maj::install(ctx);  // maj : moteur de mise à jour, canaux update.*, surcouche
}

void shutdownModules() {
  maj::shutdown();  // maj : une mise à jour prête s'applique en silence à la fermeture
  music::shutdownMusic();  // octave : la musique s'arrête, la sortie audio est rendue
  reseau::shutdown();  // reseau
  pip::shutdown();  // pip : le navigateur du PiP part avant CefShutdown
  pont::shutdown();
}

}  // namespace tentacle
