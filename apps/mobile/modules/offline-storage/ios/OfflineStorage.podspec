Pod::Spec.new do |s|
  s.name           = 'OfflineStorage'
  s.version        = '1.0.0'
  s.summary        = 'Exclusion de la sauvegarde iCloud pour les titres hors ligne de Tentacle TV'
  s.description    = 'Pose l attribut isExcludedFromBackup sur le dossier des titres hors ligne.'
  s.author         = 'Tentacle TV'
  s.homepage       = 'https://tentacletv.app'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1', :tvos => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
