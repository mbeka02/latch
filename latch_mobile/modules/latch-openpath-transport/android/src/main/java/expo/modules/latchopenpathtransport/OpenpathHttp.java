package expo.modules.latchopenpathtransport;

import java.io.IOException;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.atomic.AtomicInteger;
import okhttp3.*;
import okio.BufferedSink;

/** Isolated client: never uses React Native's cookies or debugging interceptors. */
public final class OpenpathHttp {
  private static final ScheduledThreadPoolExecutor DEADLINES = new ScheduledThreadPoolExecutor(1, work -> {
    Thread thread = new Thread(work, "latch-request-deadline");
    thread.setDaemon(true);
    return thread;
  });
  static { DEADLINES.setRemoveOnCancelPolicy(true); }
  private final OkHttpClient client;
  private final HttpUrl origin;
  private final Map<String, Call> calls = new HashMap<>();
  private final Set<String> cancelled = new LinkedHashSet<>();
  private boolean closed;

  public OpenpathHttp() { this(new OkHttpClient(), HttpUrl.get("https://api.openpath.com/")); }

  // Package-private injection for local TLS contract fixtures only. Not bridged.
  OpenpathHttp(OkHttpClient base, HttpUrl origin) {
    this.origin = origin;
    this.client = base.newBuilder().followRedirects(false).followSslRedirects(false)
      .retryOnConnectionFailure(false)
      .callTimeout(15, TimeUnit.SECONDS)
      .cookieJar(CookieJar.NO_COOKIES).cache(null)
      .authenticator(Authenticator.NONE).proxyAuthenticator(Authenticator.NONE)
      .addNetworkInterceptor(chain -> {
        AtomicInteger budget = chain.request().tag(AtomicInteger.class);
        if (budget == null || budget.incrementAndGet() != 1) throw new IOException("Request cannot be repeated");
        return chain.proceed(chain.request());
      }).build();
  }

  public Map<String, Object> execute(String requestId, String method, String path, String token, String json) throws IOException {
    String user = "/orgs/[1-9][0-9]*/users/[1-9][0-9]*";
    boolean login = method.equals("POST") && path.equals("/auth/login");
    boolean read = method.equals("GET") && (path.matches(user) || path.matches(user + "/entries") ||
      path.matches(user + "/credentials\\?limit=100&offset=[0-9]+&sort=id&order=asc"));
    boolean unlock = method.equals("POST") && path.matches(user + "/credentials/[1-9][0-9]*/cloudKeyEntryUnlock");
    if (path.length() > 256 || !(login || read || unlock) || (login && token != null) ||
      (!login && (token == null || token.length() > 65536 || !token.matches("[A-Za-z0-9._~-]+"))) || (read && json != null) ||
      (!read && (json == null || json.length() > 65536))) throw new IOException("Unsupported request");
    Request.Builder builder = new Request.Builder().url(origin.resolve(path)).tag(AtomicInteger.class, new AtomicInteger());
    if (token != null) builder.header("Authorization", token);
    final RequestBody content = json == null ? null : RequestBody.create(json, MediaType.get("application/json; charset=utf-8"));
    builder.method(method, content == null ? null : new RequestBody() {
      @Override public MediaType contentType() { return content.contentType(); }
      @Override public long contentLength() throws IOException { return content.contentLength(); }
      @Override public boolean isOneShot() { return true; }
      @Override public void writeTo(BufferedSink sink) throws IOException { content.writeTo(sink); }
    });
    Call call = client.newCall(builder.build());
    synchronized (calls) {
      if (closed) throw new IOException("Client is closed");
      if (cancelled.remove(requestId)) throw new IOException("Request cancelled before dispatch");
      if (calls.containsKey(requestId)) throw new IOException("Duplicate request handle");
      calls.put(requestId, call);
    }
    // Independent of JS and OkHttp/Okio's own timeout implementation.
    ScheduledFuture<?> deadline = DEADLINES.schedule(call::cancel, 15, TimeUnit.SECONDS);
    try (Response response = call.execute()) {
      Map<String, Object> result = new HashMap<>();
      result.put("status", response.code());
      ResponseBody body = response.body();
      if (body != null && body.source().request(1_048_577)) throw new IOException("Response exceeds limit");
      result.put("body", body == null ? "" : body.source().readUtf8());
      return result;
    } finally {
      deadline.cancel(false);
      synchronized (calls) { calls.remove(requestId); }
    }
  }

  public void cancel(String requestId) {
    synchronized (calls) {
      Call call = calls.get(requestId);
      if (call != null) call.cancel();
      else {
        cancelled.add(requestId);
        if (cancelled.size() > 256) cancelled.remove(cancelled.iterator().next());
      }
    }
  }

  public void close() {
    synchronized (calls) { closed = true; for (Call call : calls.values()) call.cancel(); cancelled.clear(); }
    client.connectionPool().evictAll();
  }
}
