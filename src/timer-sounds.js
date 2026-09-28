export const SOUND_TYPES = [
  { id: "chime", label: "차임" },
  { id: "beep", label: "전자음" },
  { id: "school", label: "학교 종소리" },
];
export function soundType(value = "chime") {
  if (!SOUND_TYPES.some(sound => sound.id === value))
    throw new Error("알림음 종류를 확인해 주세요.");
  return value;
}
// All patterns end at three seconds. Event melodies still distinguish focus/rest.
export function soundPattern(type, kind) {
  const melodies = { rest: [660, 520], focus: [520, 660], complete: [520, 660, 780], alarm: [780, 660, 780] };
  const melody = melodies[kind] || melodies.alarm;
  if (type === "school") {
    const school = kind === "focus" ? [523.25, 659.25, 587.33, 392] : [659.25, 523.25, 587.33, 392];
    return school.map((frequency, i) => ({ frequency, at: i * 0.75, duration: 0.75,
      sustain: 0.07, harmonics: [[1, 0.58], [2, 0.18], [3, 0.1]] }));
  }
  if (type === "beep") return Array.from({ length: 12 }, (_, i) => ({
    frequency: melody[i % melody.length] * 1.4, at: i * 0.25,
    duration: i === 11 ? 0.25 : 0.16, sustain: 0.08, harmonics: [[1, 0.72], [3, 0.12]],
  }));
  return Array.from({ length: 6 }, (_, i) => ({ frequency: melody[i % melody.length],
    at: i * 0.5, duration: 0.5, sustain: 0.2, harmonics: [[1, 0.65], [2, 0.15], [3, 0.06]],
  }));
}
