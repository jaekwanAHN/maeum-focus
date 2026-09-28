import { test } from "node:test";
import assert from "node:assert/strict";
import { timerDefaults, nextAlarm, reduceTimer, advanceTimer } from "../src/timer-model.js";
const start = (now = 1000) => reduceTimer(timerDefaults(), { type: "timer:start", preferences: { ...timerDefaults().preferences, focus: 1, rest: 1, sets: 2 } }, now);
test("focus and rest each finish, including final rest", () => {
  let state = start();
  for (const [now, phase, set, status] of [[61000, "rest", 1, "running"], [121000, "focus", 2, "running"], [181000, "rest", 2, "running"], [241000, "rest", 2, "completed"]]) {
    const result = advanceTimer(state, now);
    assert.equal(result.events.length, 1);
    state = result.state;
    assert.equal(state.session.phase, phase);
    assert.equal(state.session.set, set);
    assert.equal(state.session.status, status);
    assert.equal(advanceTimer(state, now).events.length, 0);
  }
});
test("sleep recovery skips obsolete notifications without shifting schedule", () => {
  const result = advanceTimer(start(), 150000);
  assert.equal(result.events.length, 1);
  assert.equal(result.state.session.set, 2);
  assert.equal(result.state.session.endsAt, 181000);
  assert.equal(advanceTimer(start(), 999999).state.session.status, "completed");
});
test("pause freezes time and resume preserves remainder; stop cancels", () => {
  const paused = reduceTimer(start(), { type: "timer:pause" }, 11000);
  assert.equal(paused.session.remaining, 50000);
  assert.equal(advanceTimer(paused, 999999).events.length, 0);
  const resumed = reduceTimer(paused, { type: "timer:resume" }, 100000);
  assert.equal(resumed.session.endsAt, 150000);
  const stopped = reduceTimer(resumed, { type: "timer:stop" }, 100001);
  assert.equal(advanceTimer(stopped, 999999).events.length, 0);
});
test("alarm rolls over midnight, fires once, and can be canceled", () => {
  const now = new Date(2026, 8, 28, 23, 50).getTime();
  assert.equal(nextAlarm("00:10", now), new Date(2026, 8, 29, 0, 10).getTime());
  const state = reduceTimer(start(), { type: "timer:alarm", time: "00:10" }, now);
  const result = advanceTimer(state, nextAlarm("00:10", now));
  assert.equal(result.events.filter(e => e.kind === "alarm").length, 1);
  assert.equal(advanceTimer(result.state, now + 86400000).events.length, 0);
  assert.equal(reduceTimer(state, { type: "timer:cancelAlarm" }, now).alarm, null);
  assert.throws(() => nextAlarm("25:00", now));
});
test("invalid and conflicting commands are rejected and preferences don't alter active session", () => {
  assert.throws(() => reduceTimer(start(), { type: "timer:start", preferences: timerDefaults().preferences }, 1000));
  assert.throws(() => reduceTimer(timerDefaults(), { type: "timer:resume" }, 1000));
  for (const focus of [0, -1, 181, NaN, 1.5]) assert.throws(() => reduceTimer(timerDefaults(), { type: "timer:start", preferences: { ...timerDefaults().preferences, focus } }, 1000));
  const updated = reduceTimer(start(), { type: "timer:preferences", preferences: timerDefaults().preferences }, 5000);
  assert.equal(updated.session.endsAt, 61000);
  assert.equal(updated.session.focus, 1);
});

test("sound selection persists and existing preferences default to chime", () => {
  const legacy = timerDefaults().preferences;
  delete legacy.soundType;
  assert.equal(reduceTimer(timerDefaults(), { type: "timer:preferences", preferences: legacy }, 0).preferences.soundType, "chime");
  for (const soundType of ["chime", "beep", "school"]) {
    assert.equal(reduceTimer(timerDefaults(), { type: "timer:preferences", preferences: { ...legacy, soundType } }, 0).preferences.soundType, soundType);
  }
  assert.throws(() => reduceTimer(timerDefaults(), { type: "timer:preferences", preferences: { ...legacy, soundType: "unknown" } }, 0));
});
