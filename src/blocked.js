import { request, notify, watch } from "./client.js";
const params = new URLSearchParams(location.search);
const preview = params.has("preview");
function render(state) {
  document.querySelector("#return-message").textContent = state.message;
  const site = state.sites.find((s) => s.domain === params.get("site"));
  document.querySelector("#blocked-site").textContent = preview
    ? "내가 마주할 한 문장"
    : site
      ? `${site.domain} · 잠시 멈춤`
      : "나를 위한 한 문장";
  document.querySelector("#blocked-status").textContent = preview
    ? "차단 화면 미리보기"
    : !state.enabled
      ? "집중 모드가 꺼져 있어요"
      : site && !site.enabled
        ? "이 사이트의 차단이 꺼져 있어요"
        : "나를 위한 잠깐의 멈춤";
  if (preview)
    document.querySelector("#preview-note").textContent =
      "저장한 문장이 이곳에 보여요.";
}
document.querySelector("#return-button").addEventListener("click", async () => {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id !== undefined)
      await chrome.tabs.update(tab.id, { url: "chrome://newtab/" });
  } catch (error) {
    notify("새 탭을 열지 못했어요. 브라우저의 새 탭 버튼을 눌러 주세요.", true);
  }
});
watch(render);
try {
  render(await request({ type: "getState" }));
} catch (error) {
  notify(error.message, true);
}
