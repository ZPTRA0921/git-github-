package com.zptra.eldermedicine;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

/* JADX INFO: loaded from: classes.dex */
public final class NotificationUtil {
    public static final String CHANNEL_ID = "medicine_expiry";
    public static final int REQUEST_CODE = 201;

    private NotificationUtil() {
    }

    public static void createChannel(Context context) {
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(NotificationManager.class);
        if (notificationManager == null) {
            return;
        }
        NotificationChannel notificationChannel = new NotificationChannel(CHANNEL_ID, context.getString(R.string.notification_channel_name), 4);
        notificationChannel.setDescription(context.getString(R.string.notification_channel_description));
        notificationChannel.enableVibration(true);
        notificationManager.createNotificationChannel(notificationChannel);
    }

    public static boolean allowed(Context context) {
        NotificationManager notificationManager;
        return (Build.VERSION.SDK_INT < 33 || context.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == 0) && (notificationManager = (NotificationManager) context.getSystemService(NotificationManager.class)) != null && notificationManager.areNotificationsEnabled();
    }
}
