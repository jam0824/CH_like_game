const audioState = {
  ctx: null,
  masterGain: null,
  bgmGain: null,
  sfxGain: null,
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.35,
  sfxVolume: 0.6,
  schedulerId: null,
  nextNoteTime: 0,
  noteIndex: 0,
  bassIndex: 0,
  bpm: 120,
  stepTime: 0.25,
  playing: false,
};

const melodyPattern = [
  76, 74, 72, 74,
  76, -1, 76, -1,
  79, 77, 76, 74,
  72, -1, 72, -1,
];

const bassPattern = [
  40, -1, 40, -1,
  43, -1, 43, -1,
];

function ensureAudio() {
  if (!audioState.ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioState.ctx = new AudioContext();
    audioState.masterGain = audioState.ctx.createGain();
    audioState.bgmGain = audioState.ctx.createGain();
    audioState.sfxGain = audioState.ctx.createGain();
    audioState.bgmGain.connect(audioState.masterGain);
    audioState.sfxGain.connect(audioState.masterGain);
    audioState.masterGain.connect(audioState.ctx.destination);
  }
  if (audioState.ctx.state === 'suspended') {
    audioState.ctx.resume();
  }
  updateAudioVolumes();
}

function updateAudioVolumes() {
  if (!audioState.ctx) return;
  audioState.bgmGain.gain.value = audioState.bgmEnabled ? audioState.bgmVolume : 0;
  audioState.sfxGain.gain.value = audioState.sfxEnabled ? audioState.sfxVolume : 0;
}

function midiToFreq(note) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function scheduleTone(time, freq, duration, type, gainNode, amp) {
  const osc = audioState.ctx.createOscillator();
  const gain = audioState.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(amp, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain);
  gain.connect(gainNode);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function scheduleBgmStep(time) {
  const note = melodyPattern[audioState.noteIndex % melodyPattern.length];
  const bassNote = bassPattern[audioState.bassIndex % bassPattern.length];
  if (note >= 0) {
    scheduleTone(time, midiToFreq(note), audioState.stepTime * 0.9, 'square', audioState.bgmGain, 0.08);
  }
  if (bassNote >= 0) {
    scheduleTone(time, midiToFreq(bassNote), audioState.stepTime * 1.8, 'triangle', audioState.bgmGain, 0.1);
  }
  audioState.noteIndex += 1;
  if (audioState.noteIndex % 2 === 0) {
    audioState.bassIndex += 1;
  }
}

function bgmScheduler() {
  const ahead = 0.2;
  while (audioState.nextNoteTime < audioState.ctx.currentTime + ahead) {
    scheduleBgmStep(audioState.nextNoteTime);
    audioState.nextNoteTime += audioState.stepTime;
  }
}

function startBgm() {
  if (!audioState.bgmEnabled) return;
  ensureAudio();
  if (audioState.playing) return;
  audioState.playing = true;
  audioState.stepTime = (60 / audioState.bpm) / 2;
  audioState.nextNoteTime = audioState.ctx.currentTime + 0.05;
  audioState.noteIndex = 0;
  audioState.bassIndex = 0;
  audioState.schedulerId = setInterval(bgmScheduler, 50);
}

function stopBgm() {
  if (audioState.schedulerId) {
    clearInterval(audioState.schedulerId);
    audioState.schedulerId = null;
  }
  audioState.playing = false;
}

function playSfx(kind) {
  if (!audioState.sfxEnabled) return;
  ensureAudio();
  const now = audioState.ctx.currentTime;
  if (kind === 'attack') {
    scheduleTone(now, 680, 0.08, 'square', audioState.sfxGain, 0.16);
  } else if (kind === 'hit') {
    scheduleTone(now, 220, 0.1, 'square', audioState.sfxGain, 0.2);
  } else if (kind === 'defeat') {
    const osc = audioState.ctx.createOscillator();
    const gain = audioState.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.2);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.connect(gain);
    gain.connect(audioState.sfxGain);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (kind === 'exit') {
    scheduleTone(now, 520, 0.12, 'square', audioState.sfxGain, 0.14);
    scheduleTone(now + 0.12, 780, 0.12, 'square', audioState.sfxGain, 0.14);
  } else if (kind === 'clear') {
    scheduleTone(now, 660, 0.12, 'square', audioState.sfxGain, 0.16);
    scheduleTone(now + 0.14, 990, 0.18, 'square', audioState.sfxGain, 0.16);
  } else if (kind === 'trap') {
    scheduleTone(now, 180, 0.12, 'square', audioState.sfxGain, 0.2);
    scheduleTone(now + 0.08, 120, 0.1, 'square', audioState.sfxGain, 0.18);
  } else if (kind === 'chest') {
    scheduleTone(now, 640, 0.1, 'square', audioState.sfxGain, 0.16);
    scheduleTone(now + 0.12, 880, 0.12, 'square', audioState.sfxGain, 0.16);
  } else if (kind === 'enemy') {
    scheduleTone(now, 260, 0.1, 'square', audioState.sfxGain, 0.2);
    scheduleTone(now + 0.08, 200, 0.1, 'square', audioState.sfxGain, 0.18);
  } else if (kind === 'gameover') {
    scheduleTone(now, 240, 0.16, 'square', audioState.sfxGain, 0.2);
    scheduleTone(now + 0.18, 140, 0.2, 'square', audioState.sfxGain, 0.18);
  }
}

function syncAudioToMode(mode) {
  if (mode === 'running') {
    startBgm();
  } else {
    stopBgm();
  }
}

function setAudioState(partial) {
  Object.assign(audioState, partial);
  updateAudioVolumes();
}

export { audioState, ensureAudio, updateAudioVolumes, playSfx, syncAudioToMode, setAudioState };
