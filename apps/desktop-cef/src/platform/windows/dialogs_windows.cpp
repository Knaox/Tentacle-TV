// Boîtes natives Windows, portées d'Electron 43 (shell/browser/ui/message_box_win.cc,
// file_dialog_win.cc) :
//   - boîte de message : TaskDialogIndirect, titre = nom de l'app, message en contenu, boutons
//     « OK »/« Cancel » rendus par les boutons COMMUNS de Windows (donc traduits par Windows),
//     Échap permis ; possédée par la fenêtre de l'app ;
//   - fichiers : IFileOpenDialog / IFileSaveDialog, options et filtres d'Electron
//     (`ApplySettings`, `ConvertFilters`, extension par défaut = premier filtre sans joker).
// Comme Electron, chaque boîte tourne sur SON fil (COM STA) : la boucle de l'app continue, la
// fenêtre parente est désactivée par la boîte. La fin revient au fil principal (postToMain).
// ⚠️ TaskDialogIndirect n'existe que dans les Common Controls 6 : sans eux dans le manifeste de
// l'exécutable (axe windows), repli sur MessageBoxW, cherché à l'exécution.

#include <SDL3/SDL.h>
#include <windows.h>
#include <commctrl.h>
#include <shobjidl.h>

#include <atomic>
#include <cwctype>
#include <filesystem>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <thread>
#include <vector>

#include "shell/main_thread.h"
#include "shell/native_dialogs.h"

namespace tentacle::platform {
namespace {

constexpr int kIdStart = 100;            // boutons personnalisés (Electron : kIDStart)
constexpr wchar_t kAppName[] = L"Tentacle TV";  // `productName` d'Electron (app.getName())

std::wstring wide(const std::string& s) {
  if (s.empty()) return {};
  const int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), int(s.size()), nullptr, 0);
  std::wstring out(size_t(n), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), int(s.size()), out.data(), n);
  return out;
}

std::string narrow(const wchar_t* s) {
  if (!s || !*s) return {};
  const int n = WideCharToMultiByte(CP_UTF8, 0, s, -1, nullptr, 0, nullptr, nullptr);
  std::string out(size_t(n > 0 ? n - 1 : 0), '\0');
  WideCharToMultiByte(CP_UTF8, 0, s, -1, out.data(), n, nullptr, nullptr);
  return out;
}

HWND hwndOf(SDL_Window* w) {
  return static_cast<HWND>(SDL_GetPointerProperty(SDL_GetWindowProperties(w),
                                                  SDL_PROP_WINDOW_WIN32_HWND_POINTER, nullptr));
}

// L'état partagé entre la boîte (son fil) et l'app : de quoi la fermer, et ne plus répondre.
struct Shared {
  std::atomic<DWORD> thread{0};
  std::atomic<bool> dismissed{false};
};

void closeThreadWindows(DWORD thread) {
  EnumThreadWindows(
      thread, [](HWND h, LPARAM) -> BOOL { PostMessageW(h, WM_CLOSE, 0, 0); return TRUE; }, 0);
}

class WinDialog final : public NativeDialog {
 public:
  explicit WinDialog(std::shared_ptr<Shared> s) : s_(std::move(s)) {}
  void dismiss() override {
    if (s_->dismissed.exchange(true)) return;
    if (const DWORD t = s_->thread.load()) closeThreadWindows(t);
  }

 private:
  std::shared_ptr<Shared> s_;
};

using TaskDialogIndirectFn = HRESULT(WINAPI*)(const TASKDIALOGCONFIG*, int*, int*, BOOL*);

TaskDialogIndirectFn taskDialogIndirect() {
  HMODULE m = GetModuleHandleW(L"comctl32.dll");
  if (!m) m = LoadLibraryW(L"comctl32.dll");
  // Par void* : FARPROC n'a pas la signature de la fonction (GCC le signale à raison).
  return m ? reinterpret_cast<TaskDialogIndirectFn>(
                 reinterpret_cast<void*>(GetProcAddress(m, "TaskDialogIndirect")))
           : nullptr;
}

HRESULT CALLBACK taskCallback(HWND hwnd, UINT msg, WPARAM, LPARAM, LONG_PTR data) {
  // Fermée avant d'apparaître (banc, navigation) : elle part aussitôt née.
  if (msg == TDN_CREATED && reinterpret_cast<Shared*>(data)->dismissed.load()) {
    PostMessageW(hwnd, WM_CLOSE, 0, 0);
  }
  return S_OK;
}

// `ShowTaskDialogWstr` d'Electron, type kNone (sans icône), sans détail ni case à cocher.
int runTaskDialog(HWND parent, const dialogs::MessageBox& b, Shared* shared) {
  const std::wstring message = wide(b.message);
  auto indirect = taskDialogIndirect();
  if (!indirect) {
    const int r = MessageBoxW(parent, message.c_str(), kAppName,
                              b.buttons.size() > 1 ? MB_OKCANCEL : MB_OK);
    return r == IDOK ? 0 : b.cancelId;
  }
  TASKDIALOGCONFIG c{};
  c.cbSize = sizeof(c);
  c.hInstance = GetModuleHandleW(nullptr);
  c.dwFlags = TDF_SIZE_TO_CONTENT | TDF_ALLOW_DIALOG_CANCELLATION;
  if (parent) {
    c.hwndParent = parent;
    c.dwFlags |= TDF_POSITION_RELATIVE_TO_WINDOW;
  }
  if (b.defaultId > 0) c.nDefaultButton = kIdStart + b.defaultId;
  c.pszWindowTitle = kAppName;
  c.pszContent = message.c_str();
  c.pfCallback = taskCallback;
  c.lpCallbackData = reinterpret_cast<LONG_PTR>(shared);

  // `MapToCommonID` : les boutons connus deviennent les boutons communs de Windows.
  static const std::map<std::wstring, std::pair<int, TASKDIALOG_COMMON_BUTTON_FLAGS>> common = {
      {L"ok", {IDOK, TDCBF_OK_BUTTON}},       {L"yes", {IDYES, TDCBF_YES_BUTTON}},
      {L"no", {IDNO, TDCBF_NO_BUTTON}},       {L"cancel", {IDCANCEL, TDCBF_CANCEL_BUTTON}},
      {L"retry", {IDRETRY, TDCBF_RETRY_BUTTON}}, {L"close", {IDCLOSE, TDCBF_CLOSE_BUTTON}}};
  std::map<int, int> idMap;
  std::vector<std::wstring> labels;
  labels.reserve(b.buttons.size());  // les pointeurs de TASKDIALOG_BUTTON y restent valides
  std::vector<TASKDIALOG_BUTTON> custom;
  for (size_t i = 0; i < b.buttons.size(); ++i) {
    labels.push_back(wide(b.buttons[i]));
    std::wstring lower = labels.back();
    for (auto& ch : lower) ch = wchar_t(towlower(ch));
    if (auto it = common.find(lower); it != common.end()) {
      idMap[it->second.first] = int(i);
      c.dwCommonButtons |= it->second.second;
    } else {
      custom.push_back({int(i) + kIdStart, labels.back().c_str()});
    }
  }
  if (!custom.empty()) {
    c.pButtons = custom.data();
    c.cButtons = UINT(custom.size());
    c.dwFlags |= TDF_USE_COMMAND_LINKS;
  }
  int id = 0;
  if (FAILED(indirect(&c, &id, nullptr, nullptr))) return b.cancelId;
  if (auto it = idMap.find(id); it != idMap.end()) return it->second;
  if (id >= kIdStart) return id - kIdStart;
  return b.cancelId;
}

// `ApplySettings` d'Electron.
void applySettings(IFileDialog* d, const dialogs::FileRequest& r,
                   std::vector<std::wstring>& buffer, std::vector<COMDLG_FILTERSPEC>& specs) {
  namespace fs = std::filesystem;
  std::error_code ec;
  const fs::path def(wide(r.defaultPath));
  const bool isDir = !r.defaultPath.empty() && fs::is_directory(def, ec);
  d->SetFileName(isDir ? L"" : def.filename().c_str());
  if (!r.title.empty()) d->SetTitle(wide(r.title).c_str());
  // `ConvertFilters` : sans filtre, « All Files (*.*) » ; sinon « *.ext;*.ext2 » par filtre.
  buffer.reserve(r.filters.size() * 2 + 2);
  if (r.filters.empty()) {
    specs.push_back({L"All Files (*.*)", L"*.*"});
  } else {
    for (const auto& f : r.filters) {
      buffer.push_back(wide(f.name));
      const wchar_t* name = buffer.back().c_str();
      std::wstring spec;
      for (const auto& ext : f.extensions) {
        if (!spec.empty()) spec += L";";
        spec += L"*." + wide(ext);
      }
      buffer.push_back(spec);
      specs.push_back({name, buffer.back().c_str()});
    }
  }
  d->SetFileTypes(UINT(specs.size()), specs.data());
  for (size_t i = 0; i < specs.size(); ++i) {
    if (std::wstring(specs[i].pszSpec) != L"*.*") {
      d->SetFileTypeIndex(UINT(i + 1));
      d->SetDefaultExtension(specs[i].pszSpec);
      break;
    }
  }
  if (def.is_absolute()) {
    IShellItem* folder = nullptr;
    const fs::path dir = isDir ? def : def.parent_path();
    if (SUCCEEDED(SHCreateItemFromParsingName(dir.c_str(), nullptr, IID_PPV_ARGS(&folder)))) {
      d->SetFolder(folder);
      folder->Release();
    }
  }
}

std::optional<std::vector<std::string>> runFileDialog(HWND parent, const dialogs::FileRequest& r) {
  const bool save = r.mode == dialogs::FileMode::save;
  IFileDialog* d = nullptr;
  if (FAILED(CoCreateInstance(save ? CLSID_FileSaveDialog : CLSID_FileOpenDialog, nullptr,
                              CLSCTX_INPROC_SERVER, save ? IID_IFileSaveDialog : IID_IFileOpenDialog,
                              reinterpret_cast<void**>(&d)))) {
    return std::nullopt;
  }
  // Les options d'Electron, posées telles quelles (sans les défauts du système).
  DWORD options = 0;
  if (save) {
    options = FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST | FOS_OVERWRITEPROMPT;
  } else {
    options = FOS_FORCEFILESYSTEM | FOS_FILEMUSTEXIST;
    if (r.mode == dialogs::FileMode::openFolder) options |= FOS_PICKFOLDERS;
    if (r.mode == dialogs::FileMode::openMultiple) options |= FOS_ALLOWMULTISELECT;
  }
  d->SetOptions(options);
  std::vector<std::wstring> buffer;
  std::vector<COMDLG_FILTERSPEC> specs;
  applySettings(d, r, buffer, specs);
  std::optional<std::vector<std::string>> result;
  if (SUCCEEDED(d->Show(parent))) {
    std::vector<std::string> paths;
    auto take = [&paths](IShellItem* item) {
      PWSTR p = nullptr;
      if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &p))) {
        paths.push_back(narrow(p));
        CoTaskMemFree(p);
      }
    };
    if (save) {
      IShellItem* item = nullptr;
      if (SUCCEEDED(d->GetResult(&item))) {
        take(item);
        item->Release();
      }
    } else {
      IShellItemArray* items = nullptr;
      if (SUCCEEDED(static_cast<IFileOpenDialog*>(d)->GetResults(&items))) {
        DWORD n = 0;
        items->GetCount(&n);
        for (DWORD i = 0; i < n; ++i) {
          IShellItem* item = nullptr;
          if (SUCCEEDED(items->GetItemAt(i, &item))) {
            take(item);
            item->Release();
          }
        }
        items->Release();
      }
    }
    if (!paths.empty()) result = std::move(paths);
  }
  d->Release();
  return result;
}

}  // namespace

std::unique_ptr<NativeDialog> showMessageBox(SDL_Window* parent, const dialogs::MessageBox& box,
                                             MessageDone done) {
  auto shared = std::make_shared<Shared>();
  std::thread([hwnd = hwndOf(parent), box, shared, done] {
    shared->thread = GetCurrentThreadId();
    const int response = runTaskDialog(hwnd, box, shared.get());
    postToMain([shared, done, response] {
      if (!shared->dismissed.exchange(true)) done(response);
    });
  }).detach();
  return std::make_unique<WinDialog>(shared);
}

bool hasNativeFileDialog() { return true; }

std::unique_ptr<NativeDialog> showFileDialog(SDL_Window* parent, const dialogs::FileRequest& r,
                                             FileDone done) {
  auto shared = std::make_shared<Shared>();
  std::thread([hwnd = hwndOf(parent), r, shared, done] {
    shared->thread = GetCurrentThreadId();
    const HRESULT com = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
    auto paths = runFileDialog(hwnd, r);
    if (SUCCEEDED(com)) CoUninitialize();
    postToMain([shared, done, paths] {
      if (!shared->dismissed.exchange(true)) done(paths);
    });
  }).detach();
  return std::make_unique<WinDialog>(shared);
}

}  // namespace tentacle::platform
