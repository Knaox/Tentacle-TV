#pragma once
// Arguments de ligne de commande du processus principal.
//   --url=<URL>             page à charger (défaut : page de test du socle, dans le paquet)
//   --devtools-port=<n>     DevTools distants (défaut 9301 ; 0 = désactivés)
//   --profile=<dossier>     cache CEF (défaut $TENTACLE_CEF_CACHE/profiles/socle)
//   --frame-rate=<n>        cadence max de peinture CEF (défaut : fréquence de l'écran)
//   --fake-video=<RRGGBB|off|edr[:niveau]>  couche vidéo factice sous la page (défaut
//                           1e6b5a) ; edr = aplat HDR à niveau × blanc SDR (défaut 4)
//   --size=<L>x<H>          taille initiale de la fenêtre en points (défaut 1280x800)
//   --background            ne pas voler le focus au lancement
// Toute autre option --clé=valeur est conservée dans `extra` pour les modules, dont :
//   --web-root=<dossier>    sert ce build web sous tentacle://app (shell/app_scheme.h) ;
//                           avec --url=tentacle://app/, la page a l'origine d'Electron
//   --server-url=<URL>      adresse du serveur posée dans le front s'il n'en a aucune
//                           (défaut : l'origine de --url quand elle est http(s))
//   --app-version=<x.y.z>   window.tentacle.version (défaut : celle du banc)
// Les deux formes « --clé=valeur » et « --clé valeur » sont acceptées.

#include <cstdint>
#include <map>
#include <optional>
#include <string>

namespace tentacle {

struct AppOptions {
  std::string url;
  int devtoolsPort = 9301;
  std::string profileDir;
  int frameRate = 0;
  std::optional<uint32_t> fakeVideo = 0x1e6b5a;
  float fakeVideoEdr = 0;  // > 0 : couche factice HDR (--fake-video=edr[:niveau])
  int width = 1280, height = 800;
  bool background = false;
  std::map<std::string, std::string> extra;
};

// Renvoie false (et écrit l'aide sur stderr) si les arguments sont invalides.
bool parseArgs(int argc, char** argv, AppOptions& out);
std::string cacheRoot();  // $TENTACLE_CEF_CACHE ou ~/.cache/tentacle-cef

}  // namespace tentacle
