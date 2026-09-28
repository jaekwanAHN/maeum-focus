import { test } from "node:test";
import assert from "node:assert/strict";
import { SOUND_TYPES, soundPattern } from "../src/timer-sounds.js";
test("all sounds end at three seconds with bounded gain and distinct patterns", () => {
  for (const kind of ["alarm", "focus", "rest", "complete"]) {
    const patterns = SOUND_TYPES.map(({ id }) => soundPattern(id, kind));
    assert.equal(new Set(patterns.map(p => JSON.stringify(p))).size, 3);
    for (const pattern of patterns) {
      assert.equal(Math.max(...pattern.map(note => note.at + note.duration)), 3);
      for (const note of pattern) {
        assert.ok(note.sustain > 0.02 && note.sustain < note.duration);
        assert.ok(note.harmonics.reduce((sum, [, level]) => sum + level, 0) < 1);
      }
    }
  }
});
