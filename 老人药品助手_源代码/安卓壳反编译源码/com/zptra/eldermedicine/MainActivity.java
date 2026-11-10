package com.zptra.eldermedicine;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.speech.tts.TextToSpeech;
import android.util.Base64;
import android.util.Log;
import android.view.Window;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import org.json.JSONObject;

/* JADX INFO: loaded from: classes.dex */
public class MainActivity extends Activity {
    private static final String KEY_NOTIFICATION_ASKED = "notification_asked";
    private static final int MAX_PHOTO_SIDE = 1400;
    private static final int REQUEST_CALL_PHONE = 202;
    private static final int REQUEST_CAMERA = 1001;
    private static final int REQUEST_GALLERY = 1002;
    private static final int REQUEST_NOTIFICATIONS = 201;
    private static final String SETTINGS_PREFS = "elder_medicine_settings";
    private static final String TAG = "ElderMedicine";
    private static final String UI_PREFS = "elder_medicine_ui";
    private Uri cameraUri;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private String pendingEmergencyNumber;
    private String pendingPhotoKey;
    private String pendingSpeech;
    private TextToSpeech textToSpeech;
    private boolean ttsReady;
    private WebView webView;

    @Override // android.app.Activity
    protected void onCreate(Bundle bundle) {
        super.onCreate(bundle);
        configureWindow();
        NotificationUtil.createChannel(this);
        initTextToSpeech();
        createWebView();
        requestNotificationPermissionOnce();
    }

    private void configureWindow() {
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(32, 82, 61));
        window.setNavigationBarColor(Color.rgb(243, 246, 243));
        window.getDecorView().setSystemUiVisibility(16);
    }

    private void createWebView() {
        FrameLayout frameLayout = new FrameLayout(this);
        frameLayout.setBackgroundColor(Color.rgb(243, 246, 243));
        setContentView(frameLayout);
        WebView webView = new WebView(this);
        this.webView = webView;
        webView.setLayoutParams(new FrameLayout.LayoutParams(-1, -1));
        this.webView.setBackgroundColor(Color.rgb(243, 246, 243));
        this.webView.setOverScrollMode(2);
        frameLayout.addView(this.webView);
        WebSettings settings = this.webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(1);
        this.webView.addJavascriptInterface(new WebAppBridge(), "Android");
        this.webView.setWebChromeClient(new WebChromeClient() { // from class: com.zptra.eldermedicine.MainActivity.1
            @Override // android.webkit.WebChromeClient
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(MainActivity.TAG, "Web console: " + consoleMessage.message() + " @" + consoleMessage.lineNumber());
                return true;
            }
        });
        this.webView.setWebViewClient(new WebViewClient() { // from class: com.zptra.eldermedicine.MainActivity.2
            @Override // android.webkit.WebViewClient
            public boolean shouldOverrideUrlLoading(WebView webView2, WebResourceRequest webResourceRequest) {
                return true;
            }

            @Override // android.webkit.WebViewClient
            public boolean shouldOverrideUrlLoading(WebView webView2, String str) {
                return true;
            }
        });
        this.webView.loadUrl("file:///android_asset/index.html");
    }

    private void requestNotificationPermissionOnce() {
        if (Build.VERSION.SDK_INT < 33 || checkSelfPermission("android.permission.POST_NOTIFICATIONS") == 0) {
            return;
        }
        SharedPreferences sharedPreferences = getSharedPreferences(UI_PREFS, 0);
        if (!sharedPreferences.getBoolean(KEY_NOTIFICATION_ASKED, false)) {
            sharedPreferences.edit().putBoolean(KEY_NOTIFICATION_ASKED, true).apply();
            this.mainHandler.postDelayed(new Runnable() { // from class: com.zptra.eldermedicine.MainActivity.3
                @Override // java.lang.Runnable
                public void run() {
                    if (!MainActivity.this.isFinishing()) {
                        MainActivity.this.requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 201);
                    }
                }
            }, 900L);
        }
    }

    @Override // android.app.Activity
    public void onRequestPermissionsResult(int i, String[] strArr, int[] iArr) {
        super.onRequestPermissionsResult(i, strArr, iArr);
        if (i == 201) {
            notifyJsResume();
            return;
        }
        if (i == REQUEST_CALL_PHONE) {
            String str = this.pendingEmergencyNumber;
            this.pendingEmergencyNumber = null;
            if (str == null || str.trim().isEmpty()) {
                return;
            }
            boolean z = false;
            if (iArr.length > 0 && iArr[0] == 0) {
                z = true;
            }
            dialEmergency(str, z);
        }
    }

    @Override // android.app.Activity
    protected void onResume() {
        super.onResume();
        this.mainHandler.postDelayed(new Runnable() { // from class: com.zptra.eldermedicine.MainActivity.4
            @Override // java.lang.Runnable
            public void run() {
                MainActivity.this.notifyJsResume();
            }
        }, 250L);
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void notifyJsResume() {
        WebView webView = this.webView;
        if (webView == null) {
            return;
        }
        webView.evaluateJavascript("window.onAndroidResume && window.onAndroidResume();", null);
    }

    @Override // android.app.Activity
    public void onBackPressed() {
        WebView webView = this.webView;
        if (webView == null) {
            super.onBackPressed();
        } else {
            webView.evaluateJavascript("window.appHandleBack ? window.appHandleBack() : false", new ValueCallback<String>() { // from class: com.zptra.eldermedicine.MainActivity.5
                @Override // android.webkit.ValueCallback
                public void onReceiveValue(String str) {
                    if (!"true".equals(str)) {
                        MainActivity.super.onBackPressed();
                    }
                }
            });
        }
    }

    private void initTextToSpeech() {
        this.textToSpeech = new TextToSpeech(this, new TextToSpeech.OnInitListener() { // from class: com.zptra.eldermedicine.MainActivity.6
            @Override // android.speech.tts.TextToSpeech.OnInitListener
            public void onInit(int i) {
                if (i == 0 && MainActivity.this.textToSpeech != null) {
                    int language = MainActivity.this.textToSpeech.setLanguage(Locale.SIMPLIFIED_CHINESE);
                    if (language == -1 || language == -2) {
                        MainActivity.this.textToSpeech.setLanguage(Locale.getDefault());
                    }
                    MainActivity.this.textToSpeech.setSpeechRate(0.92f);
                    MainActivity.this.ttsReady = true;
                    if (MainActivity.this.pendingSpeech != null) {
                        String str = MainActivity.this.pendingSpeech;
                        MainActivity.this.pendingSpeech = null;
                        MainActivity.this.speakOnUiThread(str);
                        return;
                    }
                    return;
                }
                Log.w(MainActivity.TAG, "Text to speech unavailable");
            }
        });
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void speakOnUiThread(String str) {
        TextToSpeech textToSpeech;
        if (str == null || str.trim().isEmpty()) {
            return;
        }
        if (!this.ttsReady || (textToSpeech = this.textToSpeech) == null) {
            this.pendingSpeech = str;
            return;
        }
        try {
            textToSpeech.speak(str.trim(), 0, null, "elder-medicine-reminder");
        } catch (Exception e) {
            Log.e(TAG, "Speech failed", e);
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void showPhotoOptions(final String str) {
        if (this.pendingPhotoKey != null) {
            return;
        }
        this.pendingPhotoKey = str;
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("添加药品照片");
        builder.setItems(new CharSequence[]{"拍照", "从相册选择"}, new DialogInterface.OnClickListener() { // from class: com.zptra.eldermedicine.MainActivity.7
            @Override // android.content.DialogInterface.OnClickListener
            public void onClick(DialogInterface dialogInterface, int i) {
                if (i == 0) {
                    MainActivity.this.launchCamera(str);
                } else {
                    MainActivity.this.launchGallery(str);
                }
            }
        });
        builder.setNegativeButton("取消", new DialogInterface.OnClickListener() { // from class: com.zptra.eldermedicine.MainActivity.8
            @Override // android.content.DialogInterface.OnClickListener
            public void onClick(DialogInterface dialogInterface, int i) {
                MainActivity.this.cancelPhotoSelection(str);
            }
        });
        builder.setOnCancelListener(new DialogInterface.OnCancelListener() { // from class: com.zptra.eldermedicine.MainActivity.9
            @Override // android.content.DialogInterface.OnCancelListener
            public void onCancel(DialogInterface dialogInterface) {
                MainActivity.this.cancelPhotoSelection(str);
            }
        });
        builder.show();
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void cancelPhotoSelection(String str) {
        if (this.pendingPhotoKey == null) {
            return;
        }
        this.pendingPhotoKey = null;
        sendPhotoResult(str, "", "cancel");
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void launchCamera(String str) {
        ContentValues contentValues = new ContentValues();
        contentValues.put("_display_name", "elder_medicine_" + System.currentTimeMillis() + ".jpg");
        contentValues.put("mime_type", "image/jpeg");
        contentValues.put("relative_path", Environment.DIRECTORY_PICTURES + "/老人药品助手");
        contentValues.put("is_pending", (Integer) 1);
        try {
            this.cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues);
        } catch (Exception e) {
            this.cameraUri = null;
            Log.e(TAG, "Cannot create camera output", e);
        }
        if (this.cameraUri == null) {
            this.pendingPhotoKey = null;
            sendPhotoResult(str, "", "camera_unavailable");
            return;
        }
        Intent intent = new Intent("android.media.action.IMAGE_CAPTURE");
        intent.putExtra("output", this.cameraUri);
        intent.addFlags(3);
        try {
            startActivityForResult(intent, REQUEST_CAMERA);
        } catch (ActivityNotFoundException e2) {
            cleanupCameraUri(this.cameraUri);
            this.cameraUri = null;
            this.pendingPhotoKey = null;
            sendPhotoResult(str, "", "camera_unavailable");
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void launchGallery(String str) {
        Intent intent = new Intent("android.intent.action.GET_CONTENT");
        intent.setType("image/*");
        intent.addCategory("android.intent.category.OPENABLE");
        try {
            startActivityForResult(intent, REQUEST_GALLERY);
        } catch (ActivityNotFoundException e) {
            this.pendingPhotoKey = null;
            sendPhotoResult(str, "", "gallery_unavailable");
        }
    }

    @Override // android.app.Activity
    protected void onActivityResult(int i, int i2, Intent intent) {
        final Uri data;
        super.onActivityResult(i, i2, intent);
        if (i != REQUEST_CAMERA && i != REQUEST_GALLERY) {
            return;
        }
        final String str = this.pendingPhotoKey;
        if (str == null) {
            cleanupCameraUri(this.cameraUri);
            this.cameraUri = null;
            return;
        }
        if (i == REQUEST_CAMERA) {
            data = this.cameraUri;
        } else if (intent == null) {
            data = null;
        } else {
            data = intent.getData();
        }
        if (i2 != -1 || data == null) {
            cleanupCameraUri(this.cameraUri);
            this.cameraUri = null;
            this.pendingPhotoKey = null;
            sendPhotoResult(str, "", "cancel");
            return;
        }
        final boolean z = i == REQUEST_CAMERA;
        this.cameraUri = null;
        this.pendingPhotoKey = null;
        new Thread(new Runnable() { // from class: com.zptra.eldermedicine.MainActivity.10
            /* JADX WARN: Code duplicated, block: B:14:0x002a A[PHI: r0
  0x002a: PHI (r0v3 java.lang.String) = (r0v2 java.lang.String), (r0v5 java.lang.String) binds: [B:18:0x003c, B:13:0x0028] A[DONT_GENERATE, DONT_INLINE]] */
            @Override // java.lang.Runnable
            public void run() {
                String str2;
                String str3 = "";
                try {
                    try {
                        String strImageToDataUrl = MainActivity.this.imageToDataUrl(data);
                        if (z) {
                            MainActivity.this.cleanupCameraUri(data);
                        }
                        str3 = strImageToDataUrl;
                        str2 = "";
                    } catch (Exception e) {
                        Log.e(MainActivity.TAG, "Cannot process photo", e);
                        str2 = "read_failed";
                        if (z) {
                            MainActivity.this.cleanupCameraUri(data);
                        }
                    } catch (OutOfMemoryError e2) {
                        Log.e(MainActivity.TAG, "Photo too large", e2);
                        str2 = "photo_too_large";
                        if (z) {
                            MainActivity.this.cleanupCameraUri(data);
                        }
                    }
                    MainActivity.this.sendPhotoResult(str, str3, str2);
                } catch (Throwable th) {
                    if (z) {
                        MainActivity.this.cleanupCameraUri(data);
                    }
                    throw th;
                }
            }
        }).start();
    }

    /* JADX INFO: Access modifiers changed from: private */
    /* JADX WARN: Not initialized variable reg: 2, insn: 0x0142: MOVE (r1 I:??[OBJECT, ARRAY]) = (r2 I:??[OBJECT, ARRAY]), block:B:71:0x0142 */
    public String imageToDataUrl(Uri uri) throws Throwable {
        InputStream inputStreamOpenInputStream;
        Closeable closeable;
        int attributeInt;
        Closeable closeable2 = null;
        try {
            try {
                inputStreamOpenInputStream = getContentResolver().openInputStream(uri);
                if (inputStreamOpenInputStream != null) {
                    try {
                        attributeInt = new ExifInterface(inputStreamOpenInputStream).getAttributeInt("Orientation", 1);
                    } catch (Exception e) {
                        e = e;
                        Log.w(TAG, "Cannot read EXIF orientation", e);
                        closeQuietly(inputStreamOpenInputStream);
                        attributeInt = 1;
                    }
                } else {
                    attributeInt = 1;
                }
                closeQuietly(inputStreamOpenInputStream);
            } catch (Throwable th) {
                th = th;
                closeable2 = closeable;
                closeQuietly(closeable2);
                throw th;
            }
        } catch (Exception e2) {
            e = e2;
            inputStreamOpenInputStream = null;
        } catch (Throwable th2) {
            th = th2;
            closeQuietly(closeable2);
            throw th;
        }
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        InputStream inputStreamOpenInputStream2 = getContentResolver().openInputStream(uri);
        if (inputStreamOpenInputStream2 == null) {
            throw new IOException("No image stream");
        }
        try {
            BitmapFactory.decodeStream(inputStreamOpenInputStream2, null, options);
            closeQuietly(inputStreamOpenInputStream2);
            if (options.outWidth <= 0 || options.outHeight <= 0) {
                throw new IOException("Invalid image");
            }
            int i = 1;
            while (true) {
                int i2 = i * 2;
                if (Math.max(options.outWidth, options.outHeight) / i2 < MAX_PHOTO_SIDE) {
                    break;
                }
                i = i2;
            }
            BitmapFactory.Options options2 = new BitmapFactory.Options();
            options2.inSampleSize = i;
            options2.inPreferredConfig = Bitmap.Config.ARGB_8888;
            InputStream inputStreamOpenInputStream3 = getContentResolver().openInputStream(uri);
            if (inputStreamOpenInputStream3 == null) {
                throw new IOException("No image stream");
            }
            try {
                Bitmap bitmapDecodeStream = BitmapFactory.decodeStream(inputStreamOpenInputStream3, null, options2);
                closeQuietly(inputStreamOpenInputStream3);
                if (bitmapDecodeStream == null) {
                    throw new IOException("Cannot decode image");
                }
                Bitmap bitmapApplyOrientation = applyOrientation(bitmapDecodeStream, attributeInt);
                if (bitmapApplyOrientation != bitmapDecodeStream) {
                    bitmapDecodeStream.recycle();
                }
                int width = bitmapApplyOrientation.getWidth();
                int height = bitmapApplyOrientation.getHeight();
                float fMin = Math.min(1.0f, 1400.0f / Math.max(width, height));
                if (fMin < 1.0f) {
                    Bitmap bitmapCreateScaledBitmap = Bitmap.createScaledBitmap(bitmapApplyOrientation, Math.max(1, Math.round(width * fMin)), Math.max(1, Math.round(height * fMin)), true);
                    if (bitmapCreateScaledBitmap != bitmapApplyOrientation) {
                        bitmapApplyOrientation.recycle();
                    }
                    bitmapApplyOrientation = bitmapCreateScaledBitmap;
                }
                ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
                try {
                    bitmapApplyOrientation.compress(Bitmap.CompressFormat.JPEG, 80, byteArrayOutputStream);
                    byte[] byteArray = byteArrayOutputStream.toByteArray();
                    if (byteArray.length > 1843200) {
                        byteArrayOutputStream.reset();
                        bitmapApplyOrientation.compress(Bitmap.CompressFormat.JPEG, 62, byteArrayOutputStream);
                        byteArray = byteArrayOutputStream.toByteArray();
                    }
                    bitmapApplyOrientation.recycle();
                    if (byteArray.length == 0) {
                        throw new IOException("Compressed photo is empty");
                    }
                    String str = "data:image/jpeg;base64," + Base64.encodeToString(byteArray, 2);
                    closeQuietly(byteArrayOutputStream);
                    return str;
                } catch (Throwable th3) {
                    closeQuietly(byteArrayOutputStream);
                    throw th3;
                }
            } catch (Throwable th4) {
                closeQuietly(inputStreamOpenInputStream3);
                throw th4;
            }
        } catch (Throwable th5) {
            closeQuietly(inputStreamOpenInputStream2);
            throw th5;
        }
    }

    private Bitmap applyOrientation(Bitmap bitmap, int i) {
        Matrix matrix = new Matrix();
        switch (i) {
            case 2:
                matrix.postScale(-1.0f, 1.0f);
                break;
            case 3:
                matrix.postRotate(180.0f);
                break;
            case 4:
                matrix.postScale(1.0f, -1.0f);
                break;
            case 5:
                matrix.postRotate(90.0f);
                matrix.postScale(-1.0f, 1.0f);
                break;
            case 6:
                matrix.postRotate(90.0f);
                break;
            case 7:
                matrix.postRotate(-90.0f);
                matrix.postScale(-1.0f, 1.0f);
                break;
            case 8:
                matrix.postRotate(-90.0f);
                break;
            default:
                return bitmap;
        }
        try {
            return Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
        } catch (Exception e) {
            Log.w(TAG, "Cannot rotate photo", e);
            return bitmap;
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void sendPhotoResult(final String str, final String str2, final String str3) {
        this.mainHandler.post(new Runnable() { // from class: com.zptra.eldermedicine.MainActivity.11
            @Override // java.lang.Runnable
            public void run() {
                if (MainActivity.this.webView == null || MainActivity.this.isFinishing()) {
                    return;
                }
                try {
                    StringBuilder sbAppend = new StringBuilder().append("window.onNativePhotoResult(");
                    String str4 = str;
                    String str5 = "";
                    if (str4 == null) {
                        str4 = "";
                    }
                    StringBuilder sbAppend2 = sbAppend.append(JSONObject.quote(str4)).append(",");
                    String str6 = str2;
                    if (str6 == null) {
                        str6 = "";
                    }
                    StringBuilder sbAppend3 = sbAppend2.append(JSONObject.quote(str6)).append(",");
                    String str7 = str3;
                    if (str7 != null) {
                        str5 = str7;
                    }
                    MainActivity.this.webView.evaluateJavascript(sbAppend3.append(JSONObject.quote(str5)).append(");").toString(), null);
                } catch (Exception e) {
                    Log.e(MainActivity.TAG, "Cannot return photo to page", e);
                }
            }
        });
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void cleanupCameraUri(Uri uri) {
        if (uri == null) {
            return;
        }
        try {
            getContentResolver().delete(uri, null, null);
        } catch (Exception e) {
            Log.w(TAG, "Cannot delete temporary camera file", e);
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void openNotificationSettings() {
        try {
            Intent intent = new Intent("android.settings.APP_NOTIFICATION_SETTINGS");
            intent.putExtra("android.provider.extra.APP_PACKAGE", getPackageName());
            startActivity(intent);
        } catch (Exception e) {
            try {
                Intent intent2 = new Intent("android.settings.APPLICATION_DETAILS_SETTINGS");
                intent2.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent2);
            } catch (Exception e2) {
                Toast.makeText(this, "请在系统设置中允许通知", 1).show();
            }
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void callEmergency(String str) {
        String strReplaceAll = str != null ? str.replaceAll("[^+0-9]", "") : "";
        if (strReplaceAll.isEmpty()) {
            Toast.makeText(this, "请填写正确的紧急电话号码", 0).show();
        } else if (checkSelfPermission("android.permission.CALL_PHONE") != 0) {
            this.pendingEmergencyNumber = strReplaceAll;
            requestPermissions(new String[]{"android.permission.CALL_PHONE"}, REQUEST_CALL_PHONE);
        } else {
            dialEmergency(strReplaceAll, true);
        }
    }

    private void dialEmergency(String str, boolean z) {
        try {
            startActivity(new Intent(z ? "android.intent.action.CALL" : "android.intent.action.DIAL", Uri.parse("tel:" + str)));
        } catch (Exception e) {
            try {
                startActivity(new Intent("android.intent.action.DIAL", Uri.parse("tel:" + str)));
            } catch (Exception e2) {
                Toast.makeText(this, "无法打开拨号界面", 0).show();
            }
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public void openOfficialSearch(String str) {
        String strTrim = str == null ? "" : str.trim();
        if (strTrim.isEmpty()) {
            return;
        }
        try {
            startActivity(new Intent("android.intent.action.VIEW", Uri.parse("https://www.nmpa.gov.cn/datasearch/search-result.html?searchkey=" + Uri.encode(strTrim))));
        } catch (Exception e) {
            Toast.makeText(this, "无法打开联网查询页面", 0).show();
        }
    }

    /* JADX INFO: Access modifiers changed from: private */
    public boolean isOnline() {
        Network activeNetwork;
        NetworkCapabilities networkCapabilities;
        ConnectivityManager connectivityManager = (ConnectivityManager) getSystemService(ConnectivityManager.class);
        return (connectivityManager == null || (activeNetwork = connectivityManager.getActiveNetwork()) == null || (networkCapabilities = connectivityManager.getNetworkCapabilities(activeNetwork)) == null || !networkCapabilities.hasCapability(12)) ? false : true;
    }

    private static void closeQuietly(Closeable closeable) {
        if (closeable == null) {
            return;
        }
        try {
            closeable.close();
        } catch (IOException e) {
        }
    }

    @Override // android.app.Activity
    protected void onDestroy() {
        TextToSpeech textToSpeech = this.textToSpeech;
        if (textToSpeech != null) {
            try {
                textToSpeech.stop();
                this.textToSpeech.shutdown();
            } catch (Exception e) {
            }
            this.textToSpeech = null;
        }
        WebView webView = this.webView;
        if (webView != null) {
            webView.removeJavascriptInterface("Android");
            this.webView.stopLoading();
            this.webView.loadUrl("about:blank");
            this.webView.destroy();
            this.webView = null;
        }
        super.onDestroy();
    }

    private class WebAppBridge {
        private WebAppBridge() {
        }

        @JavascriptInterface
        public String getData() {
            return MedicineStore.read(MainActivity.this);
        }

        @JavascriptInterface
        public boolean saveData(String str) {
            return MedicineStore.write(MainActivity.this, str);
        }

        @JavascriptInterface
        public void syncReminders(String str) {
            ReminderScheduler.sync(MainActivity.this, str);
        }

        @JavascriptInterface
        public void speak(final String str) {
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.zptra.eldermedicine.MainActivity.WebAppBridge.1
                @Override // java.lang.Runnable
                public void run() {
                    MainActivity.this.speakOnUiThread(str);
                }
            });
        }

        @JavascriptInterface
        public void pickPhoto(final String str) {
            if (str == null || str.trim().isEmpty()) {
                return;
            }
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.zptra.eldermedicine.MainActivity.WebAppBridge.2
                @Override // java.lang.Runnable
                public void run() {
                    MainActivity.this.showPhotoOptions(str);
                }
            });
        }

        @JavascriptInterface
        public boolean areNotificationsAllowed() {
            return NotificationUtil.allowed(MainActivity.this);
        }

        @JavascriptInterface
        public void openNotificationSettings() {
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.zptra.eldermedicine.MainActivity.WebAppBridge.3
                @Override // java.lang.Runnable
                public void run() {
                    MainActivity.this.openNotificationSettings();
                }
            });
        }

        @JavascriptInterface
        public void callEmergency(final String str) {
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.zptra.eldermedicine.MainActivity.WebAppBridge.4
                @Override // java.lang.Runnable
                public void run() {
                    MainActivity.this.callEmergency(str);
                }
            });
        }

        @JavascriptInterface
        public void openOfficialSearch(final String str) {
            MainActivity.this.runOnUiThread(new Runnable() { // from class: com.zptra.eldermedicine.MainActivity.WebAppBridge.5
                @Override // java.lang.Runnable
                public void run() {
                    MainActivity.this.openOfficialSearch(str);
                }
            });
        }

        @JavascriptInterface
        public boolean isOnline() {
            return MainActivity.this.isOnline();
        }

        @JavascriptInterface
        public String getSetting(String str) {
            if (str == null || str.trim().isEmpty()) {
                return "";
            }
            return MainActivity.this.getSharedPreferences(MainActivity.SETTINGS_PREFS, 0).getString(str, "");
        }

        @JavascriptInterface
        public boolean setSetting(String str, String str2) {
            if (str == null || str.trim().isEmpty()) {
                return false;
            }
            SharedPreferences.Editor editorEdit = MainActivity.this.getSharedPreferences(MainActivity.SETTINGS_PREFS, 0).edit();
            if (str2 == null) {
                str2 = "";
            }
            editorEdit.putString(str, str2).apply();
            return true;
        }
    }
}
