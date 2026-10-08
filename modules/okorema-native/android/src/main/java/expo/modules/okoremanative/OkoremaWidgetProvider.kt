package expo.modules.okoremanative

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

class OkoremaWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    render(context)
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == AlarmCenter.ACTION_WIDGET_COMPLETE) {
      val reminderId = intent.getStringExtra("reminderId") ?: return
      val occurrenceKey = intent.getStringExtra("occurrenceKey") ?: ""
      AlarmCenter.recordAction(context, reminderId, occurrenceKey, "complete")
      markDone(context, reminderId)
      render(context)
      return
    }
    super.onReceive(context, intent)
  }

  companion object {
    fun publish(context: Context, json: String) {
      AlarmCenter.contextPrefs(context).edit().putString(AlarmCenter.KEY_WIDGET, json).apply()
      render(context)
    }

    fun render(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, OkoremaWidgetProvider::class.java))
      val raw = AlarmCenter.contextPrefs(context).getString(AlarmCenter.KEY_WIDGET, "{}") ?: "{}"
      val snapshot = JSONObject(raw)
      val today = snapshot.optJSONArray("today") ?: JSONArray()
      for (id in ids) {
        val views = RemoteViews(context.packageName, R.layout.okorema_widget)
        views.setTextViewText(R.id.next_title, snapshot.optString("nextTitle", "Okorema!"))
        views.setTextViewText(R.id.next_due, snapshot.optString("nextDue", ""))
        views.setTextViewText(R.id.counts, snapshot.optString("counts", ""))
        bindRow(context, views, R.id.today_1, today, 0)
        bindRow(context, views, R.id.today_2, today, 1)
        bindRow(context, views, R.id.today_3, today, 2)
        val open = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (open != null) {
          val pending = PendingIntent.getActivity(
            context,
            0,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
          )
          views.setOnClickPendingIntent(R.id.widget_root, pending)
        }
        manager.updateAppWidget(id, views)
      }
    }

    private fun bindRow(context: Context, views: RemoteViews, viewId: Int, today: JSONArray, index: Int) {
      if (index >= today.length()) {
        views.setViewVisibility(viewId, View.GONE)
        return
      }
      val item = today.getJSONObject(index)
      val title = item.optString("title")
      val done = item.optBoolean("done")
      views.setViewVisibility(viewId, View.VISIBLE)
      views.setTextViewText(viewId, if (done) "✓ $title" else title)
      val intent = Intent(context, OkoremaWidgetProvider::class.java).apply {
        action = AlarmCenter.ACTION_WIDGET_COMPLETE
        putExtra("reminderId", item.optString("id"))
        putExtra("occurrenceKey", item.optString("occurrenceKey"))
      }
      val pending = PendingIntent.getBroadcast(
        context,
        item.optString("id").hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      views.setOnClickPendingIntent(viewId, pending)
    }

    private fun markDone(context: Context, reminderId: String) {
      val raw = AlarmCenter.contextPrefs(context).getString(AlarmCenter.KEY_WIDGET, "{}") ?: "{}"
      val snapshot = JSONObject(raw)
      val today = snapshot.optJSONArray("today") ?: return
      for (index in 0 until today.length()) {
        val item = today.getJSONObject(index)
        if (item.optString("id") == reminderId) {
          item.put("done", true)
        }
      }
      AlarmCenter.contextPrefs(context).edit().putString(AlarmCenter.KEY_WIDGET, snapshot.toString()).apply()
    }
  }
}
