export async function request(action) {
  const result = await chrome.runtime.sendMessage(action);
  if (!result?.ok)
    throw new Error(
      result?.error ||
        "확장프로그램에 연결하지 못했어요. 페이지를 다시 열어 주세요.",
    );
  return result.state;
}
export function notify(message, error = false) {
  const el = document.querySelector("#notice");
  el.textContent = message;
  el.dataset.error = String(error);
  el.hidden = false;
}
export function watch(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings?.newValue)
      callback(changes.settings.newValue);
  });
}
export function wireFocus(getState, render) {
  document
    .querySelector("#focus-toggle")
    .addEventListener("change", async (event) => {
      const el = event.target;
      el.disabled = true;
      try {
        render(await request({ type: "setEnabled", enabled: el.checked }));
        notify(
          el.checked
            ? "집중 모드를 켰어요. 나의 시간을 지켜볼까요?"
            : "집중 모드를 껐어요. 사이트에 자유롭게 접속할 수 있어요.",
        );
      } catch (error) {
        el.checked = getState().enabled;
        notify(error.message, true);
      } finally {
        el.disabled = false;
      }
    });
}
