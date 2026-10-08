package expo.modules.okoremanative

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.TextView

class FullScreenAlarmActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_alarm)
    findViewById<TextView>(R.id.alarm_title).text = intent.getStringExtra("title") ?: "Okorema!"
    findViewById<TextView>(R.id.alarm_body).text = intent.getStringExtra("body") ?: ""
    val done = findViewById<Button>(R.id.alarm_done)
    val snooze = findViewById<Button>(R.id.alarm_snooze)
    done.text = intent.getStringExtra("completeLabel") ?: "Done"
    snooze.text = intent.getStringExtra("snoozeLabel") ?: "Snooze"
    done.setOnClickListener {
      AlarmCenter.completeAlarm(this, intent)
      finish()
    }
    snooze.setOnClickListener {
      AlarmCenter.snoozeAlarm(this, intent)
      finish()
    }
  }

  @Deprecated("The alarm stays until the user chooses done or snooze.")
  override fun onBackPressed() {
    // Intentionally empty. The in-app overdue gate is a separate lock.
  }
}
