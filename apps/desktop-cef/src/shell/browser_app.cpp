#include "shell/browser_app.h"

#include <cstdlib>
#include <string>

#include "include/cef_command_line.h"
#include "shell/app_scheme.h"
#include "shell/message_pump.h"

namespace tentacle {
namespace {

// Chromium ne garde que la DERNIÈRE occurrence d'une liste de fonctionnalités : on fusionne
// avec ce qui est déjà sur la ligne de commande (argv, ou ce que le navigateur transmet à ses
// enfants) au lieu de l'écraser.
void appendFeatures(CefRefPtr<CefCommandLine> cl, const char* name, std::string features) {
  if (cl->HasSwitch(name)) {
    const std::string have = cl->GetSwitchValue(name);
    if (!have.empty()) features = have + "," + features;
  }
  cl->AppendSwitchWithValue(name, features);
}

}  // namespace

void BrowserApp::OnBeforeCommandLineProcessing(const CefString& processType,
                                               CefRefPtr<CefCommandLine> cl) {
  // Pas de services Google ni de trafic de fond (repris de la référence).
  for (const char* sw : {"disable-background-networking", "disable-component-update",
                         "disable-default-apps", "disable-extensions", "disable-sync",
                         "disable-translate", "disable-domain-reliability", "no-pings",
                         "disable-client-side-phishing-detection", "disable-breakpad",
                         "disable-spell-checking"}) {
    cl->AppendSwitch(sw);
  }
  // Les cinq dernières : le localStorage et l'IndexedDB du front se PARTAGENT avec Electron
  // (scripts/dev.sh), qui les tient en LevelDB. Chromium 156 sait les passer en SQLite
  // (nouvelles bases, migration des anciennes) : une base migrée ici serait illisible pour
  // Electron. On reste en LevelDB.
  appendFeatures(cl, "disable-features",
                 "Translate,OptimizationHints,MediaRouter,DialMediaRouteProvider,"
                 "SafeBrowsing,PushMessaging,BackgroundSync,PasswordManager,"
                 "AutofillServerCommunication,SpellCheck,"
                 "DomStorageSqlite,DomStorageSqliteMigration,DomStorageSqliteNewDatabases,"
                 "IdbSqliteBackingStore,IdbSqliteOnDiskRollout");
  if (processType.empty()) {
    // Modèle de processus (axe ram, docs/MESURES-RAM.md). Une seule page, une seule origine :
    // - un seul Renderer : Chromium n'en prépare plus un « de réserve » pour la navigation
    //   suivante (−25 Mo d'empreinte, −80 Mo de RSS, mesuré) ;
    // - service réseau dans le processus principal, comme Chromium sur les appareils
    //   modestes : un processus de moins (−12 Mo d'empreinte, −74 Mo de RSS, mesuré).
    cl->AppendSwitchWithValue("renderer-process-limit", "1");
    // Pas d'échantillonneur de piles de Chrome (métriques UMA) : un fil qui se réveille au repos
    // dans chaque processus pour des statistiques que nous n'envoyons pas (−0,08 % d'un cœur
    // dans le principal, mesuré par fil ; les helpers ne reçoivent plus --start-stack-profiler).
    cl->AppendSwitch("disable-stack-profiler");
    appendFeatures(cl, "enable-features", "NetworkServiceInProcess2");
  }
#ifdef __APPLE__
  // Pas d'invite du trousseau macOS (cookies chiffrés avec une clé factice).
  cl->AppendSwitch("use-mock-keychain");
  // NB : la référence ajoutait ici « single-process » (rendez-vous de ports Mach raté avec
  // une signature ad hoc). Nous gardons le multi-processus avec de vrais helpers signés.
#endif
  // Son de la page (<video> des aperçus de bandes-annonces) : comme Electron, sauf quand
  // l'app est lancée en sourdine (--mute ou TENTACLE_MUTE, règle des sessions du lot ; la
  // même règle coupe mpv, axe lecteur). Seul le processus principal décide : Chromium
  // transmet mute-audio au service audio.
  const char* muteEnv = std::getenv("TENTACLE_MUTE");  // ≠ vide et ≠ "0", comme sound_policy.h
  const bool muted = cl->HasSwitch("mute") || (muteEnv && *muteEnv && std::string(muteEnv) != "0");
  if (processType.empty() && muted) cl->AppendSwitch("mute-audio");
}

void BrowserApp::OnRegisterCustomSchemes(CefRawPtr<CefSchemeRegistrar> registrar) {
  appscheme::registerScheme(registrar);  // le même appel dans les helpers (renderer_app.cpp)
}

void BrowserApp::OnScheduleMessagePumpWork(int64_t delayMs) {
  if (pump_) pump_->scheduleWork(delayMs);
}

}  // namespace tentacle
