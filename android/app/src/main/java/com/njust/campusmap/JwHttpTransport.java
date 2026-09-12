package com.njust.campusmap;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.TimeUnit;
import okhttp3.CookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

/** Transport only. JwImportPlugin validates destinations; JwSession owns cookies. */
final class JwHttpTransport implements AutoCloseable {
    private static final int MAX_RESPONSE = 5 * 1024 * 1024;
    private static final MediaType FORM = MediaType.get("application/x-www-form-urlencoded");
    private final OkHttpClient client = new OkHttpClient.Builder()
        // HttpURLConnection consults Capacitor's global WebView CookieHandler.
        // This client never reads or writes that persistent, application-wide jar.
        .cookieJar(CookieJar.NO_COOKIES)
        .followRedirects(false)
        .followSslRedirects(false)
        .retryOnConnectionFailure(false)
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(25, TimeUnit.SECONDS)
        .build();

    static final class Result {
        final int status;
        final String contentType;
        final String location;
        final List<String> cookies;
        final byte[] data;

        Result(int status, String contentType, String location, List<String> cookies, byte[] data) {
            this.status = status;
            this.contentType = contentType;
            this.location = location;
            this.cookies = cookies;
            this.data = data;
        }
    }

    Result request(String url, String method, String body, String cookie) throws IOException {
        Request.Builder builder = new Request.Builder().url(url)
            .header("Cookie", cookie)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("Cache-Control", "no-store");
        if (method.equals("POST")) builder.post(RequestBody.create(body.getBytes(StandardCharsets.UTF_8), FORM));
        else builder.get();
        try (Response response = client.newCall(builder.build()).execute()) {
            ByteArrayOutputStream data = new ByteArrayOutputStream();
            ResponseBody responseBody = response.body();
            if (responseBody != null) {
                if (responseBody.contentLength() > MAX_RESPONSE) throw new IOException("Response too large");
                try (InputStream input = responseBody.byteStream()) {
                    byte[] buffer = new byte[8192];
                    int n;
                    while ((n = input.read(buffer)) != -1) {
                        if (data.size() + n > MAX_RESPONSE) throw new IOException("Response too large");
                        data.write(buffer, 0, n);
                    }
                }
            }
            return new Result(response.code(), response.header("Content-Type", ""),
                response.header("Location", ""), response.headers("Set-Cookie"), data.toByteArray());
        }
    }

    @Override
    public void close() {
        client.dispatcher().cancelAll();
        client.connectionPool().evictAll();
        client.dispatcher().executorService().shutdown();
    }
}
