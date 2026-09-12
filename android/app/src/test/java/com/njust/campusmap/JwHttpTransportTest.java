package com.njust.campusmap;

import static org.junit.Assert.*;
import java.net.CookieHandler;
import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import mockwebserver3.MockResponse;
import mockwebserver3.MockWebServer;
import mockwebserver3.RecordedRequest;
import org.junit.Test;

public class JwHttpTransportTest {
    @Test
    public void onlyExplicitSessionCookiesAreSentAndNothingReachesGlobalStore() throws Exception {
        CookieHandler original = CookieHandler.getDefault();
        AtomicInteger globalReads = new AtomicInteger();
        AtomicInteger globalWrites = new AtomicInteger();
        CookieHandler.setDefault(new CookieHandler() {
            public Map<String, List<String>> get(URI uri, Map<String, List<String>> headers) {
                globalReads.incrementAndGet();
                return Collections.singletonMap("Cookie", Collections.singletonList("JSESSIONID=stale-webview"));
            }
            public void put(URI uri, Map<String, List<String>> headers) { globalWrites.incrementAndGet(); }
        });
        try (MockWebServer server = new MockWebServer(); JwHttpTransport transport = new JwHttpTransport()) {
            server.start();
            server.enqueue(new MockResponse.Builder().addHeader("Set-Cookie", "JSESSIONID=school; Path=/").body("form").build());
            server.enqueue(new MockResponse.Builder().body("image").build());
            server.enqueue(new MockResponse.Builder().body("fresh form").build());
            String url = server.url("/login").toString();
            JwHttpTransport.Result first = transport.request(url, "GET", "", "");
            assertEquals(Collections.singletonList("JSESSIONID=school; Path=/"), first.cookies);
            assertEquals("", server.takeRequest(2, TimeUnit.SECONDS).getHeaders().get("Cookie"));
            transport.request(url, "GET", "", "JSESSIONID=explicit");
            assertEquals("JSESSIONID=explicit", server.takeRequest(2, TimeUnit.SECONDS).getHeaders().get("Cookie"));
            transport.request(url, "GET", "", "");
            assertEquals("", server.takeRequest(2, TimeUnit.SECONDS).getHeaders().get("Cookie"));
            assertEquals(0, globalReads.get());
            assertEquals(0, globalWrites.get());
        } finally { CookieHandler.setDefault(original); }
    }

    @Test
    public void returnsRedirectWithoutReplayingPasswordAndPreservesEncodedBody() throws Exception {
        try (MockWebServer server = new MockWebServer(); JwHttpTransport transport = new JwHttpTransport()) {
            server.start();
            server.enqueue(new MockResponse.Builder().code(307).addHeader("Location", "/other").body("").build());
            String form = "username=fixture&password=A%2BB%2F%3D&captcha=aB12";
            JwHttpTransport.Result result = transport.request(server.url("/login").toString(), "POST", form, "sid=fixture");
            assertEquals(307, result.status);
            assertEquals("/other", result.location);
            RecordedRequest request = server.takeRequest(2, TimeUnit.SECONDS);
            assertEquals(form, request.getBody().utf8());
            assertEquals(1, server.getRequestCount());
        }
    }
}
