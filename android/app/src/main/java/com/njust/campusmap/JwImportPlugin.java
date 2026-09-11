package com.njust.campusmap;

import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "JwImport")
public class JwImportPlugin extends Plugin {
    private final ExecutorService requests = Executors.newSingleThreadExecutor();

    @Override
    protected void handleOnDestroy() { requests.shutdownNow(); }

    @PluginMethod
    public void request(PluginCall call) {
        requests.execute(() -> {
            HttpURLConnection connection = null;
            try {
                String raw = call.getString("url", "");
                String method = call.getString("method", "GET");
                String body = call.getString("body", "");
                String cookie = call.getString("cookie", "");
                URL url = new URL(raw);
                boolean login = url.getHost().equals("202.119.81.112") && url.getPort() == 8080;
                boolean table = Arrays.asList("202.119.81.112", "202.119.81.113").contains(url.getHost()) && url.getPort() == 9080;
                List<String> paths = login
                    ? Arrays.asList("/Logon.do", "/verifycode.servlet", "/framework/main.jsp", "/framework/Main.jsp")
                    : Arrays.asList("/njlgdx/xk/LoginToXk", "/njlgdx/xk/Verifyservlet", "/njlgdx/verifycode.servlet", "/njlgdx/framework/main.jsp", "/njlgdx/xskb/xskb_list.do", "/njlgdx/xskb/xskb_print.do");
                if (!url.getProtocol().equals("http") || !(login || table) || !paths.contains(url.getPath()) || url.getUserInfo() != null || url.getRef() != null || raw.length() > 4096 || raw.toLowerCase().matches(".*(exit|logout|delete).*")) throw new Exception();
                if (!Arrays.asList("GET", "POST").contains(method) || body.length() > 8192 || cookie.length() > 8192 || cookie.contains("\r") || cookie.contains("\n")) throw new Exception();
                if (method.equals("POST") && !Arrays.asList("/Logon.do", "/njlgdx/xk/LoginToXk", "/njlgdx/xk/Verifyservlet", "/njlgdx/xskb/xskb_list.do", "/njlgdx/xskb/xskb_print.do").contains(url.getPath())) throw new Exception();
                connection = (HttpURLConnection) url.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(20000);
                connection.setReadTimeout(20000);
                connection.setUseCaches(false);
                connection.setRequestMethod(method);
                connection.setRequestProperty("Cookie", cookie);
                connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                if (method.equals("POST")) {
                    connection.setDoOutput(true);
                    try (java.io.OutputStream out = connection.getOutputStream()) { out.write(body.getBytes(StandardCharsets.UTF_8)); }
                }
                int status = connection.getResponseCode();
                JSArray cookies = new JSArray();
                for (Map.Entry<String, List<String>> entry : connection.getHeaderFields().entrySet()) {
                    if (entry.getKey() != null && entry.getKey().equalsIgnoreCase("Set-Cookie")) for (String value : entry.getValue()) cookies.put(value);
                }
                ByteArrayOutputStream data = new ByteArrayOutputStream();
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                if (stream != null) try (InputStream input = stream) {
                    byte[] buffer = new byte[8192];
                    int n;
                    while ((n = input.read(buffer)) != -1) {
                        if (data.size() + n > 5 * 1024 * 1024) throw new Exception();
                        data.write(buffer, 0, n);
                    }
                }
                JSObject result = new JSObject();
                result.put("status", status);
                result.put("contentType", connection.getContentType() == null ? "" : connection.getContentType());
                result.put("location", connection.getHeaderField("Location") == null ? "" : connection.getHeaderField("Location"));
                result.put("cookies", cookies);
                result.put("data", Base64.encodeToString(data.toByteArray(), Base64.NO_WRAP));
                call.resolve(result);
            } catch (Exception error) {
                call.reject("暂时无法连接教务系统，请检查校园网或稍后重试。");
            } finally { if (connection != null) connection.disconnect(); }
        });
    }
}
