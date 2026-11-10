package com.zptra.eldermedicine;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/* JADX INFO: loaded from: classes.dex */
public class BootReceiver extends BroadcastReceiver {
    @Override // android.content.BroadcastReceiver
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !"android.intent.action.BOOT_COMPLETED".equals(intent.getAction())) {
            return;
        }
        final BroadcastReceiver.PendingResult pendingResultGoAsync = goAsync();
        final Context applicationContext = context.getApplicationContext();
        new Thread(new Runnable() { // from class: com.zptra.eldermedicine.BootReceiver.1
            @Override // java.lang.Runnable
            public void run() {
                try {
                    ReminderScheduler.rescheduleAll(applicationContext);
                } finally {
                    pendingResultGoAsync.finish();
                }
            }
        }).start();
    }
}
