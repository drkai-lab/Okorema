package expo.modules.okoremanative

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject

object AlarmCenter {
  const val PREFS = "okorema_native"
  const val KEY_ALARMS = "alarms"
  const val KEY_ACTIONS = "pending_actions"
  const val KEY_WIDGET = "widget"
  const val ACTION_FIRE = "app.okorema.FIRE"
  const val ACTION_COMPLETE = "app.okorema.COMPLETE"
  const val ACTION_SNOOZE = "app.okorema.SNOOZE"
  const val ACTION_WIDGET_COMPLETE = "app.okorema.WIDGET_COMPLETE"
  const val CHANNEL_ALARM = "okorema-alarm"
  const val CHANNEL_ONGOING = "okorema-ongoing"
  private const val ONGOING_ID = 74001

  fun contextPrefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    val alarm = NotificationChannel(CHANNEL_ALARM, "Okorema!", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Persistent reminders"
      enableVibration(true)
      setBypassDnd(true)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    }
    val ongoing = NotificationChannel(CHANNEL_ONGOING, "Okorema countdown", NotificationManager.IMPORTANCE_LOW).apply {
      setSound(null, null)
    }
    manager.createNotificationChannel(alarm)
    manager.createNotificationChannel(ongoing)
  }

  fun canScheduleExact(context: Context): Boolean {
    val alarmManager = context.getSystemService(AlarmManager::class.java)
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) alarmManager.canScheduleExactAlarms() else true
  }

  fun canUseFullScreen(context: Context): Boolean {
    val manager = context.getSystemService(NotificationManager::class.java)
    return if (Build.VERSION.SDK_INT >= 34) manager.canUseFullScreenIntent() else true
  }

  fun replaceAlarms(context: Context, json: String) {
    ensureChannels(context)
    val previous = contextPrefs(context).getString(KEY_ALARMS, "[]") ?: "[]"
    cancelAll(context, previous)
    contextPrefs(context).edit().putString(KEY_ALARMS, json).apply()
    scheduleAll(context, json)
  }

  fun rescheduleSaved(context: Context) {
    val json = contextPrefs(context).getString(KEY_ALARMS, "[]") ?: "[]"
    scheduleAll(context, json)
  }

  private fun scheduleAll(context: Context, json: String) {
    val array = JSONArray(json)
    for (index in 0 until array.length()) {
      val item = array.getJSONObject(index)
      scheduleOne(context, item)
    }
  }

  private fun cancelAll(context: Context, json: String) {
    val array = JSONArray(json)
    val alarmManager = context.getSystemService(AlarmManager::class.java)
    for (index in 0 until array.length()) {
      val item = array.getJSONObject(index)
      val id = item.getString("id")
      pendingBroadcast(context, id, ACTION_FIRE, item, PendingIntent.FLAG_NO_CREATE)?.let { alarmManager.cancel(it) }
    }
  }

  fun scheduleOne(context: Context, item: JSONObject) {
    val alarmManager = context.getSystemService(AlarmManager::class.java)
    val fireAt = item.getLong("fireAt")
    val pending = pendingBroadcast(context, item.getString("id"), ACTION_FIRE, item, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
    try {
      if (canScheduleExact(context)) {
        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pending)
      } else {
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pending)
      }
    } catch (_: SecurityException) {
      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pending)
    }
  }

  fun pendingBroadcast(context: Context, id: String, action: String, item: JSONObject?, flags: Int): PendingIntent? {
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      this.action = action
      putExtra("id", id)
      if (item != null) {
        putExtra("reminderId", item.optString("reminderId"))
        putExtra("occurrenceKey", item.optString("occurrenceKey"))
        putExtra("title", item.optString("title"))
        putExtra("body", item.optString("body"))
        putExtra("fullScreen", item.optBoolean("fullScreen", true))
        putExtra("completeLabel", item.optString("completeLabel", "Done"))
        putExtra("snoozeLabel", item.optString("snoozeLabel", "Snooze"))
      }
    }
    return PendingIntent.getBroadcast(context, id.hashCode(), intent, flags or PendingIntent.FLAG_IMMUTABLE)
  }

  fun showAlarm(context: Context, intent: Intent) {
    ensureChannels(context)
    val id = intent.getStringExtra("id") ?: return
    val title = intent.getStringExtra("title") ?: "Okorema!"
    val body = intent.getStringExtra("body") ?: ""
    val fullScreen = intent.getBooleanExtra("fullScreen", true)
    val notificationId = id.hashCode()
    val content = Intent(context, FullScreenAlarmActivity::class.java).apply {
      putExtras(intent)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val contentPending = PendingIntent.getActivity(
      context,
      notificationId,
      content,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val complete = actionPending(context, intent, ACTION_COMPLETE, "complete")
    val snooze = actionPending(context, intent, ACTION_SNOOZE, "snooze")
    val builder = NotificationCompat.Builder(context, CHANNEL_ALARM)
      .setSmallIcon(R.drawable.ic_stat_okorema)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(false)
      .setContentIntent(contentPending)
      .addAction(0, intent.getStringExtra("completeLabel") ?: "Done", complete)
      .addAction(0, intent.getStringExtra("snoozeLabel") ?: "Snooze", snooze)
    if (fullScreen && canUseFullScreen(context)) {
      builder.setFullScreenIntent(contentPending, true)
    }
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.notify(notificationId, builder.build())
    if (fullScreen && canUseFullScreen(context)) {
      context.startActivity(content)
    }
  }

  private fun actionPending(context: Context, source: Intent, action: String, suffix: String): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).apply {
      this.action = action
      putExtras(source)
    }
    val id = (source.getStringExtra("id") ?: "alarm") + suffix
    return PendingIntent.getBroadcast(
      context,
      id.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun recordAction(context: Context, reminderId: String, occurrenceKey: String, action: String) {
    val prefs = contextPrefs(context)
    val array = JSONArray(prefs.getString(KEY_ACTIONS, "[]"))
    val entry = JSONObject()
      .put("reminderId", reminderId)
      .put("occurrenceKey", occurrenceKey)
      .put("action", action)
      .put("at", System.currentTimeMillis())
    array.put(entry)
    prefs.edit().putString(KEY_ACTIONS, array.toString()).apply()
  }

  fun consumeActions(context: Context): String {
    val prefs = contextPrefs(context)
    val current = prefs.getString(KEY_ACTIONS, "[]") ?: "[]"
    prefs.edit().putString(KEY_ACTIONS, "[]").apply()
    return current
  }

  fun showCountdown(context: Context, title: String, fireAtMs: Long) {
    ensureChannels(context)
    val builder = NotificationCompat.Builder(context, CHANNEL_ONGOING)
      .setSmallIcon(R.drawable.ic_stat_okorema)
      .setContentTitle(title)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setWhen(fireAtMs)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
    context.getSystemService(NotificationManager::class.java).notify(ONGOING_ID, builder.build())
  }

  fun hideCountdown(context: Context) {
    context.getSystemService(NotificationManager::class.java).cancel(ONGOING_ID)
  }

  fun snoozeAlarm(context: Context, intent: Intent) {
    val reminderId = intent.getStringExtra("reminderId") ?: return
    val occurrenceKey = intent.getStringExtra("occurrenceKey") ?: ""
    recordAction(context, reminderId, occurrenceKey, "snooze")
    val item = JSONObject()
      .put("id", "snooze-$reminderId-${System.currentTimeMillis()}")
      .put("reminderId", reminderId)
      .put("occurrenceKey", occurrenceKey)
      .put("title", intent.getStringExtra("title") ?: "Okorema!")
      .put("body", intent.getStringExtra("body") ?: "")
      .put("fireAt", System.currentTimeMillis() + 10 * 60 * 1000)
      .put("fullScreen", true)
      .put("completeLabel", intent.getStringExtra("completeLabel") ?: "Done")
      .put("snoozeLabel", intent.getStringExtra("snoozeLabel") ?: "Snooze")
    scheduleOne(context, item)
    context.getSystemService(NotificationManager::class.java).cancel((intent.getStringExtra("id") ?: "").hashCode())
  }

  fun completeAlarm(context: Context, intent: Intent) {
    val reminderId = intent.getStringExtra("reminderId") ?: return
    recordAction(context, reminderId, intent.getStringExtra("occurrenceKey") ?: "", "complete")
    context.getSystemService(NotificationManager::class.java).cancel((intent.getStringExtra("id") ?: "").hashCode())
  }
}
