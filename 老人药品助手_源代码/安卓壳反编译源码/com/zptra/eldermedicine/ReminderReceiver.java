package com.zptra.eldermedicine;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/* JADX INFO: loaded from: classes.dex */
public class ReminderReceiver extends BroadcastReceiver {
    private static final int NOTIFICATION_ID = 701;

    @Override // android.content.BroadcastReceiver
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ReminderScheduler.ACTION_WEEKLY_CHECK.equals(intent.getAction()) || !NotificationUtil.allowed(context)) {
            return;
        }
        List<String> listExpiredMedicineNames = expiredMedicineNames(context);
        if (listExpiredMedicineNames.isEmpty()) {
            return;
        }
        NotificationUtil.createChannel(context);
        Intent intent2 = new Intent(context, (Class<?>) MainActivity.class);
        intent2.setFlags(335544320);
        PendingIntent activity = PendingIntent.getActivity(context, 1, intent2, 201326592);
        String strBuildNotificationText = buildNotificationText(listExpiredMedicineNames);
        Notification.Builder showWhen = new Notification.Builder(context, NotificationUtil.CHANNEL_ID).setSmallIcon(R.drawable.ic_notification).setContentTitle("药品过期提醒").setContentText(strBuildNotificationText).setStyle(new Notification.BigTextStyle().bigText(strBuildNotificationText)).setContentIntent(activity).setAutoCancel(true).setColor(Color.rgb(198, 40, 40)).setCategory("reminder").setVisibility(0).setWhen(System.currentTimeMillis()).setShowWhen(true);
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(NotificationManager.class);
        if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID, showWhen.build());
        }
    }

    private static List<String> expiredMedicineNames(Context context) {
        ArrayList arrayList = new ArrayList();
        try {
            JSONArray jSONArray = new JSONArray(context.getSharedPreferences("elder_medicine_reminders", 0).getString("medicines", "[]"));
            for (int i = 0; i < jSONArray.length(); i++) {
                JSONObject jSONObjectOptJSONObject = jSONArray.optJSONObject(i);
                if (jSONObjectOptJSONObject != null) {
                    String strTrim = jSONObjectOptJSONObject.optString("name", "").trim();
                    String strTrim2 = jSONObjectOptJSONObject.optString("expiry", "").trim();
                    if (!strTrim.isEmpty() && isExpired(strTrim2)) {
                        arrayList.add(strTrim);
                    }
                }
            }
        } catch (Exception e) {
        }
        return arrayList;
    }

    private static boolean isExpired(String str) {
        SimpleDateFormat simpleDateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        simpleDateFormat.setLenient(false);
        try {
            Date date = simpleDateFormat.parse(str);
            if (date == null) {
                return false;
            }
            Calendar calendar = Calendar.getInstance();
            calendar.set(11, 0);
            calendar.set(12, 0);
            calendar.set(13, 0);
            calendar.set(14, 0);
            return date.before(calendar.getTime());
        } catch (Exception e) {
            return false;
        }
    }

    private static String buildNotificationText(List<String> list) {
        if (list.size() == 1) {
            return "「" + list.get(0) + "」已过期，请打开软件查看。";
        }
        StringBuilder sb = new StringBuilder();
        sb.append("有 ").append(list.size()).append(" 种药品已过期：");
        int iMin = Math.min(3, list.size());
        for (int i = 0; i < iMin; i++) {
            if (i > 0) {
                sb.append("、");
            }
            sb.append("「").append(list.get(i)).append("」");
        }
        if (list.size() > iMin) {
            sb.append("等");
        }
        sb.append("，请打开软件查看。");
        return sb.toString();
    }
}
