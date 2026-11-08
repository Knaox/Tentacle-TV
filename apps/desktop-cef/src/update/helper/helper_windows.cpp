// tentacle-update.exe — l'assistant de remplacement (Windows), pendant de helper_mac.mm.
// ⚠️ ÉCRIT, NON CONSTRUIT NI TESTÉ (aucune machine Windows dans ce lot).
//   tentacle-update apply    --staged S  --version V --pid N --app DIR --state-dir D [--relaunch -- <ligne de commande>]
//   tentacle-update rollback --previous P --version V --pid N --app DIR --state-dir D [--relaunch -- <ligne de commande>]
// Windows n'a pas d'échange atomique de dossiers : deux MoveFileEx, l'ancien remis en place
// si le second échoue. Le dossier de l'app ne se renomme qu'une fois l'app sortie.
#include <windows.h>

#include <cstdio>
#include <map>
#include <string>

#include "update/state.h"

using namespace tentacle::update;

namespace {

std::string narrow(const std::wstring& w) {
  std::string s(WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, nullptr, 0, nullptr, nullptr), '\0');
  WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, s.data(), int(s.size()), nullptr, nullptr);
  s.resize(s.size() - 1);
  return s;
}

struct Args {
  std::wstring mode, commandLine;
  std::map<std::wstring, std::wstring> opt;
  bool relaunch = false;
};

Args parse() {
  Args a;
  const wchar_t* full = GetCommandLineW();
  // Ce qui suit « -- » est la ligne de commande d'origine, rendue telle quelle.
  if (const wchar_t* sep = wcsstr(full, L" -- ")) a.commandLine = sep + 4;
  int argc = 0;
  wchar_t** argv = CommandLineToArgvW(full, &argc);
  if (argc > 1) a.mode = argv[1];
  for (int i = 2; i < argc; ++i) {
    const std::wstring k = argv[i];
    if (k == L"--") break;
    if (k == L"--relaunch") a.relaunch = true;
    else if (k.rfind(L"--", 0) == 0 && i + 1 < argc) a.opt[k.substr(2)] = argv[++i];
  }
  LocalFree(argv);
  return a;
}

HANDLE launch(std::wstring commandLine) {
  STARTUPINFOW si{};
  si.cb = sizeof si;
  PROCESS_INFORMATION pi{};
  if (!CreateProcessW(nullptr, commandLine.data(), nullptr, nullptr, FALSE, 0, nullptr, nullptr, &si, &pi))
    return nullptr;
  CloseHandle(pi.hThread);
  return pi.hProcess;
}

int rollback(const Args& a, const std::wstring& previous) {
  const std::wstring app = a.opt.at(L"app"), failed = app + L".failed";
  if (!MoveFileExW(app.c_str(), failed.c_str(), 0)) return 5;
  if (!MoveFileExW(previous.c_str(), app.c_str(), 0)) {
    MoveFileExW(failed.c_str(), app.c_str(), 0);
    return 5;
  }
  const std::string dir = narrow(a.opt.at(L"state-dir"));
  Probation p = loadProbation(dir + "/probation.json").value_or(Probation{});
  p.version = narrow(a.opt.at(L"version"));
  p.rolledBack = p.version;
  p.previousPath.clear();
  saveProbation(dir + "/probation.json", p);
  std::fprintf(stderr, "revenu à l'ancienne copie\n");
  // La copie fautive s'efface en arrière-plan à la prochaine mise à jour (dossier .failed).
  if (a.relaunch) CloseHandle(launch(a.commandLine));
  return 0;
}

int apply(const Args& a) {
  const std::wstring app = a.opt.at(L"app"), staged = a.opt.at(L"staged");
  const size_t slash = app.find_last_of(L"\\/");
  const std::wstring previous = app.substr(0, slash + 1) + L"." + app.substr(slash + 1) + L".previous";
  RemoveDirectoryW(previous.c_str());  // (vide seulement ; l'app efface l'ancienne copie pleine)
  // Les sous-processus de CEF (GPU, rendu) survivent un instant à l'app : leurs fichiers
  // ouverts bloquent le renommage du dossier. On réessaie 30 s.
  bool moved = false;
  for (int i = 0; i < 60 && !(moved = MoveFileExW(app.c_str(), previous.c_str(), 0)); ++i) Sleep(500);
  if (!moved) return 3;
  if (!MoveFileExW(staged.c_str(), app.c_str(), 0)) {
    MoveFileExW(previous.c_str(), app.c_str(), 0);
    return 3;
  }
  const std::string dir = narrow(a.opt.at(L"state-dir"));
  Probation fresh;
  fresh.version = narrow(a.opt.at(L"version"));
  fresh.previousPath = narrow(previous);
  fresh.appPath = narrow(app);
  saveProbation(dir + "/probation.json", fresh);
  if (!a.relaunch) return 0;
  HANDLE child = launch(a.commandLine);
  if (!child) return rollback(a, previous);
  for (int i = 0; i < 360; ++i) {  // 90 s de période d'essai surveillée
    if (WaitForSingleObject(child, 250) == WAIT_OBJECT_0) {
      CloseHandle(child);
      return rollback(a, previous);
    }
    if (auto p = loadProbation(dir + "/probation.json"); p && p->healthy) break;
  }
  CloseHandle(child);
  return 0;
}

}  // namespace

int wmain() {
  const Args a = parse();
  if ((a.mode != L"apply" && a.mode != L"rollback") || !a.opt.count(L"pid") || !a.opt.count(L"app")) return 64;
  HANDLE app = OpenProcess(SYNCHRONIZE, FALSE, DWORD(_wtoi(a.opt.at(L"pid").c_str())));
  if (app) {
    const DWORD w = WaitForSingleObject(app, 120 * 1000);
    CloseHandle(app);
    if (w != WAIT_OBJECT_0) return 2;
  }
  if (a.mode == L"rollback") return rollback(a, a.opt.at(L"previous"));
  return apply(a);
}
