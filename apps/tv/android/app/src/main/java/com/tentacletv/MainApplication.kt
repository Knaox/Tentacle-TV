package com.tentacletv

import android.app.Application
import android.content.Context
import android.content.res.Configuration
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.config.ReactFeatureFlags
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.soloader.OpenSourceMergedSoMapping
import com.facebook.soloader.SoLoader
import com.tentacletv.exoplayer.ExoPackage
import com.tentacletv.mpv.MpvPackage

class MainApplication : Application(), ReactApplication {

  /** Densité normalisée (cf. TvDensity) posée AUSSI sur le contexte APPLICATION :
   *  React Native calcule `Dimensions` depuis celui-ci (DisplayMetricsHolder) —
   *  sans ça, seule la partie native serait à l'échelle, pas l'UI JS. */
  override fun attachBaseContext(base: Context) {
    val cfg = Configuration()
    cfg.densityDpi = TvDensity.densityDpi(base)
    super.attachBaseContext(base.createConfigurationContext(cfg))
  }

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages + listOf(VoiceRecognitionPackage(), MpvPackage(), ExoPackage())

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = false
        override val isHermesEnabled: Boolean = true
      }

  override fun onCreate() {
    super.onCreate()
    SoLoader.init(this, OpenSourceMergedSoMapping)
    // Émet AUSSI les événements TV key-DOWN (eventKeyAction=0) et leurs
    // répétitions vers useTVEventHandler — sans ce flag, seuls les key-up
    // (a=1) remontent au JS et un MAINTIEN (avance rapide) est indiscernable
    // d'appuis répétés (cf. useButtonSeek / react-native-tvos discussion #728).
    ReactFeatureFlags.enableKeyDownEvents = true
  }
}
