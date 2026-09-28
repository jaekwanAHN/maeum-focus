import { readdir, readFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
for (const name of await readdir("src"))
  if (name.endsWith(".js"))
    execFileSync(process.execPath, ["--check", `src/${name}`], {
      stdio: "inherit",
    });
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
for (const path of [
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_page,
  ...Object.values(manifest.icons),
  ...manifest.web_accessible_resources.flatMap((r) => r.resources),
])
  await access(path);
for (const name of ["options.html", "blocked.html", "popup.html"]) {
  const html = await readFile(name, "utf8");
  if (/<script(?![^>]*\bsrc=)/i.test(html) || /\son\w+=/i.test(html))
    throw new Error(
      `${name}: inline JavaScript is not allowed by extension CSP`,
    );
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const target = match[1];
    if (!target.includes("://") && !target.startsWith("#"))
      await access(target.split("?")[0]);
  }
}
console.log("JavaScript syntax, manifest assets and HTML CSP checks passed.");
