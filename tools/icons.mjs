import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  const svg = await readFile(
    new URL("../assets/mark.svg", import.meta.url),
    "utf8",
  );
  const page = await browser.newPage();
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{width:100%;height:100%;display:block}</style>${svg}`,
    );
    await page.screenshot({
      path: `assets/icon-${size}.png`,
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}
