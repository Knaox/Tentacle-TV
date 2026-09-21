# MPVKit — libmpv 0.41 + FFmpeg 8.1 + libass + libplacebo + dav1d pour iOS,
# avec la sortie vidéo `vo=avfoundation` (patch du fork Streamyfin, absent
# d'upstream). SEULE source de l'URL et de la somme de contrôle du binaire :
# le Podfile pointe ici (`pod 'MPVKit', :podspec => 'MPVKit.podspec'`). Hors du
# dossier du module à dessein : l'autolinking Expo y prendrait ce podspec pour
# un pod de développement, qui ne télécharge jamais sa source `:http`.
#
# ⚠️ v1 = binaires du fork Streamyfin, construits en configuration GPL :
# acceptables en développement et sur TestFlight, PAS pour l'App Store.
# Avant soumission, `.github/workflows/mpvkit.yml` construit la variante LGPL
# (mpv -Dgpl=false, FFmpeg sans --enable-gpl, sans libsmbclient) et publie une
# Release GitHub : remplacer alors `:http`, `:sha256`, `version` et `license`.
Pod::Spec.new do |s|
  s.name             = 'MPVKit'
  s.version          = '0.41.0-av5'
  s.summary          = 'MPVKit avec la sortie vidéo AVFoundation (fork Streamyfin)'
  s.description      = <<-DESC
    Fork de MPVKit ajoutant vo_avfoundation : rendu dans un AVSampleBufferDisplayLayer,
    image dans l image, VideoToolbox, OSD composite pour les sous-titres, HDR.
  DESC
  s.homepage         = 'https://github.com/streamyfin/MPVKit'
  s.license          = { :type => 'GPL-3.0', :text => 'GPL-3.0 (binaires de développement). Variante LGPL exigée avant soumission : voir mpvkit.yml.' }
  s.author           = { 'streamyfin' => 'https://github.com/streamyfin' }
  s.source           = {
    :http   => 'https://github.com/streamyfin/MPVKit/releases/download/0.41.0-av5/MPVKit.xcframework.zip',
    :sha256 => '80a79fbb34b1a3ae84744fe7bb9d365d2a006a5f617460933b7ce777251d3618'
  }

  s.ios.deployment_target = '15.1'

  s.static_framework = true
  s.requires_arc = true

  # Le zip s'extrait en MPVKit.xcframework à la racine (slices ios-arm64 et
  # simulateur arm64/x86_64 ; les slices tvOS sont ignorées ici).
  s.vendored_frameworks = 'MPVKit.xcframework'

  s.frameworks = [
    'AVFoundation', 'AudioToolbox', 'CoreAudio', 'CoreVideo', 'CoreFoundation',
    'CoreMedia', 'Metal', 'QuartzCore', 'VideoToolbox'
  ]
  s.libraries = ['bz2', 'iconv', 'expat', 'resolv', 'xml2', 'z', 'c++']

  s.pod_target_xcconfig = {
    'VALID_ARCHS' => 'arm64 x86_64',
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386'
  }
  s.user_target_xcconfig = {
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386'
  }
  # -ObjC : les catégories Objective-C de la bibliothèque statique doivent être
  # liées même si rien ne les référence directement.
  s.xcconfig = { 'OTHER_LDFLAGS' => '$(inherited) -ObjC' }
end
