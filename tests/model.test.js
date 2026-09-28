import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  normalizeDomain,
  readState,
  reduceState,
  buildRules,
  matchingSite,
} from "../src/model.js";
test("normalizes full URLs, casing, www, trailing dots and international domains", () => {
  assert.equal(
    normalizeDomain(" https://WWW.YouTube.com/watch?v=1 "),
    "youtube.com",
  );
  assert.equal(normalizeDomain("youtube.com."), "youtube.com");
  assert.equal(normalizeDomain("https://m.youtube.com:443/a"), "m.youtube.com");
  assert.equal(normalizeDomain("한글.kr"), "xn--bj0bj06e.kr");
});
test("rejects unsafe, malformed, credential and non-HTTP addresses", () => {
  for (const input of [
    "",
    "hello world",
    "chrome://settings",
    "file:///tmp/a",
    "https://a:b@example.com",
    "https://-bad.com",
    "http://*.example.com",
    "https://example..com",
    "youtube",
    "javascript:alert(1)",
  ])
    assert.throws(() => normalizeDomain(input), input);
});
test("matches subdomains without false positives in other domains or query strings", () => {
  const state = reduceState(defaults(), {
    type: "addSite",
    domain: "example.com",
  });
  for (const url of [
    "https://example.com",
    "http://sub.example.com:8080/path",
    "https://example.com./",
  ])
    assert.equal(matchingSite(state, url)?.domain, "example.com");
  for (const url of [
    "https://notexample.com",
    "https://example.com.evil.test",
    "https://good.test/?q=example.com",
    "file://example.com",
  ])
    assert.equal(matchingSite(state, url), null);
  assert.equal(
    matchingSite({ ...state, enabled: false }, "https://example.com"),
    null,
  );
});
test("generates top-level-only redirect rules and removes all when paused", () => {
  const state = reduceState(defaults(), {
    type: "addSite",
    domain: "youtube.com",
  });
  const rules = buildRules(state, "chrome-extension://id/blocked.html");
  assert.deepEqual(rules[0].condition, {
    requestDomains: ["youtube.com"],
    regexFilter: "^https?://",
    resourceTypes: ["main_frame"],
  });
  assert.equal(
    rules[0].action.redirect.url,
    "chrome-extension://id/blocked.html?site=youtube.com",
  );
  assert.deepEqual(buildRules({ ...state, enabled: false }, "url"), []);
  assert.deepEqual(
    buildRules(
      reduceState(state, {
        type: "toggleSite",
        domain: "youtube.com",
        enabled: false,
      }),
      "url",
    ),
    [],
  );
});
test("changes are immutable, deduplicated and validate text", () => {
  const initial = defaults();
  const state = reduceState(initial, {
    type: "addSite",
    domain: "www.youtube.com",
  });
  assert.equal(initial.sites.length, 0);
  assert.throws(() =>
    reduceState(state, {
      type: "addSite",
      domain: "https://youtube.com/watch",
    }),
  );
  assert.throws(() =>
    reduceState(state, { type: "saveMessage", message: "   " }),
  );
  assert.throws(() =>
    reduceState(state, { type: "saveMessage", message: "a".repeat(241) }),
  );
  assert.equal(
    reduceState(state, {
      type: "saveMessage",
      message: " <script>hello</script> ",
    }).message,
    "<script>hello</script>",
  );
  assert.equal(
    reduceState(state, { type: "removeSite", domain: "youtube.com" }).sites
      .length,
    0,
  );
});
test("validates stored settings and preserves defaults on first run only", () => {
  assert.deepEqual(readState(undefined), defaults());
  assert.deepEqual(readState(defaults()), defaults());
  for (const value of [
    null,
    { ...defaults(), enabled: "true" },
    { ...defaults(), version: 2 },
    { ...defaults(), sites: [{ domain: "bad", enabled: true }] },
  ])
    assert.throws(() => readState(value));
});
test("specific subdomain wins over a broad parent domain", () => {
  let state = reduceState(defaults(), {
    type: "addSite",
    domain: "example.com",
  });
  state = reduceState(state, { type: "addSite", domain: "news.example.com" });
  assert.equal(
    matchingSite(state, "https://news.example.com/story").domain,
    "news.example.com",
  );
  const rules = buildRules(state, "chrome-extension://id/blocked.html");
  assert.equal(rules[0].condition.requestDomains[0], "news.example.com");
  assert.ok(rules[0].priority > rules[1].priority);
});
