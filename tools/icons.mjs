import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
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
  const png = await readFile(new URL("../assets/icon-128.png", import.meta.url));
  await writeFile(new URL("../src/notification-icon.js", import.meta.url),
    '// Generated from assets/icon-128.png by tools/icons.mjs.\n' +
    '// Embed the PNG so notifications do not need to resolve or load a file URL.\n' +
    `export const notificationIcon = "data:image/png;base64,${png.toString("base64")}";\n`);
} finally {
  await browser.close();
}
