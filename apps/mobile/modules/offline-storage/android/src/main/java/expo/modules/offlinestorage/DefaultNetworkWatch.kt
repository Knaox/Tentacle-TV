package expo.modules.offlinestorage

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities

/**
 * Le réseau PAR DÉFAUT du téléphone, suivi à chaque changement — la règle
 * « Wi-Fi seulement » en dépend.
 *
 * expo-network ne relit le type qu'à l'apparition ou à la disparition d'UN
 * réseau quelconque (`registerNetworkCallback` sans `onCapabilitiesChanged`).
 * Téléphone en données mobiles, le Wi-Fi arrive : l'évènement part AVANT que
 * le Wi-Fi devienne le réseau par défaut, le type relu vaut encore
 * « cellulaire », et plus rien ne le corrige — « Wi-Fi seulement » bloquait en
 * plein Wi-Fi (recette Android du 21/10, D3). Ici, le rappel du réseau par
 * défaut (`registerDefaultNetworkCallback`) dit chaque bascule ET chaque
 * changement de capacités, une fois le réseau en place.
 *
 * Rend les valeurs du magasin de connectivité : `wifi` (Wi-Fi, Ethernet),
 * `cellular` (données mobiles facturées), `other` (autre réseau, ou cellulaire
 * NON facturé), `none`, `unknown`.
 */
object DefaultNetworkWatch {
  private var callback: ConnectivityManager.NetworkCallback? = null

  private fun manager(context: Context): ConnectivityManager =
    context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

  fun kindOf(capabilities: NetworkCapabilities?): String = when {
    capabilities == null -> "unknown"
    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
      capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "wifi"
    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ->
      if (capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)) "other" else "cellular"
    else -> "other"
  }

  fun current(context: Context): String = try {
    val cm = manager(context)
    val network = cm.activeNetwork
    if (network == null) "none" else kindOf(cm.getNetworkCapabilities(network))
  } catch (e: Exception) {
    "unknown"
  }

  /** Un seul rappel à la fois ; `onChange` reçoit la nature du réseau par défaut. */
  fun start(context: Context, onChange: (String) -> Unit) {
    if (callback != null) return
    val next = object : ConnectivityManager.NetworkCallback() {
      override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
        onChange(kindOf(capabilities))
      }

      override fun onLost(network: Network) {
        onChange(current(context))
      }
    }
    try {
      manager(context).registerDefaultNetworkCallback(next)
      callback = next
    } catch (e: Exception) {
      callback = null
    }
  }

  fun stop(context: Context) {
    val current = callback ?: return
    callback = null
    try {
      manager(context).unregisterNetworkCallback(current)
    } catch (e: Exception) {
      // Déjà retiré.
    }
  }
}
