package expo.modules.latchopenpathtransport;

import okhttp3.OkHttpClient;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.tls.HandshakeCertificates;
import okhttp3.tls.HeldCertificate;
import org.junit.Test;
import static org.junit.Assert.*;

public class OpenpathHttpTest {
  @Test public void defaultTlsRejectsAnUntrustedCertificateBeforeHttpTransmission() throws Exception {
    HeldCertificate certificate = new HeldCertificate.Builder().addSubjectAlternativeName("localhost").build();
    HandshakeCertificates serverTls = new HandshakeCertificates.Builder().heldCertificate(certificate).build();
    try (MockWebServer server = new MockWebServer()) {
      server.useHttps(serverTls.sslSocketFactory(), false);
      server.enqueue(new MockResponse().setBody("{}"));
      OpenpathHttp transport = new OpenpathHttp(new OkHttpClient(), server.url("/"));
      try {
        transport.execute("tls-1", "POST", "/auth/login", null, "{\"password\":\"fixture\"}");
        fail("Untrusted certificate must be rejected");
      } catch (javax.net.ssl.SSLHandshakeException expected) { }
      assertEquals(0, server.getRequestCount());
    }
  }

  @Test public void invalidAuthorizationNeverAppearsInANativeHeaderError() throws Exception {
    try (MockWebServer server = new MockWebServer()) {
      OpenpathHttp transport = new OpenpathHttp(new OkHttpClient(), server.url("/"));
      try {
        transport.execute("invalid-token-1", "GET", "/orgs/31/users/42", "fixture-secret\nheader", null);
        fail("Invalid authorization must not dispatch");
      } catch (java.io.IOException expected) {
        assertFalse(expected.toString().contains("fixture-secret"));
      }
      assertEquals(0, server.getRequestCount());
    }
  }

  @Test public void stoppedQueuedWorkCannotSendLater() throws Exception {
    try (MockWebServer server = new MockWebServer()) {
      server.enqueue(new MockResponse().setBody("{}"));
      OpenpathHttp transport = new OpenpathHttp(new OkHttpClient(), server.url("/"));
      transport.cancel("queued-1");
      try { transport.execute("queued-1", "GET", "/orgs/31/users/42", "fixture-jwt", null); fail("Cancelled work must not dispatch"); }
      catch (java.io.IOException expected) { }
      transport.close();
      try { transport.execute("queued-2", "GET", "/orgs/31/users/42", "fixture-jwt", null); fail("Destroyed client must not dispatch"); }
      catch (java.io.IOException expected) { }
      assertEquals(0, server.getRequestCount());
    }
  }

  @Test public void aNativeCallHasItsOwnFifteenSecondDeadline() throws Exception {
    try (MockWebServer server = new MockWebServer()) {
      // Bytes keep arriving within the read timeout: only the total call deadline
      // can bound this response, even without a running JavaScript timer.
      server.enqueue(new MockResponse().setBody("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
        .throttleBody(1, 500, java.util.concurrent.TimeUnit.MILLISECONDS));
      OpenpathHttp transport = new OpenpathHttp(new OkHttpClient(), server.url("/"));
      long started = System.nanoTime();
      try {
        transport.execute("timeout-1", "GET", "/orgs/31/users/42", "fixture-jwt", null);
        fail("Unanswered request must time out");
      } catch (java.io.IOException expected) { }
      long elapsed = java.util.concurrent.TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
      assertTrue("Native deadline should bound the call", elapsed >= 14000 && elapsed < 18000);
      assertEquals(1, server.getRequestCount());
    }
  }

  @Test public void cancellationStopsABlockedCallWithoutRetry() throws Exception {
    java.util.concurrent.ExecutorService worker = java.util.concurrent.Executors.newSingleThreadExecutor();
    try (MockWebServer server = new MockWebServer()) {
      server.enqueue(new MockResponse().setSocketPolicy(okhttp3.mockwebserver.SocketPolicy.NO_RESPONSE));
      OpenpathHttp transport = new OpenpathHttp(new OkHttpClient(), server.url("/"));
      java.util.concurrent.Future<?> pending = worker.submit(() -> {
        try { transport.execute("cancel-1", "GET", "/orgs/31/users/42", "fixture-jwt", null); }
        catch (java.io.IOException expected) { return; }
        fail("A cancelled request must fail");
      });
      assertNotNull(server.takeRequest(2, java.util.concurrent.TimeUnit.SECONDS));
      transport.cancel("cancel-1");
      pending.get(2, java.util.concurrent.TimeUnit.SECONDS);
      assertEquals(1, server.getRequestCount());
    } finally { worker.shutdownNow(); }
  }

  @Test public void oversizedResponsesAreNotBufferedWithoutLimit() throws Exception {
    try (MockWebServer server = new MockWebServer()) {
      char[] oversized = new char[1_048_577];
      java.util.Arrays.fill(oversized, 'x');
      server.enqueue(new MockResponse().setBody(new String(oversized)));
      OpenpathHttp transport = new OpenpathHttp(new OkHttpClient(), server.url("/"));
      try {
        transport.execute("large-1", "GET", "/orgs/31/users/42", "fixture-jwt", null);
        fail("Response must be bounded");
      } catch (java.io.IOException expected) { }
    }
  }

  @Test public void onlyKnownApiRoutesCanBeSent() throws Exception {
    try (MockWebServer server = new MockWebServer()) {
      server.enqueue(new MockResponse().setBody("{}"));
      OpenpathHttp transport = new OpenpathHttp(new OkHttpClient(), server.url("/"));
      try {
        transport.execute("invalid-1", "GET", "/unrelated", "fixture-jwt", null);
        fail("An unrelated route must be rejected");
      } catch (java.io.IOException expected) { }
      assertEquals(0, server.getRequestCount());
    }
  }

  @Test public void readsAlsoHaveOnlyOneNetworkExchange() throws Exception {
    try (MockWebServer server = new MockWebServer()) {
      server.enqueue(new MockResponse().setResponseCode(503).addHeader("Retry-After", "0"));
      server.enqueue(new MockResponse().setResponseCode(200).setBody("{}"));
      OpenpathHttp transport = new OpenpathHttp(new OkHttpClient(), server.url("/"));
      try { transport.execute("read-1", "GET", "/orgs/31/users/42", "fixture-jwt", null); }
      catch (java.io.IOException expected) { /* hidden follow-up must be stopped before transmission */ }
      assertEquals(1, server.getRequestCount());
      assertEquals("fixture-jwt", server.takeRequest().getHeader("Authorization"));
    }
  }

  @Test public void retryAfterZeroDoesNotReplayAnUnlock() throws Exception {
    try (MockWebServer server = new MockWebServer()) {
      server.enqueue(new MockResponse().setResponseCode(503).addHeader("Retry-After", "0"));
      server.enqueue(new MockResponse().setResponseCode(204));
      OpenpathHttp transport = new OpenpathHttp(new OkHttpClient(), server.url("/"));
      assertEquals(503, transport.execute("test-2", "POST", "/orgs/31/users/42/credentials/71/cloudKeyEntryUnlock", "fixture-jwt", "{\"entryId\":90}").get("status"));
      assertEquals(1, server.getRequestCount());
    }
  }

  @Test public void redirectDoesNotForwardCredentials() throws Exception {
    HeldCertificate certificate = new HeldCertificate.Builder().addSubjectAlternativeName("localhost").build();
    HandshakeCertificates serverTls = new HandshakeCertificates.Builder().heldCertificate(certificate).build();
    HandshakeCertificates clientTls = new HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate()).build();
    try (MockWebServer server = new MockWebServer(); MockWebServer destination = new MockWebServer()) {
      server.useHttps(serverTls.sslSocketFactory(), false);
      server.enqueue(new MockResponse().setResponseCode(307).addHeader("Location", destination.url("/stolen")));
      OkHttpClient client = new OkHttpClient.Builder().sslSocketFactory(clientTls.sslSocketFactory(), clientTls.trustManager()).build();
      OpenpathHttp transport = new OpenpathHttp(client, server.url("/"));
      assertEquals(307, transport.execute("test-1", "POST", "/auth/login", null, "{\"password\":\"fixture\"}").get("status"));
      assertEquals(1, server.getRequestCount());
      assertEquals(0, destination.getRequestCount());
    }
  }
}
