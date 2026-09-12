package com.njust.campusmap;

import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URL;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "JwImport")
public class JwImportPlugin extends Plugin {
    private final JwHttpTransport transport = new JwHttpTransport();
    private final ExecutorService requests = Executors.newSingleThreadExecutor();

    @Override
    protected void handleOnDestroy() { requests.shutdownNow(); transport.close(); }

    @PluginMethod
    public void request(PluginCall call) {
        requests.execute(() -> {
            try {
                String raw = call.getString("url", "");
                String method = call.getString("method", "GET");
                String body = call.getString("body", "");
                String cookie = call.getString("cookie", "");
                URL url = new URL(raw);
                boolean https = url.getProtocol().equals("https") && (url.getPort() == -1 || url.getPort() == 443);
                boolean http = url.getProtocol().equals("http") && (url.getPort() == -1 || url.getPort() == 80);
                boolean ids = https && url.getHost().equals("ids.njust.edu.cn");
                boolean hall = https && url.getHost().equals("ehall2.njust.edu.cn");
                boolean table = (https || http) && url.getHost().equals("bkjw.njust.edu.cn");
                List<String> paths = ids
                    ? Arrays.asList("/authserver/login", "/authserver/getCaptcha.htl")
                    : hall ? Arrays.asList("/login", "/", "/index.html", "/new/index.html")
                    : Arrays.asList("/njlgdx/indexsso.jsp", "/njlgdx/xk/LoginToXk", "/njlgdx/framework/main.jsp", "/njlgdx/xskb/xskb_list.do", "/njlgdx/xskb/xskb_print.do");
                if (!(ids || hall || table) || !paths.contains(url.getPath()) || url.getUserInfo() != null || url.getRef() != null || raw.length() > 4096 || (url.getQuery() != null && url.getQuery().toLowerCase(java.util.Locale.ROOT).matches(".*(exit|logout|delete).*"))) throw new Exception();
                if (url.getQuery() != null) for (String pair : url.getQuery().split("&")) {
                    String[] parts = pair.split("=", 2);
                    if (java.net.URLDecoder.decode(parts[0], "UTF-8").equals("service")) {
                        String service = parts.length == 2 ? java.net.URLDecoder.decode(parts[1], "UTF-8") : "";
                        if (!Arrays.asList("https://ehall2.njust.edu.cn/login", "http://bkjw.njust.edu.cn/njlgdx/indexsso.jsp", "https://bkjw.njust.edu.cn/njlgdx/indexsso.jsp", "http://bkjw.njust.edu.cn/njlgdx/framework/main.jsp", "https://bkjw.njust.edu.cn/njlgdx/framework/main.jsp", "http://bkjw.njust.edu.cn/njlgdx/xk/LoginToXk", "https://bkjw.njust.edu.cn/njlgdx/xk/LoginToXk").contains(service)) throw new Exception();
                    }
                }
                if (!Arrays.asList("GET", "POST").contains(method) || body.length() > 8192 || cookie.length() > 8192 || cookie.contains("\r") || cookie.contains("\n") || (method.equals("GET") && !body.isEmpty())) throw new Exception();
                if (method.equals("POST") && !Arrays.asList("/authserver/login", "/njlgdx/xk/LoginToXk", "/njlgdx/xskb/xskb_list.do", "/njlgdx/xskb/xskb_print.do").contains(url.getPath())) throw new Exception();
                JwHttpTransport.Result response = transport.request(raw, method, body, cookie);
                JSArray cookies = new JSArray();
                for (String value : response.cookies) cookies.put(value);
                JSObject result = new JSObject();
                result.put("status", response.status);
                result.put("contentType", response.contentType);
                result.put("location", response.location);
                result.put("cookies", cookies);
                result.put("data", Base64.encodeToString(response.data, Base64.NO_WRAP));
                call.resolve(result);
            } catch (Exception error) {
                call.reject("暂时无法连接教务系统，请检查校园网或稍后重试。");
            }
        });
    }
}
