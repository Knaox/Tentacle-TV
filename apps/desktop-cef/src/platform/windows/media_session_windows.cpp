// « À l'écoute » sous Windows : les SystemMediaTransportControls (SMTC) de la fenêtre
// principale — touches média du clavier, incrustation de volume, carte « lecture en cours »
// de Windows 10/11 — par l'ABI WinRT (choix d'API : en tête de media_session_windows.h).
//
// Fils :
// - toutes les méthodes viennent du fil principal (fenêtre SDL3) ; l'appartement y est STA,
//   celui d'une fenêtre — un MTA imposé ici casserait l'OLE de CEF (glisser-déposer) ;
// - SMTC appelle ses évènements sur un fil de travail : nos délégués, agiles, n'y font que
//   `host.onCommand` (la colle repasse sur le fil principal), à travers `CommandSink`.
//
// Une session = `activate()` … `deactivate()` : hors d'elle, SMTC est éteint (IsEnabled
// false), sans abonnement, et les touches reviennent au système (Spotify, navigateur…).

#include "platform/windows/media_session_windows.h"

#include <systemmediatransportcontrolsinterop.h>

#include <SDL3/SDL.h>

#include <algorithm>
#include <chrono>
#include <cstdio>
#include <functional>
#include <memory>
#include <optional>

namespace tentacle::media_session {
namespace {

using namespace win;

using ButtonHandler = wf::ITypedEventHandler<wm::SystemMediaTransportControls*,
                                             wm::SystemMediaTransportControlsButtonPressedEventArgs*>;
using SeekHandler =
    wf::ITypedEventHandler<wm::SystemMediaTransportControls*, wm::PlaybackPositionChangeRequestedEventArgs*>;

void logFailure(const char* what, HRESULT hr) {
  std::fprintf(stderr, "[smtc] %s : 0x%08lx\n", what, static_cast<unsigned long>(hr));
}

// L'appartement COM du fil principal : STA s'il n'en a pas encore ; un MTA déjà posé
// (RPC_E_CHANGED_MODE) se garde tel quel. Rendu à la destruction s'il a été pris ici.
class Apartment {
 public:
  Apartment() = default;
  Apartment(const Apartment&) = delete;
  Apartment& operator=(const Apartment&) = delete;
  ~Apartment() {
    if (owned_) RoUninitialize();
  }
  bool enter() {
    const HRESULT hr = RoInitialize(RO_INIT_SINGLETHREADED);
    if (SUCCEEDED(hr)) {  // S_OK, ou S_FALSE (déjà STA, par CEF ou SDL) : à rendre aussi
      owned_ = true;
      return true;
    }
    if (hr == RPC_E_CHANGED_MODE) return true;
    logFailure("RoInitialize", hr);
    return false;
  }

 private:
  bool owned_ = false;
};

// Ce que les fils de SMTC partagent avec nous : la commande vers la colle, et si la session
// vaut encore (un évènement en vol pendant `deactivate` ne part pas).
struct CommandSink {
  std::function<void(CommandEvent)> onCommand;
  std::atomic<bool> live{false};
  void send(const CommandEvent& event) const {
    if (live.load(std::memory_order_acquire) && onCommand) onCommand(event);
  }
};

std::optional<Command> commandOf(wm::SystemMediaTransportControlsButton button) {
  // Pas de « bascule » dans SMTC : la touche lecture/pause arrive en Play ou en Pause selon
  // le `PlaybackStatus` que nous avons donné.
  switch (button) {
    case wm::SystemMediaTransportControlsButton_Play: return Command::Play;
    case wm::SystemMediaTransportControlsButton_Pause: return Command::Pause;
    case wm::SystemMediaTransportControlsButton_Stop: return Command::Stop;
    case wm::SystemMediaTransportControlsButton_Next: return Command::Next;
    case wm::SystemMediaTransportControlsButton_Previous: return Command::Previous;
    default: return std::nullopt;  // avance/retour rapides, chaînes, enregistrement : jamais activés
  }
}

wm::MediaPlaybackStatus statusOf(Status status) {
  switch (status) {
    case Status::Playing: return wm::MediaPlaybackStatus_Playing;
    case Status::Paused: return wm::MediaPlaybackStatus_Paused;
    case Status::Stopped: break;
  }
  return wm::MediaPlaybackStatus_Stopped;
}

class SmtcBackend final : public Backend {
 public:
  explicit SmtcBackend(std::function<void(CommandEvent)> onCommand) : sink_(std::make_shared<CommandSink>()) {
    sink_->onCommand = std::move(onCommand);
  }
  // Les interfaces COM (membres déclarés APRÈS `apartment_`) partent avant l'appartement.
  ~SmtcBackend() override { deactivate(); }

  bool open(HWND window) {
    if (!apartment_.enter()) return false;
    ComPtr<ISystemMediaTransportControlsInterop> interop;
    HRESULT hr = activationFactory(L"Windows.Media.SystemMediaTransportControls", interop);
    if (SUCCEEDED(hr))
      hr = interop->GetForWindow(window, __uuidof(wm::ISystemMediaTransportControls),
                                 reinterpret_cast<void**>(smtc_.ReleaseAndGetAddressOf()));
    if (SUCCEEDED(hr)) hr = smtc_->get_DisplayUpdater(&updater_);
    if (FAILED(hr) || !smtc_ || !updater_) {
      logFailure("SMTC indisponible", hr);
      return false;
    }
    // Barre de temps et saut (Windows 10 1607 et plus) ; sans elle, titre et touches seulement.
    smtc_.As(&timeline_);
    smtc_->put_IsEnabled(FALSE);  // rien à montrer tant qu'une source ne l'a pas demandé
    return true;
  }

  void activate() override {
    if (active_) return;
    active_ = true;
    sink_->live.store(true, std::memory_order_release);
    smtc_->put_IsPlayEnabled(TRUE);
    smtc_->put_IsPauseEnabled(TRUE);
    smtc_->put_IsStopEnabled(TRUE);
    smtc_->put_IsNextEnabled(controls_.next ? TRUE : FALSE);
    smtc_->put_IsPreviousEnabled(controls_.previous ? TRUE : FALSE);
    subscribe();
    smtc_->put_IsEnabled(TRUE);
  }

  void deactivate() override {
    if (!active_) return;
    active_ = false;
    sink_->live.store(false, std::memory_order_release);
    unsubscribe();
    updater_->ClearAll();
    updater_->Update();
    smtc_->put_PlaybackStatus(wm::MediaPlaybackStatus_Closed);
    smtc_->put_IsEnabled(FALSE);  // les touches reviennent au système
    hasPlayback_ = false;
    thumbnailFor_.reset();
    thumbnail_.Reset();
  }

  void setNowPlaying(const NowPlaying& now, std::shared_ptr<const Artwork> artwork) override {
    // Une pochette n'est convertie qu'une fois (le cœur rappelle avec le même pointeur).
    if (artwork != thumbnailFor_) {
      thumbnailFor_ = artwork;
      thumbnail_ = artwork ? thumbnailFromBytes(artwork->bytes) : nullptr;
      if (artwork && !thumbnail_) std::fprintf(stderr, "[smtc] vignette refusée (%zu octets)\n", artwork->bytes.size());
    }
    const HRESULT hr = applyNowPlaying(updater_.Get(), now, thumbnail_.Get());
    if (FAILED(hr)) logFailure("DisplayUpdater.Update", hr);
  }

  void setPlayback(const Playback& playback) override {
    playback_ = playback;
    playbackAt_ = std::chrono::steady_clock::now();
    hasPlayback_ = true;
    smtc_->put_PlaybackStatus(statusOf(playback.status));
    if (!timeline_) return;
    if (playback.rate > 0) timeline_->put_PlaybackRate(playback.rate);
    pushTimeline(playback.positionMs);
  }

  void setControls(const Controls& controls) override {
    const bool seekChanged = controls.seek != controls_.seek;
    controls_ = controls;
    smtc_->put_IsNextEnabled(controls.next ? TRUE : FALSE);
    smtc_->put_IsPreviousEnabled(controls.previous ? TRUE : FALSE);
    // Le saut se dit dans la ligne de temps : elle repart, à la position d'à présent.
    if (seekChanged && hasPlayback_ && timeline_) pushTimeline(currentPositionMs());
  }

  void setAudioSessionName(const std::string& name) override { renameProcessAudioSessions(widen(name)); }

  std::string debugState() const override { return debugJson(smtc_.Get(), active_); }

 private:
  void subscribe() {
    std::shared_ptr<CommandSink> sink = sink_;
    auto onButton = makeDelegate<ButtonHandler>(
        [sink](wm::ISystemMediaTransportControls*, wm::ISystemMediaTransportControlsButtonPressedEventArgs* args) {
          wm::SystemMediaTransportControlsButton button{};
          if (!args || FAILED(args->get_Button(&button))) return S_OK;
          if (const std::optional<Command> command = commandOf(button)) sink->send(CommandEvent{*command, 0});
          return S_OK;
        });
    HRESULT hr = smtc_->add_ButtonPressed(onButton.Get(), &buttonToken_);
    buttonSubscribed_ = SUCCEEDED(hr);
    if (FAILED(hr)) logFailure("add_ButtonPressed", hr);
    if (!timeline_) return;
    auto onSeek = makeDelegate<SeekHandler>(
        [sink](wm::ISystemMediaTransportControls*, wm::IPlaybackPositionChangeRequestedEventArgs* args) {
          wf::TimeSpan target{};
          if (!args || FAILED(args->get_RequestedPlaybackPosition(&target))) return S_OK;
          sink->send(CommandEvent{Command::Seek, toMs(target)});  // position ABSOLUE
          return S_OK;
        });
    hr = timeline_->add_PlaybackPositionChangeRequested(onSeek.Get(), &seekToken_);
    seekSubscribed_ = SUCCEEDED(hr);
    if (FAILED(hr)) logFailure("add_PlaybackPositionChangeRequested", hr);
  }

  void unsubscribe() {
    if (buttonSubscribed_) smtc_->remove_ButtonPressed(buttonToken_);
    if (seekSubscribed_ && timeline_) timeline_->remove_PlaybackPositionChangeRequested(seekToken_);
    buttonSubscribed_ = seekSubscribed_ = false;
  }

  // Où en est la lecture, d'après le dernier état reçu (pour une ligne de temps reposée hors
  // d'un `setPlayback`).
  double currentPositionMs() const {
    if (playback_.status != Status::Playing) return playback_.positionMs;
    const double elapsed = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - playbackAt_).count();
    return playback_.positionMs + elapsed * playback_.rate;
  }

  // Début 0, fin = durée, position, et la plage de saut si la source l'accepte. Sans durée
  // (flux en direct) : une ligne vide plutôt qu'une barre fausse.
  void pushTimeline(double positionMs) {
    ComPtr<wm::ISystemMediaTransportControlsTimelineProperties> props;
    const HRESULT hr = activateInstance(L"Windows.Media.SystemMediaTransportControlsTimelineProperties", props);
    if (FAILED(hr)) return logFailure("TimelineProperties", hr);
    const double end = playback_.durationMs && *playback_.durationMs > 0 ? *playback_.durationMs : 0;
    props->put_StartTime(toTimeSpan(0));
    props->put_EndTime(toTimeSpan(end));
    props->put_Position(toTimeSpan(std::clamp(positionMs, 0.0, end)));
    props->put_MinSeekTime(toTimeSpan(0));
    props->put_MaxSeekTime(toTimeSpan(controls_.seek ? end : 0));
    timeline_->UpdateTimelineProperties(props.Get());
  }

  Apartment apartment_;  // PREMIER membre : détruit en dernier
  std::shared_ptr<CommandSink> sink_;
  ComPtr<wm::ISystemMediaTransportControls> smtc_;
  ComPtr<wm::ISystemMediaTransportControls2> timeline_;
  ComPtr<wm::ISystemMediaTransportControlsDisplayUpdater> updater_;
  EventRegistrationToken buttonToken_{};
  EventRegistrationToken seekToken_{};
  bool buttonSubscribed_ = false;
  bool seekSubscribed_ = false;
  bool active_ = false;
  Controls controls_;
  Playback playback_;
  std::chrono::steady_clock::time_point playbackAt_{};
  bool hasPlayback_ = false;
  std::shared_ptr<const Artwork> thumbnailFor_;
  ComPtr<wss::IRandomAccessStreamReference> thumbnail_;
};

}  // namespace

std::unique_ptr<Backend> createBackend(const BackendHost& host) {
  auto* window = static_cast<SDL_Window*>(host.sdlWindow);
  if (!window) return nullptr;
  auto* hwnd = static_cast<HWND>(
      SDL_GetPointerProperty(SDL_GetWindowProperties(window), SDL_PROP_WINDOW_WIN32_HWND_POINTER, nullptr));
  if (!hwnd) return nullptr;
  auto backend = std::make_unique<SmtcBackend>(host.onCommand);
  if (!backend->open(hwnd)) return nullptr;
  return backend;
}

}  // namespace tentacle::media_session
