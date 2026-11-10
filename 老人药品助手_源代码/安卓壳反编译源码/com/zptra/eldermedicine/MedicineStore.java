package com.zptra.eldermedicine;

import android.content.Context;
import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/* JADX INFO: loaded from: classes.dex */
public final class MedicineStore {
    private static final String BACKUP_FILE = "medicines.backup.json";
    private static final String DATA_FILE = "medicines.json";
    private static final Object LOCK = new Object();
    private static final String TAG = "ElderMedicineStore";

    private MedicineStore() {
    }

    public static String read(Context context) {
        synchronized (LOCK) {
            File file = new File(context.getApplicationContext().getFilesDir(), DATA_FILE);
            if (!file.isFile()) {
                return "[]";
            }
            try {
                return readUtf8(file);
            } catch (IOException e) {
                Log.e(TAG, "Cannot read medicine data", e);
                return "[]";
            }
        }
    }

    public static boolean write(Context context, String str) {
        if (str == null || str.trim().isEmpty()) {
            return false;
        }
        synchronized (LOCK) {
            File filesDir = context.getApplicationContext().getFilesDir();
            File file = new File(filesDir, DATA_FILE);
            File file2 = new File(filesDir, BACKUP_FILE);
            File file3 = new File(filesDir, "medicines.json.tmp");
            try {
                writeUtf8(file3, str);
                if (file.isFile()) {
                    copyFile(file, file2);
                }
                if (file.exists() && !file.delete()) {
                    Log.w(TAG, "Cannot delete old data file before replacing");
                }
                if (!file3.renameTo(file)) {
                    copyFile(file3, file);
                    if (!file3.delete()) {
                        Log.w(TAG, "Cannot delete temporary data file");
                    }
                }
            } catch (IOException e) {
                Log.e(TAG, "Cannot save medicine data", e);
                return false;
            }
        }
        return true;
    }

    private static String readUtf8(File file) throws IOException {
        FileInputStream fileInputStream = new FileInputStream(file);
        try {
            ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
            byte[] bArr = new byte[32768];
            while (true) {
                int i = fileInputStream.read(bArr);
                if (i == -1) {
                    break;
                }
                byteArrayOutputStream.write(bArr, 0, i);
            }
            return new String(byteArrayOutputStream.toByteArray(), StandardCharsets.UTF_8);
        } finally {
            try {
                fileInputStream.close();
            } catch (IOException e) {
            }
        }
    }

    private static void writeUtf8(File file, String str) throws IOException {
        FileOutputStream fileOutputStream = new FileOutputStream(file, false);
        try {
            fileOutputStream.write(str.getBytes(StandardCharsets.UTF_8));
            fileOutputStream.flush();
        } finally {
            try {
                fileOutputStream.close();
            } catch (IOException e) {
            }
        }
    }

    private static void copyFile(File file, File file2) throws IOException {
        FileInputStream fileInputStream = new FileInputStream(file);
        try {
            FileOutputStream fileOutputStream = new FileOutputStream(file2, false);
            try {
                byte[] bArr = new byte[32768];
                while (true) {
                    int i = fileInputStream.read(bArr);
                    if (i == -1) {
                        break;
                    } else {
                        fileOutputStream.write(bArr, 0, i);
                    }
                }
                fileOutputStream.flush();
                try {
                    fileOutputStream.close();
                } catch (IOException e) {
                }
                try {
                    fileInputStream.close();
                } catch (IOException e2) {
                }
            } finally {
                try {
                    fileOutputStream.close();
                } catch (IOException e3) {
                }
            }
        } catch (Throwable th) {
            try {
                fileInputStream.close();
            } catch (IOException e4) {
            }
            throw th;
        }
    }
}
