import { chromium, expect } from "@playwright/test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "node:http";
import assert from "node:assert/strict";
const extension = resolve(".");
const profile = await mkdtemp(join(tmpdir(), "maeum-focus-test-"));
await mkdir("test-results", { recursive: true });
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(
    "<!doctype html><title>Allowed test page</title><h1>Allowed local site</h1>",
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1440, height: 1100 },
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      "--host-resolver-rules=MAP *.test 127.0.0.1",
      "--no-proxy-server",
    ],
  });
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const id = new URL(worker.url()).host;
  const base = `chrome-extension://${id}`;
  const options = await context.newPage();
  const errors = [];
  options.on("pageerror", (error) => errors.push(error.message));
  await options.goto(`${base}/options.html`);
  await expect(
    options.getByRole("checkbox", { name: "집중 모드", exact: true }),
  ).toBeEnabled();
  await expect(
    options.getByText("내 시간을 지켜줄 첫 번째 경계"),
  ).toBeVisible();
  const target = await context.newPage();
  await target.goto(`http://example.test:${port}/`);
  await expect(
    target.getByRole("heading", { name: "Allowed local site" }),
  ).toBeVisible();
  await options
    .getByRole("textbox", { name: "다시 집중할 나에게", exact: true })
    .fill("잠깐, 지금 하려던 일이 뭐였지?\n딱 하나만 마무리하고 돌아오자.");
  await options.getByRole("button", { name: "문구 저장하기" }).click();
  await expect(
    options.getByText("저장된 문장이에요", { exact: true }),
  ).toBeVisible();
  await options
    .getByRole("textbox", { name: "차단할 사이트 주소" })
    .fill("https://www.example.test/watch");
  await options.getByRole("button", { name: "+ 추가", exact: true }).click();
  await expect(
    options.getByText("example.test", { exact: true }),
  ).toBeVisible();
  await expect(target).toHaveURL(`${base}/blocked.html?site=example.test`);
  await expect(target.getByRole("heading")).toHaveText(
    "잠깐, 지금 하려던 일이 뭐였지?\n딱 하나만 마무리하고 돌아오자.",
  );
  await target.screenshot({ path: "test-results/blocked.png", fullPage: true });
  await target.goto(`http://sub.example.test:${port}/watch?q=hello`);
  await expect(target).toHaveURL(`${base}/blocked.html?site=example.test`);
  console.log(
    "PASS: loaded extension, custom text, open-tab redirect, new navigation, subdomains",
  );
  for (const host of ["notexample.test", "example.test.evil.test"]) {
    const safe = await context.newPage();
    await safe.goto(`http://${host}:${port}/?q=example.test`);
    await expect(
      safe.getByRole("heading", { name: "Allowed local site" }),
    ).toBeVisible();
    await safe.close();
  }
  await options
    .getByRole("checkbox", { name: "example.test 차단", exact: true })
    .uncheck();
  await expect
    .poll(() =>
      worker.evaluate(() =>
        chrome.declarativeNetRequest.getDynamicRules().then((r) => r.length),
      ),
    )
    .toBe(0);
  await target.goto(`http://example.test:${port}/`);
  await expect(
    target.getByRole("heading", { name: "Allowed local site" }),
  ).toBeVisible();
  await options
    .getByRole("checkbox", { name: "example.test 차단", exact: true })
    .check();
  await expect(target).toHaveURL(`${base}/blocked.html?site=example.test`);
  const popup = await context.newPage();
  await popup.goto(`${base}/popup.html`);
  await expect(
    popup.getByRole("checkbox", { name: "집중 모드", exact: true }),
  ).toBeEnabled();
  await popup
    .getByRole("checkbox", { name: "집중 모드", exact: true })
    .uncheck();
  await expect(
    options.getByRole("checkbox", { name: "집중 모드", exact: true }),
  ).not.toBeChecked();
  await expect
    .poll(() =>
      worker.evaluate(() =>
        chrome.declarativeNetRequest.getDynamicRules().then((r) => r.length),
      ),
    )
    .toBe(0);
  await target.goto(`http://example.test:${port}/`);
  await expect(
    target.getByRole("heading", { name: "Allowed local site" }),
  ).toBeVisible();
  await popup.getByRole("checkbox", { name: "집중 모드", exact: true }).check();
  await expect(target).toHaveURL(`${base}/blocked.html?site=example.test`);
  await popup.setViewportSize({ width: 360, height: 650 });
  await popup.screenshot({ path: "test-results/popup.png", fullPage: true });
  console.log(
    "PASS: lookalike domains allowed, per-site toggle, popup global pause/resume, cross-page sync",
  );
  await options
    .getByRole("textbox", { name: "차단할 사이트 주소" })
    .fill("example.test");
  await options.getByRole("button", { name: "+ 추가", exact: true }).click();
  await expect(options.getByRole("status")).toHaveText(
    "이미 목록에 있는 사이트예요.",
  );
  await options.getByRole("textbox", { name: "차단할 사이트 주소" }).fill("");
  await options.getByRole("button", { name: "+ YouTube", exact: true }).click();
  await options
    .getByRole("button", { name: "+ Instagram", exact: true })
    .click();
  await options.getByRole("button", { name: "+ X", exact: true }).click();
  await expect(options.getByText("x.com", { exact: true })).toBeVisible();
  await options.reload();
  await expect(
    options.getByRole("textbox", { name: "다시 집중할 나에게", exact: true }),
  ).toHaveValue(
    "잠깐, 지금 하려던 일이 뭐였지?\n딱 하나만 마무리하고 돌아오자.",
  );
  await options.screenshot({
    path: "test-results/options.png",
    fullPage: true,
  });
  await options.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await options.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await options.screenshot({
    path: "test-results/options-mobile.png",
    fullPage: true,
  });
  const hostile = "<img src=x onerror=alert(1)> <script>alert(1)</script>";
  await options
    .getByRole("textbox", { name: "다시 집중할 나에게", exact: true })
    .fill(hostile);
  await options.getByRole("button", { name: "문구 저장하기" }).click();
  await expect(target.getByRole("heading")).toHaveText(hostile);
  assert.equal(await target.locator("h1 img,h1 script").count(), 0);
  await options
    .getByRole("textbox", { name: "다시 집중할 나에게", exact: true })
    .fill("지금의 작은 집중이\n내가 바라던 내일을 만들어요.");
  await options.getByRole("button", { name: "문구 저장하기" }).click();
  await expect(
    options.getByText("저장된 문장이에요", { exact: true }),
  ).toBeVisible();
  await options
    .getByRole("button", { name: "example.test 삭제", exact: true })
    .click();
  await expect(options.getByText("example.test", { exact: true })).toHaveCount(
    0,
  );
  await target.goto(`http://example.test:${port}/`);
  await expect(
    target.getByRole("heading", { name: "Allowed local site" }),
  ).toBeVisible();
  const preview = await context.newPage();
  await preview.goto(`${base}/blocked.html?preview=1`);
  await expect(
    preview.getByText("차단 화면 미리보기", { exact: true }),
  ).toBeVisible();
  await preview
    .getByRole("button", { name: "새 탭에서 다시 시작하기" })
    .click();
  await expect(preview).toHaveURL(/^chrome:\/\/(?:newtab|new-tab-page)\/$/);
  const quickTab = await context.newPage();
  await quickTab.goto(`http://quick.test:${port}/`);
  await quickTab.bringToFront();
  const quickPopupPromise = context.waitForEvent("page");
  await worker.evaluate(
    (url) => chrome.tabs.create({ url, active: false }),
    `${base}/popup.html`,
  );
  const quickPopup = await quickPopupPromise;
  await expect(
    quickPopup.getByRole("button", {
      name: "현재 사이트 차단하기 ＋",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(quickPopup.locator("#current-domain")).toHaveText("quick.test");
  await quickPopup
    .getByRole("button", { name: "현재 사이트 차단하기 ＋", exact: true })
    .click();
  await expect(quickTab).toHaveURL(`${base}/blocked.html?site=quick.test`);
  await options
    .getByRole("button", { name: "quick.test 삭제", exact: true })
    .click();
  await expect(options.getByText("quick.test", { exact: true })).toHaveCount(0);
  console.log("PASS: popup current-site quick add and immediate redirect");
  assert.deepEqual(errors, []);
  await context.close();
  context = null;
  context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  await expect
    .poll(() =>
      worker.evaluate(() =>
        chrome.declarativeNetRequest.getDynamicRules().then((r) => r.length),
      ),
    )
    .toBe(3);
  const persisted = await worker.evaluate(() =>
    chrome.storage.local.get("settings"),
  );
  assert.equal(persisted.settings.sites.length, 3);
  assert.equal(persisted.settings.enabled, true);
  console.log(
    "PASS: duplicate validation, reload persistence, responsive layout, text injection safety, deletion, safe return, browser restart persistence",
  );
  console.log(
    "All extension browser checks passed. Screenshots: test-results/",
  );
} finally {
  if (context) await context.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
