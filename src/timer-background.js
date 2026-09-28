import { notificationIcon } from "./notification-icon.js";
import { soundType } from "./timer-sounds.js";
import { timerDefaults, advanceTimer, reduceTimer } from "./timer-model.js";
const ALARM = "focus-timer-wake";
async function schedule(state) {
  const dates = [state.alarm?.at, state.session?.status === "running" ? state.session.endsAt : null].filter(Number.isFinite);
  if (!dates.length) return chrome.alarms.clear(ALARM);
  const when = Math.min(...dates);
  const existing = await chrome.alarms.get(ALARM);
  if (existing?.scheduledTime !== when) await chrome.alarms.create(ALARM, { when });
}
async function play(state, kind) {
  if (!state.preferences.sound || !state.preferences.volume) return;
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (!contexts.length) await chrome.offscreen.createDocument({
    url: "offscreen.html", reasons: ["AUDIO_PLAYBACK"], justification: "예약 알람과 집중·휴식 전환 알림음 재생",
  });
  const result = await chrome.runtime.sendMessage({ target: "timer-audio", kind, soundType: state.preferences.soundType ?? "chime", volume: state.preferences.volume });
  if (!result?.ok) throw new Error("알림음을 재생하지 못했어요.");
}
async function announce(state, events) {
  if (!events.length) return;
  const results = await Promise.allSettled([
    chrome.notifications.create("focus-timer-notice", {
      type: "basic", iconUrl: notificationIcon, title: "다시, 여기",
      message: events.map(e => e.message).join(" "), silent: true,
    }),
    play(state, events.at(-1).kind),
  ]);
  const failures = results.filter(r => r.status === "rejected");
  if (failures.length) {
    state.lastMessage += " 알림 전달에 실패했어요. 소리와 시스템 알림 설정을 확인해 주세요.";
    await chrome.storage.local.set({ timer: state });
    failures.forEach(r => console.error(r.reason));
  }
}
export async function handleTimer(action = { type: "timer:get" }) {
  const stored = (await chrome.storage.local.get("timer")).timer || timerDefaults();
  const { state: current, events } = advanceTimer(stored, Date.now());
  // Commit elapsed phases before side effects so waking again cannot replay them.
  if (events.length) {
    await chrome.storage.local.set({ timer: current });
    await schedule(current);
    await announce(current, events);
  }
  if (action.type === "timer:preview") {
    await play({ preferences: { sound: true, soundType: soundType(action.soundType), volume: action.volume >= 0 && action.volume <= 100 ? action.volume : 60 } }, "rest");
    return current;
  }
  const next = action.type === "timer:get" ? current : reduceTimer(current, action, Date.now());
  await chrome.storage.local.set({ timer: next });
  await schedule(next);
  return next;
}
export const isTimerAlarm = alarm => alarm.name === ALARM;
