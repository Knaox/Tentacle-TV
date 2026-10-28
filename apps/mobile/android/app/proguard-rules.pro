# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# @generated begin expo-build-properties - expo prebuild (DO NOT MODIFY)
# Tentacle : règles R8 de l'app (le reste vient des bibliothèques elles-mêmes).
# Le code natif maison est gardé ENTIER : peu de poids, et aucun nom qu'un
# appel JNI, un manifeste ou une réflexion attend ne peut disparaître.
-keep class com.tentacle.mobile.** { *; }
-keep class com.tentacletv.boot.** { *; }
-keep class expo.modules.mpvplayer.** { *; }
-keep class expo.modules.octaveaudio.** { *; }
-keep class expo.modules.offlinestorage.** { *; }
-keep class expo.modules.playerpip.** { *; }
-keep class expo.modules.tentaclecast.** { *; }
# libmpv-android : son code natif rappelle les observateurs par leur nom (JNI) ;
# la règle de l'AAR ne garde que MPVLib, pas ses interfaces imbriquées.
-keep class dev.jdtech.mpv.** { *; }
-keep interface dev.jdtech.mpv.** { *; }
# Décodeur audio FFmpeg (Media3), chargé par réflexion par DefaultRenderersFactory.
-keep class androidx.media3.decoder.ffmpeg.** { *; }
# expo-notifications : son build.gradle ne déclare pas sa règle de consommateur.
-keep class expo.modules.notifications.** { *; }
# Numéros de ligne gardés : les piles des rapports Play se relisent par le mapping.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
# @generated end expo-build-properties