// Couture Windows de « À l'écoute » : ce que montre la carte « lecture en cours » (titre,
// artiste, album ou sous-titre, vignette) et les petits outils de chaînes et de durées.
//
// La vignette part des OCTETS que le cœur a téléchargés, jamais de son adresse : elle porte un
// jeton, et `RandomAccessStreamReference::CreateFromUri` la confierait à l'OS.

#include "platform/windows/media_session_windows.h"

#include <climits>
#include <cmath>
#include <memory>

namespace tentacle::media_session::win {
namespace {

// L'écriture d'un flux EN MÉMOIRE s'achève sur le pool de threads (rien ne revient par le
// fil principal), le plus souvent avant même le retour de `StoreAsync` : l'attente bornée
// sans pompe de messages ne bloque rien. Au-delà, la vignette est abandonnée, le titre reste.
constexpr DWORD kStoreTimeoutMs = 500;

bool waitStored(wf::IAsyncOperation<UINT32>* operation) {
  struct Done {
    HANDLE event = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    std::atomic<bool> completed{false};
    ~Done() {
      if (event) CloseHandle(event);
    }
  };
  // Partagé avec le délégué : une fin tardive (après l'abandon) écrit encore dans un objet vivant.
  auto done = std::make_shared<Done>();
  if (!done->event) return false;
  auto handler = makeDelegate<wf::IAsyncOperationCompletedHandler<UINT32>>([done](auto*, auto status) -> HRESULT {
    // `AsyncStatus::Completed` vaut 1 dans les deux SDK (énumération propre à chacun).
    done->completed.store(static_cast<int>(status) == 1, std::memory_order_release);
    SetEvent(done->event);
    return S_OK;
  });
  if (FAILED(operation->put_Completed(handler.Get()))) return false;
  return WaitForSingleObject(done->event, kStoreTimeoutMs) == WAIT_OBJECT_0 &&
         done->completed.load(std::memory_order_acquire);
}

}  // namespace

std::wstring widen(const std::string& utf8) {
  if (utf8.empty() || utf8.size() > static_cast<size_t>(INT_MAX)) return {};
  const int size = static_cast<int>(utf8.size());
  const int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, utf8.data(), size, nullptr, 0);
  if (length <= 0) return {};
  std::wstring out(static_cast<size_t>(length), L'\0');
  MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, utf8.data(), size, out.data(), length);
  return out;
}

HString::HString(const std::wstring& text) {
  if (text.empty()) return;
  if (FAILED(WindowsCreateString(text.c_str(), static_cast<UINT32>(text.size()), &value_))) value_ = nullptr;
}

HString::~HString() {
  if (value_) WindowsDeleteString(value_);
}

wf::TimeSpan toTimeSpan(double ms) {
  wf::TimeSpan span{};
  span.Duration = std::isfinite(ms) && ms > 0 ? static_cast<INT64>(std::llround(ms * 10000.0)) : 0;
  return span;
}

double toMs(const wf::TimeSpan& span) { return static_cast<double>(span.Duration) / 10000.0; }

ComPtr<wss::IRandomAccessStreamReference> thumbnailFromBytes(const std::vector<uint8_t>& bytes) {
  if (bytes.empty() || bytes.size() > UINT32_MAX) return nullptr;
  // InMemoryRandomAccessStream + DataWriter : le flux que la carte de Windows sait relire
  // (CloneStream) — un flux enveloppant un IStream ne l'est pas toujours.
  ComPtr<wss::IRandomAccessStream> stream;
  ComPtr<wss::IOutputStream> output;
  if (FAILED(activateInstance(L"Windows.Storage.Streams.InMemoryRandomAccessStream", stream)) ||
      FAILED(stream.As(&output)))
    return nullptr;
  ComPtr<wss::IDataWriterFactory> writers;
  ComPtr<wss::IDataWriter> writer;
  if (FAILED(activationFactory(L"Windows.Storage.Streams.DataWriter", writers)) ||
      FAILED(writers->CreateDataWriter(output.Get(), &writer)))
    return nullptr;
  // WriteBytes copie : l'ABI ne promet pas `const`, le tampon n'est pas modifié.
  if (FAILED(writer->WriteBytes(static_cast<UINT32>(bytes.size()), const_cast<BYTE*>(bytes.data())))) return nullptr;
  ComPtr<wf::IAsyncOperation<UINT32>> store;
  const bool stored = SUCCEEDED(writer->StoreAsync(&store)) && waitStored(store.Get());
  // Détaché, l'écrivain libéré ne ferme pas le flux.
  ComPtr<wss::IOutputStream> detached;
  writer->DetachStream(&detached);
  if (!stored || FAILED(stream->Seek(0))) return nullptr;
  ComPtr<wss::IRandomAccessStreamReferenceStatics> references;
  ComPtr<wss::IRandomAccessStreamReference> reference;
  if (FAILED(activationFactory(L"Windows.Storage.Streams.RandomAccessStreamReference", references)) ||
      FAILED(references->CreateFromStream(stream.Get(), &reference)))
    return nullptr;
  return reference;
}

HRESULT applyNowPlaying(wm::ISystemMediaTransportControlsDisplayUpdater* updater, const NowPlaying& now,
                        wss::IRandomAccessStreamReference* thumbnail) {
  // Tout repart de zéro : une vidéo après un morceau ne garde ni album ni artiste.
  updater->ClearAll();
  if (now.kind == Kind::Music) {
    updater->put_Type(wm::MediaPlaybackType_Music);
    ComPtr<wm::IMusicDisplayProperties> music;
    if (SUCCEEDED(updater->get_MusicProperties(&music)) && music) {
      music->put_Title(HString(widen(now.title)).get());
      music->put_Artist(HString(widen(now.artist)).get());
      ComPtr<wm::IMusicDisplayProperties2> album;  // Windows 10 et plus
      if (!now.album.empty() && SUCCEEDED(music.As(&album))) album->put_AlbumTitle(HString(widen(now.album)).get());
    }
  } else {
    updater->put_Type(wm::MediaPlaybackType_Video);
    ComPtr<wm::IVideoDisplayProperties> video;
    if (SUCCEEDED(updater->get_VideoProperties(&video)) && video) {
      video->put_Title(HString(widen(now.title)).get());
      video->put_Subtitle(HString(widen(now.artist)).get());  // la série, « S01E02 »
    }
  }
  if (thumbnail) updater->put_Thumbnail(thumbnail);
  return updater->Update();
}

}  // namespace tentacle::media_session::win
