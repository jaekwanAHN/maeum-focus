import { SOUND_TYPES } from "./timer-sounds.js";
import { request } from "./client.js";
const root = document.querySelector("#timer-panel");
root.innerHTML = `
  <div class="section-top"><div><h2>시간은 맡겨 두세요</h2><p>집중과 휴식, 소리로 알려드릴게요.</p></div></div>
  <p id="timer-status" class="timer-status" aria-live="polite">타이머를 불러오는 중이에요.</p>
  <p id="timer-clock" class="timer-clock" hidden></p>
  <form id="timer-form">
    <fieldset id="timer-durations" class="timer-fields" disabled>
      <label>집중 (분)<input id="timer-focus" type="number" min="1" max="180" required value="25"></label>
      <label>휴식 (분)<input id="timer-rest" type="number" min="1" max="180" required value="5"></label>
      <label>반복 (세트)<input id="timer-sets" type="number" min="1" max="99" required value="4"></label>
    </fieldset>
    <p id="timer-total" class="timer-help"></p>
    <div class="timer-actions">
      <button id="timer-start" class="button primary" disabled>시작하기</button>
      <button id="timer-pause" type="button" class="button outline" hidden>일시정지</button>
      <button id="timer-stop" type="button" class="button outline" hidden>종료</button>
    </div>
  </form>
  <details class="timer-settings"><summary>소리와 시간 표시</summary>
    <form id="timer-preferences">
      <label class="timer-check"><input id="timer-sound" type="checkbox" checked> 알림음 켜기</label>
      <label>알림음 종류<select id="timer-sound-type">${SOUND_TYPES.map(sound => `<option value="${sound.id}">${sound.label}</option>`).join("")}</select></label>
      <p class="timer-help">모든 알림음은 약 3초간 울려요. 저장 전에도 미리 들을 수 있어요.</p>
      <label class="timer-volume">음량 <input id="timer-volume" type="range" min="0" max="100" value="60"></label>
      <label class="timer-check"><input id="timer-hide" type="checkbox"> 남은 시간 숨기기</label>
      <div class="timer-actions"><button class="button outline" id="timer-save" disabled>설정 저장</button><button type="button" id="timer-preview" class="button outline" disabled>소리 미리 듣기</button></div>
    </form>
  </details>
  <div class="timer-alarm">
    <h3>지정 시각 알람</h3>
    <form id="timer-alarm-form" class="timer-actions"><label>알람 시각<input id="timer-alarm-time" type="time" required></label><button id="timer-alarm-save" class="button outline" disabled>예약·변경</button></form>
    <p id="timer-alarm-status" class="timer-help"></p>
    <button type="button" id="timer-cancel" class="button outline" hidden>예약 취소</button>
  </div>
  <p id="timer-feedback" class="timer-help" role="status"></p>
  <p class="timer-help">1세트는 집중 + 휴식이에요. 마지막 휴식까지 자동으로 진행하며 사이트 차단 설정은 바꾸지 않아요.</p>
  <p class="timer-help">Chrome 종료·기기 절전 중에는 알림이 울리지 않을 수 있어요. 복귀하면 원래 시간표에 맞춰 이어집니다.</p>
`;
const $ = id => root.querySelector(`#timer-${id}`);
let state, busy = false, dirty = false;
const preferences = () => ({ focus: Number($("focus").value), rest: Number($("rest").value), sets: Number($("sets").value), sound: $("sound").checked, soundType: $("sound-type").value, volume: Number($("volume").value), hideTime: $("hide").checked });
function total() {
  const p = preferences();
  $("total").textContent = `집중 + 휴식 × ${p.sets}세트 · 총 ${(p.focus + p.rest) * p.sets}분`;
}
function clock() {
  const s = state?.session;
  $("clock").hidden = !s || s.status === "completed" || state.preferences.hideTime;
  if (!s || s.status === "completed") return;
  const seconds = Math.max(0, Math.ceil((s.status === "paused" ? s.remaining : s.endsAt - Date.now()) / 1000));
  $("clock").textContent = seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "다음 단계로 전환 중이에요";
}
function render(next, fill = false) {
  state = next;
  if (fill || !dirty) {
    for (const key of ["focus", "rest", "sets", "volume"]) $(key).value = state.preferences[key];
    $("sound").checked = state.preferences.sound;
    $("sound-type").value = state.preferences.soundType ?? "chime";
    $("hide").checked = state.preferences.hideTime;
  }
  const s = state.session;
  const active = s && ["running", "paused"].includes(s.status);
  $("status").textContent = !s ? "준비되면 집중을 시작해 보세요." : s.status === "completed" ? `${s.sets}세트 완료 · 수고하셨어요!` : `${s.phase === "focus" ? "집중" : "휴식"} ${s.status === "paused" ? "일시정지" : "중"} · ${s.set}/${s.sets}세트`;
  $("durations").disabled = busy || active;
  $("start").hidden = !!active;
  $("pause").hidden = $("stop").hidden = !active;
  $("pause").textContent = s?.status === "paused" ? "이어하기" : "일시정지";
  for (const id of ["start", "pause", "stop", "save", "preview", "alarm-save", "cancel"]) $(id).disabled = busy;
  $("alarm-status").textContent = state.alarm ? `${new Date(state.alarm.at).toLocaleString("ko-KR", { month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" })}에 울려요.` : "예약된 알람이 없어요. 지난 시각은 내일로 예약돼요.";
  $("cancel").hidden = !state.alarm;
  $("feedback").textContent = state.lastMessage;
  total(); clock();
}
async function act(action, success) {
  if (busy || !state) return;
  busy = true; render(state);
  try {
    const next = await request(action);
    if (["timer:start", "timer:preferences"].includes(action.type)) dirty = false;
    render(next);
    if (success) $("feedback").textContent = success;
  } catch (error) { $("feedback").textContent = error.message; }
  finally {
    busy = false;
    for (const id of ["start", "pause", "stop", "save", "preview", "alarm-save", "cancel"]) $(id).disabled = false;
    $("durations").disabled = ["running", "paused"].includes(state.session?.status);
  }
}
$("form").addEventListener("submit", event => { event.preventDefault(); act({ type: "timer:start", preferences: preferences() }); });
$("preferences").addEventListener("submit", event => { event.preventDefault(); act({ type: "timer:preferences", preferences: preferences() }, "설정을 저장했어요."); });
$("pause").addEventListener("click", () => act({ type: state.session?.status === "paused" ? "timer:resume" : "timer:pause" }));
$("stop").addEventListener("click", () => act({ type: "timer:stop" }));
$("preview").addEventListener("click", () => act({ type: "timer:preview", soundType: $("sound-type").value, volume: Number($("volume").value) }, "알림음을 재생했어요."));
$("alarm-form").addEventListener("submit", event => { event.preventDefault(); act({ type: "timer:alarm", time: $("alarm-time").value }, "알람을 예약했어요."); });
$("cancel").addEventListener("click", () => act({ type: "timer:cancelAlarm" }, "예약을 취소했어요."));
root.addEventListener("input", event => {
  if (event.target.id !== "timer-alarm-time") dirty = true;
});
$("durations").addEventListener("input", total);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.timer && state) render(changes.timer.newValue);
});
setInterval(clock, 1000);
try { render(await request({ type: "timer:get" }), true); }
catch (error) { $("status").textContent = error.message; }
