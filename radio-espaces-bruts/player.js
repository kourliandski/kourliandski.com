const OVERLAP_SECONDS = 8;
const CROSSFADE_SECONDS = 15;
const STOP_FADE_SECONDS = 2;

const FILES = [
  "https://static.wixstatic.com/mp3/491527_7c5add4103a14ded9412746b00858abc.mp3",
  "https://static.wixstatic.com/mp3/491527_ac4d9b824eeb4ffa913a5c6925c7073e.mp3",
  "https://static.wixstatic.com/mp3/491527_dc4dc362369048929d6ee394894b0134.mp3",
  "https://static.wixstatic.com/mp3/491527_dc5ce8d971844ba0b05b3ec1d7fce28b.mp3",
  "https://static.wixstatic.com/mp3/491527_b4343ceee2ee4253bda67e820087814d.mp3",
  "https://static.wixstatic.com/mp3/491527_d034054884af4280a8bb4c1e86029dc5.mp3",
  "https://static.wixstatic.com/mp3/491527_a7e24db0886e423680666dcf0f4dbb75.mp3",
  "https://static.wixstatic.com/mp3/491527_7c54a00d926b48b7951ac70634d03e70.mp3",
  "https://static.wixstatic.com/mp3/491527_00eb8fd0789c46e29420dd3647cbbdc6.mp3",
  "https://static.wixstatic.com/mp3/491527_ca2570fe64f94009adb96960f100858d.mp3",
  "https://static.wixstatic.com/mp3/491527_7592b0ca0ced4870a8f0855b19282334.mp3",
  "https://static.wixstatic.com/mp3/491527_61e9b0ed13e34dd7931688b53eff041c.mp3",
  "https://static.wixstatic.com/mp3/491527_07459ed0329a41ac821e0a7e4e592578.mp3",
  "https://static.wixstatic.com/mp3/491527_1a11d3ee84b943eab44bc7aa223773f5.mp3",
  "https://static.wixstatic.com/mp3/491527_1bd579f943c940ab841f573a29031db4.mp3",
  "https://static.wixstatic.com/mp3/491527_3b7ea0a1fa234c2c99f946e3e414f56b.mp3",
  "https://static.wixstatic.com/mp3/491527_1cd6e5e59e3140b6a7f83b6a832409ce.mp3",
  "https://static.wixstatic.com/mp3/491527_24501f4518834b42a264de39935a7893.mp3",
  "https://static.wixstatic.com/mp3/491527_b9da88898f2247e1b75a1d4185888e08.mp3",
  "https://static.wixstatic.com/mp3/491527_136a4bc862a34a9da4df2171d7c6f39c.mp3",
  "https://static.wixstatic.com/mp3/491527_9ec10f1f31f84e04afb0c5130fd1a61d.mp3",
  "https://static.wixstatic.com/mp3/491527_e8e72468bf364a54a27c9c5a1cf8444f.mp3",
  "https://static.wixstatic.com/mp3/491527_9b0a99c7aa9b4de58c79ade2c3aa8fc4.mp3",
  "https://static.wixstatic.com/mp3/491527_eed6e5bd624a431eb5b1e9f8425cbfdf.mp3"
];

const button = document.getElementById("toggle");
const nextButton = document.getElementById("nextTrack");
const playbackProgress = document.getElementById("playbackProgress");
const progressCircle = document.getElementById("transitionProgress");
const icon = document.getElementById("icon");
const fullscreenButton = document.getElementById("fullscreenToggle");
const enterFullscreenIcon = document.getElementById("enterFullscreenIcon");
const exitFullscreenIcon = document.getElementById("exitFullscreenIcon");

const PLAY_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M6 3v18l15-9z" fill="currentColor"/></svg>';
const STOP_ICON = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="4" y="4" width="16" height="16" fill="currentColor"/></svg>';
icon.innerHTML = PLAY_ICON;
icon.className = "play";

const audioA = new Audio();
const audioB = new Audio();

[audioA, audioB].forEach(a => {
  a.crossOrigin = "anonymous";
  a.preload = "auto";
  a.volume = 1;
});

let current = audioA;
let next = audioB;
let currentIndex = -1;
let nextIndex = -1;
let isPlaying = false;
let isStopping = false;
let overlapStarted = false;

let audioContext;
const gains = new Map();
let transitionId = 0;
let manualFade = false;
let fadeTimer;
let progressFrame;

function resetTransitionProgress() {
  cancelAnimationFrame(progressFrame);
  nextButton.classList.remove("is-transitioning");
  progressCircle.style.strokeDashoffset = "1";
}

function showTransitionProgress(start, id) {
  nextButton.classList.add("is-transitioning");
  const draw = () => {
    if (id !== transitionId || !manualFade || !isPlaying) return;
    const progress = Math.min(1, Math.max(0,
      (audioContext.currentTime - start) / CROSSFADE_SECONDS));
    progressCircle.style.strokeDashoffset = String(1 - progress);
    if (progress < 1) progressFrame = requestAnimationFrame(draw);
  };
  draw();
}

function updatePlaybackProgress() {
  const duration = current.duration;
  const progress = isPlaying && Number.isFinite(duration) && duration > 0
    ? Math.min(1, Math.max(0, current.currentTime / duration)) : 0;
  playbackProgress.style.strokeDashoffset = String(1 - progress);
  button.classList.toggle("is-playing", isPlaying);
}

[audioA, audioB].forEach(player => {
  ["timeupdate", "loadedmetadata", "durationchange", "emptied"].forEach(event => {
    player.addEventListener(event, () => {
      if (player === current) updatePlaybackProgress();
    });
  });
});

function updateNextButton() {
  updatePlaybackProgress();
  nextButton.disabled = !isPlaying || overlapStarted || manualFade;
}

async function enableAudio() {
  if (!audioContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    audioContext = new Context();
    [audioA, audioB].forEach(player => {
      const gain = audioContext.createGain();
      audioContext.createMediaElementSource(player).connect(gain);
      gain.connect(audioContext.destination);
      gains.set(player, gain.gain);
    });
  }
  await audioContext.resume();
}

function resetGain(player, value = 1) {
  const gain = gains.get(player);
  if (!gain) return;
  gain.cancelScheduledValues(audioContext.currentTime);
  gain.setValueAtTime(value, audioContext.currentTime);
}

async function skipTrack() {
  if (!isPlaying || overlapStarted || manualFade) return;
  manualFade = true;
  updateNextButton();
  const id = ++transitionId;
  const outgoing = current;
  const incoming = next;
  try {
    await enableAudio();
    if (id !== transitionId || !isPlaying) return;
    resetGain(incoming, 0);
    await incoming.play();
    if (id !== transitionId || !isPlaying) return;
    const start = audioContext.currentTime;
    showTransitionProgress(start, id);
    gains.get(outgoing).linearRampToValueAtTime(0, start + CROSSFADE_SECONDS);
    gains.get(incoming).linearRampToValueAtTime(1, start + CROSSFADE_SECONDS);
    const finishFade = () => {
      if (id !== transitionId || !isPlaying) return;
      // AudioContext time keeps the fade accurate when a tab is backgrounded.
      if (audioContext.currentTime < start + CROSSFADE_SECONDS) {
        fadeTimer = setTimeout(finishFade, 100);
        return;
      }
      outgoing.pause();
      current = incoming;
      next = outgoing;
      currentIndex = nextIndex;
      resetGain(current);
      manualFade = false;
      resetTransitionProgress();
      prepareNext();
      updateNextButton();
    };
    fadeTimer = setTimeout(finishFade, CROSSFADE_SECONDS * 1000);
  } catch (error) {
    console.error(error);
    if (id !== transitionId) return;
    incoming.pause();
    resetGain(incoming);
    resetGain(outgoing);
    manualFade = false;
    resetTransitionProgress();
    updateNextButton();
  }
}

nextButton.addEventListener("click", skipTrack);
updateNextButton();

function randomIndex(excluded = -1) {
  if (FILES.length === 1) return 0;
  let i;
  do i = Math.floor(Math.random() * FILES.length);
  while (i === excluded);
  return i;
}

function loadTrack(player, index) {
  player.pause();
  player.src = FILES[index];
  player.preload = "auto";
  player.volume = 1;
  resetGain(player);
  player.load();
}

function prepareNext() {
  nextIndex = randomIndex(currentIndex);
  loadTrack(next, nextIndex);
}

async function startOverlap() {
  if (!isPlaying || overlapStarted || manualFade) return;
  overlapStarted = true;
  updateNextButton();
  try {
    await next.play();
  } catch (error) {
    console.error(error);
    overlapStarted = false;
    updateNextButton();
  }
}

function checkOverlap(player) {
  if (!isPlaying || player !== current || overlapStarted || manualFade) return;
  if (!Number.isFinite(player.duration) || player.duration <= 0) return;

  if (player.duration - player.currentTime <= OVERLAP_SECONDS) {
    startOverlap();
  }
}

async function finishCurrent(player) {
  if (!isPlaying || player !== current || manualFade) return;
  const id = transitionId;

  if (next.paused) {
    try {
      await next.play();
    } catch (error) {
      console.error(error);
      return;
    }
  }

  if (id !== transitionId || !isPlaying) return;
  const oldCurrent = current;
  current = next;
  next = oldCurrent;
  currentIndex = nextIndex;
  overlapStarted = false;
  prepareNext();
  updateNextButton();
}

audioA.addEventListener("timeupdate", () => checkOverlap(audioA));
audioB.addEventListener("timeupdate", () => checkOverlap(audioB));
audioA.addEventListener("ended", () => finishCurrent(audioA));
audioB.addEventListener("ended", () => finishCurrent(audioB));

async function startArchive() {
  if (isPlaying || isStopping) return;

  const id = ++transitionId;
  isPlaying = true;
  updateNextButton();
  overlapStarted = false;
  icon.innerHTML = STOP_ICON;
  icon.className = "stop";

  currentIndex = randomIndex();
  loadTrack(current, currentIndex);
  prepareNext();

  try {
    await enableAudio();
    if (id !== transitionId || !isPlaying) return;
    await current.play();
    if (id !== transitionId || !isPlaying) {
      if (!isPlaying) current.pause();
      return;
    }
  } catch (error) {
    console.error(error);
    if (id !== transitionId) return;
    isPlaying = false;
    updateNextButton();
    icon.innerHTML = PLAY_ICON;
    icon.className = "play";
  }
}

function stopArchive() {
  if (isStopping || !isPlaying) return;
  const id = ++transitionId;
  clearTimeout(fadeTimer);
  resetTransitionProgress();
  manualFade = false;
  isPlaying = false;
  isStopping = true;
  overlapStarted = false;
  button.disabled = true;
  updateNextButton();

  const finishStop = () => {
    if (id !== transitionId) return;
    [audioA, audioB].forEach(player => {
      player.pause();
      resetGain(player);
      try { player.currentTime = 0; } catch (_) {}
    });
    current = audioA;
    next = audioB;
    currentIndex = -1;
    nextIndex = -1;
    isStopping = false;
    button.disabled = false;
    updateNextButton();
    icon.innerHTML = PLAY_ICON;
    icon.className = "play";
  };

  if (!audioContext) {
    finishStop();
    return;
  }
  const start = audioContext.currentTime;
  [audioA, audioB].forEach(player => {
    const gain = gains.get(player);
    // Hold the current level, including midway through a crossfade.
    if (typeof gain.cancelAndHoldAtTime === "function") {
      gain.cancelAndHoldAtTime(start);
    } else {
      const level = gain.value;
      gain.cancelScheduledValues(start);
      gain.setValueAtTime(level, start);
    }
    gain.linearRampToValueAtTime(0, start + STOP_FADE_SECONDS);
  });
  const checkStop = () => {
    if (id !== transitionId) return;
    if (audioContext.currentTime < start + STOP_FADE_SECONDS) {
      fadeTimer = setTimeout(checkStop, 50);
      return;
    }
    finishStop();
  };
  fadeTimer = setTimeout(checkStop, STOP_FADE_SECONDS * 1000);
}

button.addEventListener("click", () => {
  isPlaying ? stopArchive() : startArchive();
});

function updateFullscreenButton() {
  const isFullscreen = Boolean(document.fullscreenElement);

  enterFullscreenIcon.classList.toggle("is-hidden", isFullscreen);
  exitFullscreenIcon.classList.toggle("is-hidden", !isFullscreen);
  fullscreenButton.setAttribute(
    "aria-label",
    isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
  );
}

fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (error) {
    console.error("Fullscreen error:", error);
  }
});

document.addEventListener("fullscreenchange", updateFullscreenButton);
updateFullscreenButton();
