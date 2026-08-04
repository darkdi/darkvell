package ru.darkvell.game;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final String TAG = "DarkVell";
    private static final String GAME_URL = "https://darkvell.ru/?source=rustore&apk=0.1.2";
    private static final int BACKGROUND_COLOR = Color.rgb(16, 19, 18);
    private static final int TEXT_COLOR = Color.rgb(238, 242, 239);
    private static final int MUTED_TEXT_COLOR = Color.rgb(148, 163, 154);
    private static final int ACCENT_COLOR = Color.rgb(250, 204, 21);
    private static final long RENDERER_RECOVERY_WINDOW_MS = 60000L;
    private static final int MAX_RENDERER_RECOVERIES_IN_WINDOW = 2;
    private WebView webView;
    private int rendererRecoveries;
    private long firstRendererRecoveryAtMs;
    private boolean mainPageFailed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        try {
            configureWindow();
            startGameWebView();
        } catch (Throwable error) {
            Log.e(TAG, "Activity startup failed.", error);
            showStatusView("DarkVell", "WebView startup failed.", true, true);
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(BACKGROUND_COLOR);
        webView.setWebViewClient(new DarkVellWebViewClient());
        webView.setWebChromeClient(new DarkVellWebChromeClient());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_BOUND, true);
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " DarkVellRuStore/0.1.2");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
    }

    private void startGameWebView() {
        try {
            destroyWebView(webView);
            webView = null;
            mainPageFailed = false;
            showStatusView("DarkVell", "Loading game...", false, false);
            configureWebView();
            webView.loadUrl(GAME_URL);
        } catch (Throwable error) {
            Log.e(TAG, "WebView startup failed.", error);
            destroyWebView(webView);
            webView = null;
            showStatusView("DarkVell", "WebView startup failed.", true, true);
        }
    }

    private void recoverWebView(WebView crashedWebView) {
        if (isFinishing() || isDestroyed() || crashedWebView != webView) {
            destroyWebView(crashedWebView);
            return;
        }

        long now = SystemClock.elapsedRealtime();
        if (now - firstRendererRecoveryAtMs > RENDERER_RECOVERY_WINDOW_MS) {
            firstRendererRecoveryAtMs = now;
            rendererRecoveries = 0;
        }
        rendererRecoveries += 1;

        webView = null;
        destroyWebView(crashedWebView);
        if (rendererRecoveries > MAX_RENDERER_RECOVERIES_IN_WINDOW) {
            Log.e(TAG, "WebView renderer restarted too often.");
            showStatusView("DarkVell", "Game renderer restarted too often.", true, true);
            return;
        }

        startGameWebView();
    }

    private void destroyWebView(WebView view) {
        if (view == null) {
            return;
        }

        try {
            ViewParent parent = view.getParent();
            if (parent instanceof ViewGroup) {
                ((ViewGroup) parent).removeView(view);
            }
            view.stopLoading();
            view.setWebChromeClient(null);
            view.setWebViewClient(null);
            view.removeAllViews();
            view.destroy();
        } catch (Throwable ignored) {
            // A renderer process can die while Android is also tearing WebView down.
        }
    }

    private void showStatusView(String title, String message, boolean showRetry, boolean showBrowser) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(dp(24), dp(24), dp(24), dp(24));
        layout.setBackgroundColor(BACKGROUND_COLOR);

        TextView titleView = new TextView(this);
        titleView.setText(title);
        titleView.setTextColor(TEXT_COLOR);
        titleView.setTextSize(26);
        titleView.setGravity(Gravity.CENTER);
        titleView.setIncludeFontPadding(false);
        layout.addView(titleView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        TextView messageView = new TextView(this);
        messageView.setText(message);
        messageView.setTextColor(MUTED_TEXT_COLOR);
        messageView.setTextSize(15);
        messageView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        messageParams.setMargins(0, dp(12), 0, showRetry || showBrowser ? dp(18) : 0);
        layout.addView(messageView, messageParams);

        if (showRetry) {
            Button retryButton = createStatusButton("Retry");
            retryButton.setOnClickListener(view -> startGameWebView());
            layout.addView(retryButton, buttonLayoutParams());
        }

        if (showBrowser) {
            Button browserButton = createStatusButton("Open darkvell.ru");
            browserButton.setOnClickListener(view -> openExternalUrl(Uri.parse("https://darkvell.ru/")));
            layout.addView(browserButton, buttonLayoutParams());
        }

        setContentView(layout);
        hideSystemUi();
    }

    private Button createStatusButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(Color.rgb(17, 24, 19));
        button.setBackgroundColor(ACCENT_COLOR);
        return button;
    }

    private LinearLayout.LayoutParams buttonLayoutParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(220), dp(48));
        params.setMargins(0, dp(8), 0, 0);
        return params;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void configureWindow() {
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }
        hideSystemUi();
    }

    private void hideSystemUi() {
        View decorView = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = decorView.getWindowInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
            return;
        }

        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUi();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
        hideSystemUi();
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        destroyWebView(webView);
        webView = null;
        super.onDestroy();
    }

    private final class DarkVellWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return openExternallyIfNeeded(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return openExternallyIfNeeded(Uri.parse(url));
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel();
        }

        @Override
        @TargetApi(Build.VERSION_CODES.O)
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            Log.e(TAG, "WebView renderer process gone. didCrash=" + detail.didCrash());
            recoverWebView(view);
            return true;
        }

        private boolean openExternallyIfNeeded(Uri uri) {
            if (uri == null) {
                return false;
            }

            String scheme = uri.getScheme();
            String host = uri.getHost();
            boolean isWeb = "https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme);
            boolean isDarkVell = host != null && (host.equals("darkvell.ru") || host.endsWith(".darkvell.ru"));
            if (isWeb && isDarkVell) {
                return false;
            }

            return openExternalUrl(uri);
        }

        @Override
        public void onPageCommitVisible(WebView view, String url) {
            if (view == webView && !mainPageFailed) {
                setContentView(view);
                hideSystemUi();
            }
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
            if (view == webView && request.isForMainFrame()) {
                Log.e(TAG, "Main frame WebView error: " + error.getErrorCode() + " " + error.getDescription());
                mainPageFailed = true;
                showStatusView("DarkVell", "Network error. Try again.", true, true);
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            if (view == webView && request.isForMainFrame()) {
                Log.e(TAG, "Main frame HTTP error: " + errorResponse.getStatusCode());
                mainPageFailed = true;
                showStatusView("DarkVell", "Server error. Try again.", true, true);
            }
        }
    }

    private final class DarkVellWebChromeClient extends WebChromeClient {
        @Override
        public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
            return true;
        }
    }

    private boolean openExternalUrl(Uri uri) {
        if (uri == null) {
            return false;
        }

        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(intent);
        } catch (ActivityNotFoundException | IllegalArgumentException | SecurityException ignored) {
            return false;
        }
        return true;
    }
}
