package com.zptra.eldermedicine;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import java.util.Calendar;
import org.json.JSONArray;

/* JADX INFO: loaded from: classes.dex */
public final class ReminderScheduler {
    public static final String ACTION_WEEKLY_CHECK = "com.zptra.eldermedicine.WEEKLY_CHECK";
    private static final String KEY_MEDS = "medicines";
    private static final String PREFS = "elder_medicine_reminders";
    private static final String TAG = "ElderMedicineAlarm";
    private static final int WEEKLY_REQUEST_CODE = 701;
    private static final long WEEK_IN_MILLIS = 604800000;

    private ReminderScheduler() {
    }

    public static void sync(Context context, String str) {
        Context applicationContext = context.getApplicationContext();
        SharedPreferences sharedPreferences = applicationContext.getSharedPreferences(PREFS, 0);
        try {
            if (str == null) {
                str = "[]";
            }
            sharedPreferences.edit().putString(KEY_MEDS, new JSONArray(str).toString()).apply();
            scheduleWeekly(applicationContext);
        } catch (Exception e) {
            Log.e(TAG, "Invalid reminder payload", e);
        }
    }

    public static void rescheduleAll(Context context) {
        scheduleWeekly(context.getApplicationContext());
    }

    private static void scheduleWeekly(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(AlarmManager.class);
        if (alarmManager == null) {
            return;
        }
        try {
            alarmManager.setInexactRepeating(0, nextWeeklyTrigger(), WEEK_IN_MILLIS, weeklyPendingIntent(context));
        } catch (Exception e) {
            Log.e(TAG, "Cannot schedule weekly check", e);
        }
    }

    private static PendingIntent weeklyPendingIntent(Context context) {
        Intent intent = new Intent(context, (Class<?>) ReminderReceiver.class);
        intent.setAction(ACTION_WEEKLY_CHECK);
        return PendingIntent.getBroadcast(context, WEEKLY_REQUEST_CODE, intent, 201326592);
    }

    private static long nextWeeklyTrigger() {
        Calendar calendar = Calendar.getInstance();
        calendar.set(7, 2);
        calendar.set(11, 9);
        calendar.set(12, 0);
        calendar.set(13, 0);
        calendar.set(14, 0);
        if (calendar.getTimeInMillis() <= System.currentTimeMillis()) {
            calendar.add(3, 1);
        }
        return calendar.getTimeInMillis();
    }
}
