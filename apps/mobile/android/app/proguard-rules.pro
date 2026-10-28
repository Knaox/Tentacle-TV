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
# react-native-reanimated : sa règle de consommateur garde com.swmansion.reanimated,
# pas le paquet com.swmansion.worklets, qui appelle le contexte React par réflexion.
-keep class com.swmansion.worklets.** { *; }
# Champs et méthodes lus PAR LEUR NOM (réflexion) dans d’autres bibliothèques,
# relevés dans le mapping.txt d’une release : sans ces règles, R8 les renomme ou
# les retire et l’appel échoue en silence.
#  - expo-modules-core (props des vues Expo) : ReactStylesDiffMap.backingMap ;
#  - expo (délégué d’activité, hôte) : ReactActivity, ReactActivityDelegate, ReactNativeHost ;
#  - reanimated : NativeViewHierarchyManager, UIManagerModule, contexte React,
#    et react-native-screens tout entier (TabNavigatorObserver, ScreensHelper) ;
#  - expo-image-picker (recadrage) : CropImageActivity.
# (Reanimated cherche aussi MessageQueueThreadImpl.mIsFinished et
# ReactImageView.mBorderRadius : ils n’existent plus dans RN 0.81, R8 ou pas.)
-keepclassmembers class com.facebook.react.uimanager.ReactStylesDiffMap { *** backingMap; }
-keepclassmembers class com.facebook.react.ReactActivity { *** mDelegate; }
-keepclassmembers class com.facebook.react.ReactActivityDelegate { *** mReactDelegate; }
-keepclassmembers class com.facebook.react.ReactNativeHost { *** mReactInstanceManager; }
-keepclassmembers class com.facebook.react.uimanager.NativeViewHierarchyManager { *** mLayoutAnimator; *** mPendingDeletionsForTag; }
-keepclassmembers class com.facebook.react.uimanager.UIManagerModule { *** mUIImplementation; }
-keepclassmembers class * extends com.facebook.react.bridge.ReactContext { *** getJSCallInvokerHolder(); *** getCatalystInstance(); }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.canhub.cropper.CropImageActivity { *; }
# Numéros de ligne gardés : les piles des rapports Play se relisent par le mapping.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
# @generated end expo-build-properties