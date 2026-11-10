// « À l'écoute » sous macOS : `MPNowPlayingInfoCenter` (Centre de contrôle, barre des
// menus, écran verrouillé) et `MPRemoteCommandCenter` (touches média du clavier, casque,
// AirPods, Touch Bar). Electron n'a ni l'un ni l'autre (touches par `globalShortcut`, sous
// Windows seulement) : c'est un ajout de CEF.
//
// - Tout se passe sur le fil principal : les gestionnaires de `MPRemoteCommandCenter`
//   y sont rappelés (file principale), et le cœur appelle ce backend sur le même fil.
// - `playbackState` est propre à macOS et OBLIGATOIRE : sans lui, le système ne sait pas
//   qu'on joue et garde la session d'une autre application.
// - La pochette part en `MPMediaItemArtwork` depuis les octets téléchargés par le cœur ;
//   l'adresse (authentifiée) ne quitte jamais le processus.
// - `deactivate()` retire les cibles ET vide la fiche : les touches reviennent à
//   l'application suivante (Musique, Spotify) au lieu de rester captives de Tentacle.
#import <AppKit/AppKit.h>
#import <MediaPlayer/MediaPlayer.h>

#include <cmath>
#include <string>
#include <vector>

#include "media_session/media_session.h"

namespace tentacle::media_session {
namespace {

NSString* ns(const std::string& s) { return [NSString stringWithUTF8String:s.c_str()] ?: @""; }

MPNowPlayingPlaybackState stateOf(Status s) {
  switch (s) {
    case Status::Playing: return MPNowPlayingPlaybackStatePlaying;
    case Status::Paused: return MPNowPlayingPlaybackStatePaused;
    case Status::Stopped: return MPNowPlayingPlaybackStateStopped;
  }
  return MPNowPlayingPlaybackStateUnknown;
}

class MacBackend final : public Backend {
 public:
  explicit MacBackend(BackendHost host) : host_(std::move(host)) {}
  ~MacBackend() override {
    if (active_) deactivate();
  }

  void activate() override {
    if (active_) return;
    active_ = true;
    MPRemoteCommandCenter* center = [MPRemoteCommandCenter sharedCommandCenter];
    bind(center.playCommand, Command::Play);
    bind(center.pauseCommand, Command::Pause);
    bind(center.togglePlayPauseCommand, Command::Toggle);
    bind(center.stopCommand, Command::Stop);
    bind(center.nextTrackCommand, Command::Next);
    bind(center.previousTrackCommand, Command::Previous);
    // La barre du Centre de contrôle : une position ABSOLUE.
    auto onCommand = host_.onCommand;
    MPRemoteCommand* seek = center.changePlaybackPositionCommand;
    id token = [seek addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent* e) {
      auto* change = static_cast<MPChangePlaybackPositionCommandEvent*>(e);
      if (onCommand) onCommand({Command::Seek, change.positionTime * 1000.0});
      return MPRemoteCommandHandlerStatusSuccess;
    }];
    targets_.push_back({seek, token});
    applyControls();
  }

  void deactivate() override {
    if (!active_) return;
    active_ = false;
    for (auto& [command, token] : targets_) {
      [command removeTarget:token];
      command.enabled = NO;
    }
    targets_.clear();
    info_ = nil;
    MPNowPlayingInfoCenter* info = [MPNowPlayingInfoCenter defaultCenter];
    info.nowPlayingInfo = nil;
    info.playbackState = MPNowPlayingPlaybackStateStopped;
  }

  void setNowPlaying(const NowPlaying& now, std::shared_ptr<const Artwork> artwork) override {
    NSMutableDictionary* d = info();
    d[MPMediaItemPropertyTitle] = ns(now.title);
    d[MPMediaItemPropertyArtist] = ns(now.artist);
    d[MPMediaItemPropertyAlbumTitle] = ns(now.album);
    d[MPNowPlayingInfoPropertyMediaType] =
        @(now.kind == Kind::Video ? MPNowPlayingInfoMediaTypeVideo : MPNowPlayingInfoMediaTypeAudio);
    [d removeObjectForKey:MPMediaItemPropertyArtwork];
    if (artwork && !artwork->bytes.empty()) {
      NSData* data = [NSData dataWithBytes:artwork->bytes.data() length:artwork->bytes.size()];
      NSImage* image = [[NSImage alloc] initWithData:data];
      if (image && image.size.width > 0) {
        MPMediaItemArtwork* art = [[MPMediaItemArtwork alloc] initWithBoundsSize:image.size
                                                                  requestHandler:^NSImage*(CGSize) { return image; }];
        d[MPMediaItemPropertyArtwork] = art;
      }
    }
    publish();
  }

  void setPlayback(const Playback& p) override {
    NSMutableDictionary* d = info();
    // La position vaut à `atMs`, que le cœur vient de poser : l'instant présent.
    d[MPNowPlayingInfoPropertyElapsedPlaybackTime] = @(std::max(0.0, p.positionMs) / 1000.0);
    if (p.durationMs && *p.durationMs > 0) d[MPMediaItemPropertyPlaybackDuration] = @(*p.durationMs / 1000.0);
    else [d removeObjectForKey:MPMediaItemPropertyPlaybackDuration];
    d[MPNowPlayingInfoPropertyPlaybackRate] = @(p.status == Status::Playing ? p.rate : 0.0);
    d[MPNowPlayingInfoPropertyDefaultPlaybackRate] = @1.0;
    status_ = p.status;
    publish();
  }

  void setControls(const Controls& controls) override {
    controls_ = controls;
    if (active_) applyControls();
  }

  std::string debugState() const override {
    // Relu CHEZ le système (la fiche publiée, l'état, les commandes actives) : preuve des bancs.
    MPNowPlayingInfoCenter* center = [MPNowPlayingInfoCenter defaultCenter];
    NSDictionary* d = center.nowPlayingInfo;
    MPRemoteCommandCenter* c = [MPRemoteCommandCenter sharedCommandCenter];
    NSDictionary* out = @{
      @"active" : @(active_),
      @"playbackState" : @(center.playbackState),
      @"title" : d[MPMediaItemPropertyTitle] ?: [NSNull null],
      @"artist" : d[MPMediaItemPropertyArtist] ?: [NSNull null],
      @"album" : d[MPMediaItemPropertyAlbumTitle] ?: [NSNull null],
      @"mediaType" : d[MPNowPlayingInfoPropertyMediaType] ?: [NSNull null],
      @"elapsed" : d[MPNowPlayingInfoPropertyElapsedPlaybackTime] ?: [NSNull null],
      @"duration" : d[MPMediaItemPropertyPlaybackDuration] ?: [NSNull null],
      @"rate" : d[MPNowPlayingInfoPropertyPlaybackRate] ?: [NSNull null],
      @"artwork" : @(d[MPMediaItemPropertyArtwork] != nil),
      @"commands" : @{
        @"play" : @(c.playCommand.enabled),
        @"pause" : @(c.pauseCommand.enabled),
        @"toggle" : @(c.togglePlayPauseCommand.enabled),
        @"stop" : @(c.stopCommand.enabled),
        @"next" : @(c.nextTrackCommand.enabled),
        @"previous" : @(c.previousTrackCommand.enabled),
        @"seek" : @(c.changePlaybackPositionCommand.enabled),
      },
    };
    NSData* json = [NSJSONSerialization dataWithJSONObject:out options:0 error:nil];
    return json ? std::string(static_cast<const char*>(json.bytes), json.length) : "null";
  }

 private:
  void bind(MPRemoteCommand* command, Command what) {
    auto onCommand = host_.onCommand;
    id token = [command addTargetWithHandler:^MPRemoteCommandHandlerStatus(MPRemoteCommandEvent*) {
      if (onCommand) onCommand({what, 0});
      return MPRemoteCommandHandlerStatusSuccess;
    }];
    command.enabled = YES;
    targets_.push_back({command, token});
  }

  void applyControls() {
    MPRemoteCommandCenter* c = [MPRemoteCommandCenter sharedCommandCenter];
    c.nextTrackCommand.enabled = controls_.next;
    c.previousTrackCommand.enabled = controls_.previous;
    c.changePlaybackPositionCommand.enabled = controls_.seek;
  }

  NSMutableDictionary* info() {
    if (!info_) info_ = [NSMutableDictionary dictionary];
    return info_;
  }

  void publish() {
    if (!active_) return;
    MPNowPlayingInfoCenter* center = [MPNowPlayingInfoCenter defaultCenter];
    center.nowPlayingInfo = [info_ copy];
    center.playbackState = stateOf(status_);
  }

  BackendHost host_;
  bool active_ = false;
  Status status_ = Status::Stopped;
  Controls controls_;
  NSMutableDictionary* info_ = nil;
  std::vector<std::pair<MPRemoteCommand*, id>> targets_;
};

}  // namespace

std::unique_ptr<Backend> createBackend(const BackendHost& host) { return std::make_unique<MacBackend>(host); }

}  // namespace tentacle::media_session
