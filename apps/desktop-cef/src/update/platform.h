#pragma once
// Ce que le moteur demande au système (une implémentation par OS) :
//   macOS   : src/platform/macos/update_*_mac.mm   (NSURLSession, tar, renamex_np, assistant)
//   Linux   : src/platform/linux/update_linux.cpp  (libcurl, AppImage / paquet)
//   Windows : src/platform/windows/update_windows.cpp (WinHTTP, MSIX / installateur)
// Les tests remplacent tout par un faux (src/update/tests/fake_platform.h).
// Tous les rappels arrivent sur le fil principal.

#include <cstdint>
#include <functional>
#include <optional>
#include <string>

#include "update/manifest.h"
#include "update/state.h"
#include "update/version.h"

namespace tentacle::update {

class Platform {
 public:
  virtual ~Platform() = default;

  // --- Identité de l'installation ---
  virtual std::optional<Version> currentVersion() = 0;
  virtual std::string platformKey() = 0;  // « macos-arm64 », « linux-x86_64-appimage »…
  virtual std::string stateDir() = 0;     // dossier privé, existant
  virtual int64_t now() = 0;              // secondes Unix
  // Peut-on se remplacer soi-même ? Sinon, pourquoi (dossier en lecture seule, app lancée
  // depuis l'image disque, format d'installation inconnu…).
  virtual bool canSelfUpdate(std::string* why) = 0;

  // --- Réseau ---
  using FetchDone = std::function<void(std::optional<std::string> body, std::string error)>;
  virtual void fetch(const std::string& url, size_t maxBytes, FetchDone done) = 0;
  using Progress = std::function<void(uint64_t received, uint64_t total)>;
  // `error` vide = succès ; `network` : l'échec vient du réseau (hors ligne, coupure).
  using DownloadDone = std::function<void(std::string error, bool network)>;
  virtual void download(const std::string& url, const std::string& dest, Progress progress, DownloadDone done) = 0;
  virtual void cancelDownload() = 0;

  // --- Fils ---
  // `work` hors du fil principal, puis `then` sur le fil principal.
  virtual void background(std::function<void()> work, std::function<void()> then) = 0;
  virtual void schedule(int64_t delayMs, std::function<void()> fn) = 0;

  // --- Installation ---
  // HORS du fil principal : extrait et contrôle l'archive vérifiée, la range prête à
  // remplacer l'app. Rend une erreur (vide = succès) et le chemin préparé.
  virtual std::string stage(const std::string& archive, const Manifest& m, std::string* stagedPath) = 0;
  // Abandonne une copie préparée (version retirée du flux, ou remplacée par une plus récente).
  virtual void discardStaged(const std::string& stagedPath) = 0;
  // Lance l'assistant détaché qui attendra la fin de ce processus pour remplacer l'app
  // (puis la relancer si `relaunch`). L'app doit quitter ensuite. Erreur vide = lancé.
  virtual std::string apply(const std::string& stagedPath, const Version& v, bool relaunch) = 0;
  // La nouvelle version ne tient pas : remettre l'ancienne et la relancer (assistant).
  virtual std::string rollback(const Probation& p) = 0;
  // Efface l'ancienne copie (la nouvelle a fait ses preuves). Peut être lent.
  virtual void removeTree(const std::string& path) = 0;
  virtual void quitApp() = 0;
};

}  // namespace tentacle::update
