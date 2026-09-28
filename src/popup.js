import { defaults, normalizeDomain, matchingSite } from "./model.js";
import { request, notify, watch, wireFocus } from "./client.js";
const $ = (selector) => document.querySelector(selector);
let state = defaults(),
  currentURL = "",
  domain = "";
function render(next) {
  state = next;
  const active = state.sites.filter((s) => s.enabled).length;
  $("#focus-toggle").checked = state.enabled;
  $("#focus-heading").textContent = state.enabled
    ? "지금은, 집중할 시간"
    : "잠시 쉬어가는 중";
  $("#focus-description").textContent = state.enabled
    ? `${active}개의 사이트와 잠시 거리를 두고 있어요.`
    : "준비되면 집중 모드를 다시 켜 주세요.";
  $("#popup-message").textContent = state.message;
  $("#active-count").textContent = `${state.sites.length}개 등록 ↗`;
  const blocked = matchingSite({ ...state, enabled: true }, currentURL);
  const exists = state.sites.some((s) => s.domain === domain);
  $("#block-current").disabled = !domain || !!blocked || exists;
  $("#block-current").textContent = blocked
    ? "이미 차단 목록에 있어요 ✓"
    : exists
      ? "등록된 사이트예요 · 설정에서 켜기"
      : "현재 사이트 차단하기 ＋";
  $("#current-domain").textContent =
    domain || "일반 웹사이트 탭에서 빠르게 추가할 수 있어요.";
}
$("#settings").addEventListener("click", () =>
  chrome.runtime.openOptionsPage(),
);
$("#manage").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("#block-current").addEventListener("click", async () => {
  $("#block-current").disabled = true;
  try {
    render(await request({ type: "addSite", domain }));
    notify("현재 사이트를 추가했어요.");
  } catch (error) {
    notify(error.message, true);
    render(state);
  }
});
wireFocus(() => state, render);
watch(render);
try {
  const [initial, tabs] = await Promise.all([
    request({ type: "getState" }),
    chrome.tabs.query({ active: true, lastFocusedWindow: true }),
  ]);
  currentURL = tabs[0]?.url || "";
  try {
    domain = normalizeDomain(currentURL);
  } catch {
    domain = "";
  }
  render(initial);
  $("#focus-toggle").disabled = false;
} catch (error) {
  notify(error.message, true);
}
