# Le moteur audio d'Octave (mode musique) sur iOS : mpv en audio seul (MPVKit,
# déjà embarqué par le lecteur vidéo), deux platines pour la transition douce,
# l'écran verrouillé et le Centre de contrôle. Il parle le même pont que la
# coquille du bureau — voir ../README.md.
Pod::Spec.new do |s|
  s.name           = 'OctaveAudio'
  s.version        = '1.0.0'
  s.summary        = "Moteur audio d'Octave : mpv en audio seul, arrière-plan, écran verrouillé"
  s.description    = 'Module Expo : lecture musicale en arrière-plan, enchaînement sans blanc, fondu enchaîné, Now Playing.'
  s.author         = 'Tentacle TV'
  s.homepage       = 'https://tentacletv.app'
  s.license        = { :type => 'AGPL-3.0-or-later' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'MPVKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,c,m,mm,swift}"
end
