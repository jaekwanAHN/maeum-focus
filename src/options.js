import { defaults } from "./model.js";
import { request, notify, watch, wireFocus } from "./client.js";
const $ = (selector) => document.querySelector(selector);
let state = defaults(),
  dirty = false,
  busy = false,
  loaded = false;
function updateDraft() {
  const text = $("#message").value;
  $("#char-count").textContent = `${text.length} / 240`;
  $("#preview-message").textContent =
    text.trim() || "나에게 건네고 싶은 말을 적어 보세요.";
  $("#save-state").textContent = dirty
    ? "아직 저장하지 않은 문장이에요"
    : "저장된 문장이에요";
  $("#save-message").disabled = !loaded || busy || !dirty || !text.trim();
}
function render(next) {
  state = next;
  const active = state.sites.filter((s) => s.enabled).length;
  $("#focus-toggle").checked = state.enabled;
  $("#focus-heading").textContent = state.enabled
    ? "사이트 차단이 켜져 있어요"
    : "사이트 차단이 꺼져 있어요";
  $("#focus-description").textContent = state.enabled
    ? active
      ? `${active}개의 사이트로 향하는 발걸음을 잠시 멈춰 드릴게요.`
      : "거리를 둘 사이트를 추가하면 차단이 시작돼요."
    : "차단이 꺼져 있어요. 준비되면 다시 켜 주세요.";
  $("#focus-label").textContent = state.enabled
    ? "집중 모드 켜짐"
    : "집중 모드 꺼짐";
  $(".focus-banner").classList.toggle("paused", !state.enabled);
  if (!dirty) $("#message").value = state.message;
  updateDraft();
  $("#site-count").textContent = String(state.sites.length);
  $("#sites-empty").hidden = state.sites.length > 0;
  const list = $("#site-list");
  list.replaceChildren();
  state.sites.forEach((site, index) => {
    const li = document.createElement("li");
    li.className = site.enabled ? "" : "disabled-site";
    const avatar = document.createElement("span");
    avatar.className = `site-avatar color-${index % 4}`;
    avatar.textContent = site.domain[0].toUpperCase();
    avatar.setAttribute("aria-hidden", "true");
    const info = document.createElement("div");
    info.className = "site-info";
    const domain = document.createElement("strong");
    domain.textContent = site.domain;
    const status = document.createElement("small");
    status.textContent = site.enabled
      ? state.enabled
        ? "집중 모드에서 차단 중"
        : "집중 모드를 켜면 차단돼요"
      : "차단 쉬는 중";
    info.append(domain, status);
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.className = "switch small-switch";
    toggle.checked = site.enabled;
    toggle.setAttribute("aria-label", `${site.domain} 차단`);
    toggle.disabled = busy;
    toggle.addEventListener("change", () =>
      mutate(
        { type: "toggleSite", domain: site.domain, enabled: toggle.checked },
        "사이트 차단 설정을 바꿨어요.",
      ),
    );
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-site icon-button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `${site.domain} 삭제`);
    remove.disabled = busy;
    remove.addEventListener("click", () =>
      mutate(
        { type: "removeSite", domain: site.domain },
        "사이트를 목록에서 삭제했어요.",
      ),
    );
    li.append(avatar, info, toggle, remove);
    list.append(li);
  });
  document.querySelectorAll("[data-domain]").forEach((button) => {
    button.disabled =
      !loaded ||
      busy ||
      state.sites.some((s) => s.domain === button.dataset.domain);
  });
}
async function mutate(action, success) {
  if (busy || !loaded) return false;
  busy = true;
  $("#add-site").disabled = true;
  render(state);
  try {
    const next = await request(action);
    render(next);
    notify(success);
    return true;
  } catch (error) {
    notify(error.message, true);
    render(state);
    return false;
  } finally {
    busy = false;
    $("#add-site").disabled = false;
    render(state);
  }
}
$("#message").addEventListener("input", () => {
  dirty = $("#message").value !== state.message;
  updateDraft();
});
$("#message-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const draft = $("#message").value;
  if (
    await mutate(
      { type: "saveMessage", message: draft },
      "나에게 보내는 문장을 저장했어요.",
    )
  ) {
    if ($("#message").value === draft) {
      dirty = false;
      render(state);
    }
  }
});
$("#site-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const draft = $("#site-input").value;
  if (
    await mutate(
      { type: "addSite", domain: draft },
      "사이트를 추가했어요. 하위 도메인도 함께 차단돼요.",
    )
  )
    if ($("#site-input").value === draft) $("#site-input").value = "";
});
document.querySelectorAll("[data-message]").forEach((button) =>
  button.addEventListener("click", () => {
    if (!loaded) return;
    $("#message").value = button.dataset.message;
    dirty = true;
    updateDraft();
    $("#message").focus();
  }),
);
document
  .querySelectorAll("[data-domain]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      mutate(
        { type: "addSite", domain: button.dataset.domain },
        "사이트를 추가했어요.",
      ),
    ),
  );
$("#open-preview").addEventListener("click", () =>
  chrome.tabs.create({ url: chrome.runtime.getURL("blocked.html?preview=1") }),
);
wireFocus(() => state, render);
watch((next) => render(next));
window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
try {
  const initial = await request({ type: "getState" });
  loaded = true;
  ["#focus-toggle", "#message", "#site-input", "#add-site"].forEach(
    (s) => ($(s).disabled = false),
  );
  render(initial);
} catch (error) {
  notify(error.message, true);
  $("#focus-heading").textContent = "설정을 불러오지 못했어요";
  $("#focus-description").textContent =
    "확장프로그램을 다시 로드한 뒤 이 페이지를 열어 주세요.";
}
