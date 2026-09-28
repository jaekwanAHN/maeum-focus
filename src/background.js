import {
  defaults,
  readState,
  reduceState,
  buildRules,
  matchingSite,
} from "./model.js";
let queue = Promise.resolve();
function serial(task) {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}
async function load() {
  return readState((await chrome.storage.local.get("settings")).settings);
}
async function syncRules(state) {
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: rules.map((rule) => rule.id),
    addRules: buildRules(state, chrome.runtime.getURL("blocked.html")),
  });
}
async function badge(state) {
  const active = state.enabled && state.sites.some((s) => s.enabled);
  await chrome.action.setBadgeText({ text: active ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#777d60" });
  await chrome.action.setTitle({
    title: `다시, 여기 · ${active ? "집중 중" : "차단 대기"}`,
  });
}
async function redirectOpenTabs(state) {
  if (!state.enabled) return;
  const tabs = await chrome.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      const site = matchingSite(state, tab.pendingUrl || tab.url);
      if (site && tab.id !== undefined)
        await chrome.tabs
          .update(tab.id, {
            url: `${chrome.runtime.getURL("blocked.html")}?site=${encodeURIComponent(site.domain)}`,
          })
          .catch(() => {});
    }),
  );
}
async function initialize() {
  const stored = (await chrome.storage.local.get("settings")).settings;
  const state = stored === undefined ? defaults() : readState(stored);
  await syncRules(state);
  if (stored === undefined) await chrome.storage.local.set({ settings: state });
  await badge(state);
  await redirectOpenTabs(state);
}
chrome.runtime.onInstalled.addListener(() => {
  serial(initialize).catch(console.error);
});
chrome.runtime.onStartup.addListener(() => {
  serial(initialize).catch(console.error);
});
chrome.runtime.onMessage.addListener((action, sender, respond) => {
  const allowedPages = ["options.html", "popup.html", "blocked.html"].map((p) =>
    chrome.runtime.getURL(p),
  );
  if (
    sender.id !== chrome.runtime.id ||
    !allowedPages.includes((sender.url || "").split(/[?#]/)[0])
  )
    return false;
  serial(async () => {
    const before = await load();
    if (action.type === "getState") return before;
    const next = reduceState(before, action);
    await syncRules(next);
    try {
      await chrome.storage.local.set({ settings: next });
    } catch (error) {
      await syncRules(before);
      throw error;
    }
    await badge(next).catch(console.error);
    if (["setEnabled", "addSite", "toggleSite"].includes(action.type))
      await redirectOpenTabs(next).catch(console.error);
    return next;
  })
    .then((state) => respond({ ok: true, state }))
    .catch((error) =>
      respond({
        ok: false,
        error: error.message || "설정을 저장하지 못했어요. 다시 시도해 주세요.",
      }),
    );
  return true;
});
