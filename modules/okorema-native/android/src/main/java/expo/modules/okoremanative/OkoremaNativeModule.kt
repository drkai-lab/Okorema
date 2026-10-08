package expo.modules.okoremanative

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class OkoremaNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OkoremaNative")

    Function("canScheduleExactAlarms") {
      val context = appContext.reactContext ?: return@Function false
      AlarmCenter.canScheduleExact(context)
    }

    Function("openExactAlarmSettings") {
      val context = appContext.reactContext ?: return@Function Unit
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
          data = Uri.parse("package:${context.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
      }
    }

    Function("canUseFullScreenIntent") {
      val context = appContext.reactContext ?: return@Function false
      AlarmCenter.canUseFullScreen(context)
    }

    Function("openFullScreenIntentSettings") {
      val context = appContext.reactContext ?: return@Function Unit
      if (Build.VERSION.SDK_INT >= 34) {
        val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
          data = Uri.parse("package:${context.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
      }
    }

    Function("syncAlarms") { json: String ->
      val context = appContext.reactContext ?: return@Function Unit
      AlarmCenter.replaceAlarms(context, json)
    }

    Function("showCountdown") { title: String, fireAtMs: Double ->
      val context = appContext.reactContext ?: return@Function Unit
      AlarmCenter.showCountdown(context, title, fireAtMs.toLong())
    }

    Function("hideCountdown") {
      val context = appContext.reactContext ?: return@Function Unit
      AlarmCenter.hideCountdown(context)
    }

    Function("setWidgetSnapshot") { json: String ->
      val context = appContext.reactContext ?: return@Function Unit
      OkoremaWidgetProvider.publish(context, json)
    }

    Function("consumePendingActions") {
      val context = appContext.reactContext ?: return@Function "[]"
      AlarmCenter.consumeActions(context)
    }

    Function("shareToKeep") { title: String, text: String ->
      val context = appContext.reactContext ?: return@Function false
      val plain = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, title)
        putExtra(Intent.EXTRA_TEXT, text)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      val keep = Intent(plain).apply { setPackage("com.google.android.keep") }
      if (keep.resolveActivity(context.packageManager) != null) {
        context.startActivity(keep)
        true
      } else {
        context.startActivity(Intent.createChooser(plain, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        false
      }
    }

    AsyncFunction("importDeviceReminders") {
      mapOf("granted" to false, "items" to emptyList<Map<String, Any>>())
    }
  }
}
