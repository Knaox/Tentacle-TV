// Windows : l'implémentation système du moteur de mise à jour.
// ⚠️ ÉCRITE, NON EXÉCUTÉE (aucune machine Windows) : liée au build Windows de l'app (lot
// cef-parite : CMakeLists, libsodium MSVC du lanceur) et compilée à blanc ; à éprouver.
//
// Deux installations :
//  - MSIX (Microsoft Store ou fichier .appinstaller) : Windows tient la mise à jour ; le
//    moteur ne remplace rien (`msix-managed`) — l'obligatoire prévient sans bloquer ;
//  - installation par utilisateur (%LOCALAPPDATA%\Programs\Tentacle, sans droits admin) :
//    archive .zip du dossier de l'app, extraite à côté par tar.exe (Windows 10 1803+),
//    remplacée APRÈS la sortie de l'app par l'assistant tentacle-update.exe (un exécutable
//    en cours ne se remplace pas sous Windows), relance, période d'essai, retour arrière.
#include <windows.h>
#include <shellapi.h>
#include <winhttp.h>
#if __has_include(<appmodel.h>)
#include <appmodel.h>
#else  // mingw-w64 < 11 : la fonction est dans kernel32 (Windows 8+), sans en-tête
extern "C" LONG WINAPI GetCurrentPackageFullName(UINT32* packageFullNameLength, PWSTR packageFullName);
#endif
#ifndef APPMODEL_ERROR_NO_PACKAGE
#define APPMODEL_ERROR_NO_PACKAGE 15700L
#endif

#include <ctime>
#include <filesystem>
#include <thread>

#include "platform/windows/update_signature_windows.h"
#include "update/system.h"

#ifndef TENTACLE_APP_VERSION
#define TENTACLE_APP_VERSION "0.1.0"
#endif

namespace tentacle::update {
namespace {

namespace fs = std::filesystem;

std::wstring wide(const std::string& s) {
  std::wstring w(MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, w.data(), int(w.size()));
  w.resize(w.size() - 1);
  return w;
}

fs::path exePath() {
  wchar_t buf[MAX_PATH * 4];
  GetModuleFileNameW(nullptr, buf, DWORD(std::size(buf)));
  return buf;
}

bool isPackaged() {
  UINT32 len = 0;
  return GetCurrentPackageFullName(&len, nullptr) != APPMODEL_ERROR_NO_PACKAGE;
}

// WinHTTP synchrone (dans un fil) : `sink` reçoit les blocs ; rend « » ou l'erreur.
std::string httpGet(const std::string& url, const std::function<bool(const char*, DWORD, uint64_t)>& sink,
                    bool& network) {
  URL_COMPONENTS uc{};
  uc.dwStructSize = sizeof uc;
  wchar_t host[256], path[2048];
  uc.lpszHostName = host, uc.dwHostNameLength = 256, uc.lpszUrlPath = path, uc.dwUrlPathLength = 2048;
  const std::wstring w = wide(url);
  if (!WinHttpCrackUrl(w.c_str(), 0, 0, &uc)) return "bad-url";
  HINTERNET s = WinHttpOpen(L"Tentacle", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, nullptr, nullptr, 0);
  HINTERNET c = s ? WinHttpConnect(s, host, uc.nPort, 0) : nullptr;
  const DWORD flags = uc.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0;
  HINTERNET r = c ? WinHttpOpenRequest(c, L"GET", path, nullptr, nullptr, nullptr, flags) : nullptr;
  std::string err;
  if (!r || !WinHttpSendRequest(r, nullptr, 0, nullptr, 0, 0, 0) || !WinHttpReceiveResponse(r, nullptr)) {
    network = true;
    err = "network:" + std::to_string(GetLastError());
  } else {
    DWORD status = 0, size = sizeof status;
    WinHttpQueryHeaders(r, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, nullptr, &status, &size, nullptr);
    wchar_t lenBuf[32];
    DWORD lenSize = sizeof lenBuf;
    uint64_t total = 0;
    if (WinHttpQueryHeaders(r, WINHTTP_QUERY_CONTENT_LENGTH, nullptr, lenBuf, &lenSize, nullptr))
      total = _wcstoui64(lenBuf, nullptr, 10);
    if (status != 200) err = "http-" + std::to_string(status);
    char buf[64 * 1024];
    DWORD got = 0;
    while (err.empty() && WinHttpReadData(r, buf, sizeof buf, &got) && got > 0)
      if (!sink(buf, got, total)) err = "too-large";
  }
  if (r) WinHttpCloseHandle(r);
  if (c) WinHttpCloseHandle(c);
  if (s) WinHttpCloseHandle(s);
  return err;
}

class WindowsPlatform : public Platform {
 public:
  explicit WindowsPlatform(SystemHooks h) : h_(std::move(h)) { fs::create_directories(wide(h_.stateDir)); }
  std::optional<Version> currentVersion() override { return Version::parse(TENTACLE_APP_VERSION); }
  std::string platformKey() override { return "windows-x64-zip"; }
  std::string stateDir() override { return h_.stateDir; }
  int64_t now() override { return int64_t(std::time(nullptr)); }
  bool canSelfUpdate(std::string* why) override {
    auto no = [why](const char* reason) {
      if (why) *why = reason;
      return false;
    };
    if (isPackaged()) return no("msix-managed");
    const fs::path dir = exePath().parent_path();
    const fs::path probe = dir.parent_path() / L".tentacle-write-probe";
    HANDLE f = CreateFileW(probe.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_FLAG_DELETE_ON_CLOSE, nullptr);
    if (f == INVALID_HANDLE_VALUE) return no("not-writable");
    CloseHandle(f);
    return fs::exists(dir / L"tentacle-update.exe") || no("no-helper");
  }
  void fetch(const std::string& url, size_t maxBytes, FetchDone done) override {
    auto post = h_.post;
    std::thread([=] {
      std::string body;
      bool network = false;
      const std::string err = httpGet(url, [&](const char* d, DWORD n, uint64_t) {
        body.append(d, n);
        return body.size() <= maxBytes;
      }, network);
      std::optional<std::string> out;
      if (err.empty()) out = body;
      post([done, out, err] { done(out, err); });
    }).detach();
  }
  void download(const std::string& url, const std::string& dest, Progress progress, DownloadDone done) override {
    auto post = h_.post;
    std::thread([=] {
      FILE* f = _wfopen(wide(dest).c_str(), L"wb");
      uint64_t received = 0;
      bool network = false;
      std::string err = f ? httpGet(url, [&](const char* d, DWORD n, uint64_t total) {
        received += n;
        post([progress, received, total] { progress(received, total); });
        return fwrite(d, 1, n, f) == n;
      }, network) : "open";
      if (f) fclose(f);
      post([done, err, network] { done(err, network); });
    }).detach();
  }
  void cancelDownload() override {}
  void background(std::function<void()> work, std::function<void()> then) override {
    auto post = h_.post;
    std::thread([work, then, post] {
      work();
      post(then);
    }).detach();
  }
  void schedule(int64_t delayMs, std::function<void()> fn) override { h_.postDelayed(delayMs, std::move(fn)); }

  std::string stage(const std::string& archive, const Manifest& m, std::string* staged) override {
    const fs::path dir = exePath().parent_path();
    const fs::path next = dir.parent_path() / (L"." + dir.filename().wstring() + L".update");
    std::error_code ec;
    fs::remove_all(next, ec);
    fs::create_directories(next);
    // tar.exe (bsdtar) lit le zip ; `..` et chemins absolus refusés.
    const std::wstring cmd = L"tar.exe -xf \"" + wide(archive) + L"\" -C \"" + next.wstring() + L"\"";
    if (run(cmd) != 0) return "extract";
    if (!fs::exists(next / L"Tentacle.exe")) return "layout";
    // Même éditeur que l'app en cours (Authenticode), comme l'équipe Apple côté macOS ; refait
    // par l'assistant juste avant l'échange.
    for (const wchar_t* exe : {L"Tentacle.exe", L"tentacle-update.exe"}) {
      if (std::string bad = win::checkPublisher((dir / exe).wstring(), (next / exe).wstring()); !bad.empty()) {
        fs::remove_all(next, ec);
        return bad;
      }
    }
    *staged = next.string();
    return {};
  }
  void discardStaged(const std::string& staged) override { removeTree(staged); }
  std::string apply(const std::string& staged, const Version& v, bool relaunch) override {
    return spawnHelper(L"apply --staged \"" + wide(staged) + L"\" --version " + wide(v.str()), relaunch);
  }
  std::string rollback(const Probation& p) override {
    return spawnHelper(L"rollback --previous \"" + wide(p.previousPath) + L"\" --version " + wide(p.version), true);
  }
  void removeTree(const std::string& path) override {
    std::error_code ec;
    fs::remove_all(wide(path), ec);
  }
  void quitApp() override { h_.quit(); }

 private:
  static DWORD run(std::wstring cmd) {
    STARTUPINFOW si{};
    si.cb = sizeof si;
    PROCESS_INFORMATION pi{};
    if (!CreateProcessW(nullptr, cmd.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, nullptr, &si, &pi))
      return DWORD(-1);
    WaitForSingleObject(pi.hProcess, INFINITE);
    DWORD code = 1;
    GetExitCodeProcess(pi.hProcess, &code);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return code;
  }
  // L'assistant est copié dans le dossier d'état (hors du dossier qu'il remplace) puis lancé
  // détaché ; il attend la fin de ce processus (OpenProcess + WaitForSingleObject).
  std::string spawnHelper(const std::wstring& args, bool relaunch) {
    const fs::path src = exePath().parent_path() / L"tentacle-update.exe";
    const fs::path exe = fs::path(wide(h_.stateDir)) / L"tentacle-update.exe";
    if (!CopyFileW(src.c_str(), exe.c_str(), FALSE)) return "helper-copy";
    std::wstring cmd = L"\"" + exe.wstring() + L"\" " + args + L" --pid " + std::to_wstring(GetCurrentProcessId()) +
                       L" --app \"" + exePath().parent_path().wstring() + L"\" --state-dir \"" + wide(h_.stateDir) + L"\"";
    if (relaunch) cmd += L" --relaunch -- " + std::wstring(GetCommandLineW());
    STARTUPINFOW si{};
    si.cb = sizeof si;
    PROCESS_INFORMATION pi{};
    if (!CreateProcessW(nullptr, cmd.data(), nullptr, nullptr, FALSE, DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
                        nullptr, nullptr, &si, &pi))
      return "helper-spawn:" + std::to_string(GetLastError());
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return {};
  }

  SystemHooks h_;
};

}  // namespace

std::unique_ptr<Platform> createSystemPlatform(SystemHooks hooks) {
  return std::make_unique<WindowsPlatform>(std::move(hooks));
}

void openExternalUrl(const std::string& url) {
  ShellExecuteW(nullptr, L"open", wide(url).c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

}  // namespace tentacle::update
