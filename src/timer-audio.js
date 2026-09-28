import { soundPattern } from "./timer-sounds.js";
let audio;
const playing = new Set();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message.target !== "timer-audio") return false;
  (async () => {
    audio ||= new AudioContext();
    await audio.resume();
    // A new alert replaces the previous chime instead of stacking its volume.
    for (const oscillator of playing) oscillator.stop();
    playing.clear();

    const volume = Number.isFinite(message.volume) ? Math.min(100, Math.max(0, message.volume)) / 100 : 0.6;
    const start = audio.currentTime;
    for (const note of soundPattern(message.soundType, message.kind)) {
      const at = start + note.at;
      for (const [harmonic, level] of note.harmonics) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.frequency.value = note.frequency * harmonic;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(volume * level, at + 0.02);
        gain.gain.setValueAtTime(volume * level * 0.8, at + note.sustain);
        gain.gain.linearRampToValueAtTime(0, at + note.duration);
        oscillator.connect(gain).connect(audio.destination);
        playing.add(oscillator);
        oscillator.onended = () => {
          playing.delete(oscillator);
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(at);
        oscillator.stop(at + note.duration);
      }
    }
    respond({ ok: true });
  })().catch(() => respond({ ok: false }));
  return true;
});
