package expo.modules.okoremanative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      AlarmCenter.ACTION_COMPLETE -> AlarmCenter.completeAlarm(context, intent)
      AlarmCenter.ACTION_SNOOZE -> AlarmCenter.snoozeAlarm(context, intent)
      else -> AlarmCenter.showAlarm(context, intent)
    }
  }
}

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
      AlarmCenter.rescheduleSaved(context)
      OkoremaWidgetProvider.render(context)
    }
  }
}
