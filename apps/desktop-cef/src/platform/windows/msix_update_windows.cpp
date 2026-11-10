// Mise à jour du paquet MSIX par le Microsoft Store — portage de `msixUpdate.ts` d'Electron
// (lui-même portage de l'app Tauri). WinRT est atteint par son ABI brute, comme Electron par
// koffi : fabrique d'activation, puis appels par rang de vtable — les MÊMES rangs, relevés
// dans les en-têtes du SDK par Electron (msixUpdate.ts), sans dépendre de
// windows.services.store.h (absent de mingw-w64) ni de C++/WinRT.
//
// ⚠️ Deux familles de vtables (msixUpdate.ts) : une interface WinRT dérive d'IInspectable,
// ses méthodes commencent au rang 6 ; IInitializeWithWindow dérive d'IUnknown : rang 3.
//
// Ne fonctionne que dans un paquet INSTALLÉ (identité de paquet) : en développement,
// StoreContext échoue proprement et la recherche répond « aucune mise à jour ».
// Appelé hors du fil principal (fil de travail, appartement MTA) : les attentes durent.

#include <windows.h>
#include <roapi.h>
#include <winstring.h>

#include <chrono>
#include <iterator>
#include <thread>

#include "display/msix_rule.h"
#include "platform/windows/msix_update_windows.h"

namespace tentacle::win::msix {
namespace {

// IID des interfaces, écrits dans les en-têtes du SDK (winrt/guid.ts d'Electron).
constexpr GUID kStoreContextStatics = {0x9C06EE5F, 0x15C0, 0x4E72, {0x93, 0x30, 0xD6, 0x19, 0x1C, 0xEB, 0xD1, 0x9C}};
constexpr GUID kAsyncInfo = {0x00000036, 0x0000, 0x0000, {0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46}};
constexpr GUID kInitializeWithWindow = {0x3E68D4BD, 0x7135, 0x4D10, {0x80, 0x18, 0x9F, 0xB6, 0xD9, 0xF3, 0x3F, 0xA1}};
// IIterable<StorePackageUpdate> : CALCULÉ (UUID v5 de la signature paramétrée), vérifié par le
// test de winrt/guid.test.ts d'Electron, et à l'exécution par QueryInterface.
constexpr GUID kIterableStorePackageUpdate = {0x6B076C51, 0x849E, 0x5EC5, {0xAE, 0xD5, 0x9B, 0x05, 0x85, 0x59, 0x19, 0x02}};

constexpr int kSlotGetDefault = 6;          // IStoreContextStatics::GetDefault
constexpr int kSlotGetUpdates = 23;         // IStoreContext::GetAppAndOptionalStorePackageUpdatesAsync
constexpr int kSlotInstallUpdates = 25;     // IStoreContext::RequestDownloadAndInstallStorePackageUpdatesAsync
constexpr int kSlotMandatory = 7;           // IStorePackageUpdate::get_Mandatory
constexpr int kSlotOverallState = 6;        // IStorePackageUpdateResult::get_OverallState
constexpr int kSlotVectorGetAt = 6;         // IVectorView<T>::GetAt
constexpr int kSlotVectorSize = 7;          // IVectorView<T>::get_Size
constexpr int kSlotInitialize = 3;          // IInitializeWithWindow::Initialize (dérive d'IUnknown)
constexpr int kSlotAsyncStatus = 7;         // IAsyncInfo::get_Status
constexpr int kSlotResults = 8;             // IAsyncOperation<T>::GetResults
constexpr int kSlotResultsWithProgress = 10;  // IAsyncOperationWithProgress<T, P>::GetResults

constexpr auto kSearchDelay = std::chrono::seconds(30);
constexpr auto kInstallDelay = std::chrono::minutes(30);

// Appel par rang de vtable (ABI x64 : une seule convention d'appel).
template <class... Args>
HRESULT call(void* self, int slot, Args... args) {
  using Fn = HRESULT(STDMETHODCALLTYPE*)(void*, Args...);
  return reinterpret_cast<Fn>((*static_cast<void***>(self))[slot])(self, args...);
}

struct Unknown {  // IUnknown* possédé : Release à la destruction
  IUnknown* p = nullptr;
  Unknown() = default;
  explicit Unknown(void* raw) : p(static_cast<IUnknown*>(raw)) {}
  Unknown(const Unknown&) = delete;
  Unknown& operator=(const Unknown&) = delete;
  Unknown(Unknown&& o) noexcept : p(o.p) { o.p = nullptr; }
  ~Unknown() {
    if (p) p->Release();
  }
  explicit operator bool() const { return p != nullptr; }
  Unknown query(const GUID& iid) const {
    void* out = nullptr;
    if (p && SUCCEEDED(p->QueryInterface(iid, &out))) return Unknown(out);
    return {};
  }
  Unknown pointerAt(int slot) const {
    void* out = nullptr;
    if (p && SUCCEEDED(call(p, slot, &out))) return Unknown(out);
    return {};
  }
};

Unknown storeContext() {
  static constexpr wchar_t kClass[] = L"Windows.Services.Store.StoreContext";
  HSTRING name = nullptr;
  if (FAILED(WindowsCreateString(kClass, UINT32(std::size(kClass) - 1), &name))) return {};
  void* factory = nullptr;
  const HRESULT hr = RoGetActivationFactory(name, kStoreContextStatics, &factory);
  WindowsDeleteString(name);
  if (FAILED(hr)) return {};
  return Unknown(factory).pointerAt(kSlotGetDefault);
}

// Attend la fin d'une opération asynchrone (sondage toutes les 100 ms, comme Electron) et en
// rend le résultat, ou rien (échec, annulation, délai dépassé).
Unknown awaitOperation(const Unknown& operation, int resultSlot, std::chrono::steady_clock::duration limit) {
  Unknown info = operation.query(kAsyncInfo);
  if (!info) return {};
  const auto deadline = std::chrono::steady_clock::now() + limit;
  for (;;) {
    INT32 status = 0;  // Started 0, Completed 1, Canceled 2, Error 3
    if (FAILED(call(info.p, kSlotAsyncStatus, &status))) return {};
    if (status != 0) return status == 1 ? operation.pointerAt(resultSlot) : Unknown{};
    if (std::chrono::steady_clock::now() > deadline) return {};
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
  }
}

Unknown pendingUpdates(const Unknown& context) {
  Unknown op = context.pointerAt(kSlotGetUpdates);
  return op ? awaitOperation(op, kSlotResults, kSearchDelay) : Unknown{};
}

struct Apartment {  // MTA du fil de travail
  Apartment() { RoInitialize(RO_INIT_MULTITHREADED); }
  ~Apartment() { RoUninitialize(); }
};

}  // namespace

std::optional<UpdateInfo> check() {
  Apartment apartment;
  Unknown context = storeContext();
  if (!context) return std::nullopt;  // hors paquet installé : rien, sans erreur
  Unknown updates = pendingUpdates(context);
  if (!updates) return std::nullopt;
  UINT32 size = 0;
  if (FAILED(call(updates.p, kSlotVectorSize, &size)) || size == 0) return std::nullopt;
  void* raw = nullptr;
  if (FAILED(call(updates.p, kSlotVectorGetAt, UINT32(0), &raw))) return UpdateInfo{false};
  Unknown first(raw);
  unsigned char mandatory = 0;  // boolean de l'ABI WinRT : un octet
  call(first.p, kSlotMandatory, &mandatory);
  return UpdateInfo{mandatory != 0};
}

std::string downloadAndInstall(HWND owner) {
  Apartment apartment;
  Unknown context = storeContext();
  if (!context) return "store-unavailable";
  // Sans fenêtre propriétaire, la boîte du Store rend aussitôt OtherError.
  if (Unknown init = context.query(kInitializeWithWindow)) call(init.p, kSlotInitialize, owner);
  Unknown updates = pendingUpdates(context);
  if (!updates) return "no-update";
  Unknown iterable = updates.query(kIterableStorePackageUpdate);
  if (!iterable) return "iterable-unavailable";
  void* raw = nullptr;
  if (FAILED(call(context.p, kSlotInstallUpdates, static_cast<void*>(iterable.p), &raw)) || !raw)
    return "install-refused";
  Unknown operation(raw);
  Unknown result = awaitOperation(operation, kSlotResultsWithProgress, kInstallDelay);
  if (!result) return "install-failed";
  INT32 state = 0;
  // GetResults peut réussir alors que l'installation a échoué (refus, réseau, batterie).
  const std::optional<int> read = SUCCEEDED(call(result.p, kSlotOverallState, &state)) ? std::optional<int>(state)
                                                                                         : std::nullopt;
  return display::msixInstallError(read).value_or("");
}

}  // namespace tentacle::win::msix
