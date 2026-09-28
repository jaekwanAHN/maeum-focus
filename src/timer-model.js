import { soundType } from "./timer-sounds.js";
export const timerDefaults = () => ({
  version: 1,
  preferences: { focus: 25, rest: 5, sets: 4, sound: true, soundType: "chime", volume: 60, hideTime: false },
  session: null,
  alarm: null,
  lastMessage: "",
});
export function validatePreferences(p) {
  for (const [key, max] of [["focus", 180], ["rest", 180], ["sets", 99]])
    if (!Number.isInteger(p[key]) || p[key] < 1 || p[key] > max)
      throw new Error("집중·휴식은 1~180분, 반복은 1~99세트로 입력해 주세요.");
  if (typeof p.sound !== "boolean" || typeof p.hideTime !== "boolean" ||
      !Number.isInteger(p.volume) || p.volume < 0 || p.volume > 100)
    throw new Error("알림 설정을 확인해 주세요.");
  return { focus: p.focus, rest: p.rest, sets: p.sets, sound: p.sound, soundType: soundType(p.soundType), volume: p.volume, hideTime: p.hideTime };
}
export function nextAlarm(time, now) {
  if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("알람 시각을 확인해 주세요.");
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(now);
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() <= now) date.setDate(date.getDate() + 1);
  return date.getTime();
}
// Pure reconciliation: elapsed phases follow the original schedule, including the final rest.
export function advanceTimer(state, now) {
  const next = structuredClone(state);
  const events = [];
  if (next.alarm && next.alarm.at <= now) {
    next.alarm = null;
    events.push({ kind: "alarm", message: "예약한 알람 시각이에요." });
  }
  const s = next.session;
  let transitions = 0;
  while (s?.status === "running" && s.endsAt <= now) {
    transitions++;
    if (s.phase === "focus") {
      s.phase = "rest";
      s.endsAt += s.rest * 60000;
    } else if (s.set < s.sets) {
      s.set++;
      s.phase = "focus";
      s.endsAt += s.focus * 60000;
    } else {
      s.status = "completed";
      s.endsAt = null;
    }
  }
  if (transitions) events.push({
    kind: s.status === "completed" ? "complete" : s.phase,
    message: s.status === "completed" ? `${s.sets}세트를 모두 마쳤어요.`
      : s.phase === "rest" ? `집중 시간이 끝났어요. ${s.rest}분간 쉬세요.`
        : `다시 집중할 시간이에요. ${s.set}번째 세트를 시작합니다.`,
  });
  if (events.length) next.lastMessage = events.map(e => e.message).join(" ");
  return { state: next, events };
}
export function reduceTimer(state, action, now) {
  const next = structuredClone(state);
  switch (action.type) {
    case "timer:preferences":
      next.preferences = validatePreferences(action.preferences);
      break;
    case "timer:start": {
      if (["running", "paused"].includes(next.session?.status)) throw new Error("진행 중인 타이머를 먼저 종료해 주세요.");
      const p = validatePreferences(action.preferences);
      next.preferences = p;
      next.session = { focus: p.focus, rest: p.rest, sets: p.sets, set: 1,
        phase: "focus", status: "running", endsAt: now + p.focus * 60000, remaining: null };
      next.lastMessage = "집중을 시작했어요. 시간이 되면 알려드릴게요.";
      break;
    }
    case "timer:pause":
      if (next.session?.status !== "running") throw new Error("진행 중인 타이머가 없어요.");
      next.session.remaining = Math.max(0, next.session.endsAt - now);
      next.session.endsAt = null;
      next.session.status = "paused";
      break;
    case "timer:resume":
      if (next.session?.status !== "paused") throw new Error("일시정지한 타이머가 없어요.");
      next.session.endsAt = now + next.session.remaining;
      next.session.remaining = null;
      next.session.status = "running";
      break;
    case "timer:stop":
      next.session = null;
      next.lastMessage = "타이머를 종료했어요.";
      break;
    case "timer:alarm":
      next.alarm = { at: nextAlarm(action.time, now) };
      break;
    case "timer:cancelAlarm": next.alarm = null; break;
    default: throw new Error("지원하지 않는 타이머 요청이에요.");
  }
  return next;
}
