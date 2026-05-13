const pets = window.BND_PETS;

const ATLAS = {
  cellWidth: 192,
  cellHeight: 208
};

const ACTIONS = [
  { id: "idle", label: "Idle", icon: "o", row: 0, frames: 6, fps: 4 },
  { id: "running-right", label: "Right", icon: ">", row: 1, frames: 8, fps: 10 },
  { id: "running-left", label: "Left", icon: "<", row: 2, frames: 8, fps: 10 },
  { id: "waving", label: "Wave", icon: "~", row: 3, frames: 4, fps: 6 },
  { id: "jumping", label: "Jump", icon: "^", row: 4, frames: 5, fps: 7 },
  { id: "failed", label: "Fail", icon: "!", row: 5, frames: 8, fps: 8 },
  { id: "waiting", label: "Wait", icon: "z", row: 6, frames: 6, fps: 4 },
  { id: "running", label: "Busy", icon: ">>", row: 7, frames: 6, fps: 8 },
  { id: "review", label: "Review", icon: "?", row: 8, frames: 6, fps: 5 }
];

const PET_SPRITESHEETS = {
  catbbi: "./hatch-runs/catbbi/final/spritesheet.webp",
  dalring: "./hatch-runs/dalring/final/spritesheet.webp",
  myngmyng: "./hatch-runs/myngmyng/final/spritesheet.webp",
  hantatpung: "./hatch-runs/hantatpung/final/spritesheet.webp",
  "312": "./hatch-runs/312/final/spritesheet.webp",
  woonbaby: "./hatch-runs/woonbaby/final/spritesheet.webp"
};

const AUTO_ACTIONS = [
  { id: "waving", minDelayMs: 4000, maxDelayMs: 8500, durationMs: 1800 },
  { id: "jumping", minDelayMs: 5000, maxDelayMs: 9000, durationMs: 1600 },
  { id: "waiting", minDelayMs: 7000, maxDelayMs: 12000, durationMs: 2600 },
  { id: "review", minDelayMs: 9000, maxDelayMs: 14000, durationMs: 2400 },
  { id: "running-right", minDelayMs: 6000, maxDelayMs: 11000, durationMs: 1500 },
  { id: "running-left", minDelayMs: 6000, maxDelayMs: 11000, durationMs: 1500 }
];

const ACTION_MAP = Object.fromEntries(ACTIONS.map((action) => [action.id, action]));

const state = {
  selectedPet: pets[0],
  action: "idle",
  bubbleIndex: 0,
  resetTimer: null,
  autoActionTimer: null,
  bubbleTimer: null,
  actionStartedAt: performance.now(),
  controlsOpen: false,
  controlsHoverOpen: false,
  bubbleEditorOpen: false,
  shellSettings: {
    alwaysOnTop: true,
    openAtLogin: true,
    bubbleEnabled: true,
    selectedPetId: pets[0].id
  },
  petScale: Number(window.localStorage.getItem("desktopPetScale") || "1")
};

const petTitle = document.querySelector("#petTitle");
const moodLabel = document.querySelector("#moodLabel");
const petCanvas = document.querySelector("#petCanvas");
const petCtx = petCanvas.getContext("2d");
const petRoom = document.querySelector("#petRoom");
const petCluster = document.querySelector("#petCluster");
const petButton = document.querySelector("#petButton");
const actionBar = document.querySelector(".action-bar");
const bubbleText = document.querySelector("#bubbleText");
const actionButtons = Array.from(document.querySelectorAll(".action-button"));
const pinButton = document.querySelector("#pinButton");
const hideButton = document.querySelector("#hideButton");
const quitButton = document.querySelector("#quitButton");
const talkButton = document.querySelector("#talkButton");
const nextPetButton = document.querySelector("#nextPetButton");
const bubbleToggleButton = document.querySelector("#bubbleToggleButton");
const idleButton = document.querySelector("#idleButton");
const scaleButton = document.querySelector("#scaleButton");
const editBubbleButton = document.querySelector("#editBubbleButton");
const bubbleEditorModal = document.querySelector("#bubbleEditorModal");
const bubbleEditorBackdrop = document.querySelector("#bubbleEditorBackdrop");
const bubbleEditor = document.querySelector("#bubbleEditor");
const saveBubbleButton = document.querySelector("#saveBubbleButton");
const resetBubbleButton = document.querySelector("#resetBubbleButton");

petCanvas.width = ATLAS.cellWidth * 2;
petCanvas.height = ATLAS.cellHeight * 2;

const imageCache = new Map();
const BUBBLE_TEXT_STORAGE_KEY = "desktopPetCustomBubbleText";
const PET_SCALE_STEPS = [0.35, 0.5, 0.65, 0.8, 1];
const DEFAULT_ACTION = "idle";

let dragState = null;
let suppressPetClickUntil = 0;
let controlsHoverTimer = null;

function readBubbleOverrides() {
  try {
    return JSON.parse(window.localStorage.getItem(BUBBLE_TEXT_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeBubbleOverrides(overrides) {
  window.localStorage.setItem(BUBBLE_TEXT_STORAGE_KEY, JSON.stringify(overrides));
}

function getBubbleLinesForPet(pet) {
  const overrides = readBubbleOverrides();
  const custom = overrides[pet.id];
  if (Array.isArray(custom) && custom.length) return custom;
  return pet.bubbleText;
}

function setPetScale(nextScale) {
  state.petScale = Math.min(1, Math.max(0.35, nextScale));
  document.documentElement.style.setProperty("--pet-scale", String(state.petScale));
  window.localStorage.setItem("desktopPetScale", String(state.petScale));
  if (window.desktopPetShell) {
    window.desktopPetShell.setPetScale(state.petScale);
  }
  updateScaleButtonLabel();
}

function updateScaleButtonLabel() {
  const currentPercent = Math.round(state.petScale * 100);
  scaleButton.title = `Scale Pet (${currentPercent}%)`;
  scaleButton.setAttribute("aria-label", `Scale Pet (${currentPercent}%)`);
}

function cyclePetScale() {
  const currentIndex = PET_SCALE_STEPS.findIndex((step) => Math.abs(step - state.petScale) < 0.05);
  const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % PET_SCALE_STEPS.length;
  setPetScale(PET_SCALE_STEPS[nextIndex]);
}

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function loadSpritesheet(petId) {
  if (imageCache.has(petId)) return imageCache.get(petId);

  const src = PET_SPRITESHEETS[petId];
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    image.src = src;
  });

  imageCache.set(petId, promise);
  return promise;
}

function getActionConfig(actionId) {
  return ACTION_MAP[actionId] || ACTION_MAP.idle;
}

function frameIndexFor(now) {
  const config = getActionConfig(state.action);
  const elapsedMs = now - state.actionStartedAt;
  const elapsedFrames = Math.floor((elapsedMs / 1000) * config.fps);
  return elapsedFrames % config.frames;
}

function drawPlaceholder(message) {
  petCtx.clearRect(0, 0, petCanvas.width, petCanvas.height);
  petCtx.fillStyle = "#ffffff";
  petCtx.fillRect(0, 0, petCanvas.width, petCanvas.height);
  petCtx.fillStyle = "#666666";
  petCtx.font = "16px system-ui, sans-serif";
  petCtx.textAlign = "center";
  petCtx.fillText(message, petCanvas.width / 2, petCanvas.height / 2);
}

function drawFrame(now, image) {
  const config = getActionConfig(state.action);
  const frame = frameIndexFor(now);
  const sx = frame * ATLAS.cellWidth;
  const sy = config.row * ATLAS.cellHeight;
  const padding = 6;
  const scale = Math.min(
    (petCanvas.width - padding * 2) / ATLAS.cellWidth,
    (petCanvas.height - padding * 2) / ATLAS.cellHeight
  );
  const dw = Math.round(ATLAS.cellWidth * scale);
  const dh = Math.round(ATLAS.cellHeight * scale);
  const dx = Math.round((petCanvas.width - dw) / 2);
  const dy = Math.round((petCanvas.height - dh) / 2);

  petCtx.clearRect(0, 0, petCanvas.width, petCanvas.height);
  petCtx.imageSmoothingEnabled = true;
  petCtx.drawImage(image, sx, sy, ATLAS.cellWidth, ATLAS.cellHeight, dx, dy, dw, dh);
}

function animatePet(now) {
  loadSpritesheet(state.selectedPet.id)
    .then((image) => drawFrame(now, image))
    .catch(() => drawPlaceholder("pet unavailable"));

  window.requestAnimationFrame(animatePet);
}

function getCurrentLines() {
  const lines = getBubbleLinesForPet(state.selectedPet);
  return Array.isArray(lines) && lines.length
    ? lines
    : [state.selectedPet.name];
}

function cycleBubble(step = 1) {
  const lines = getCurrentLines();
  state.bubbleIndex = (state.bubbleIndex + step + lines.length) % lines.length;
  bubbleText.textContent = lines[state.bubbleIndex];
}

function speakRandomLine() {
  const lines = getCurrentLines();
  state.bubbleIndex = Math.floor(Math.random() * lines.length);
  bubbleText.textContent = lines[state.bubbleIndex];
}

function scheduleBubbleRotation() {
  window.clearInterval(state.bubbleTimer);
  if (!state.shellSettings.bubbleEnabled) {
    bubbleText.textContent = "";
    return;
  }
  speakRandomLine();
  state.bubbleTimer = window.setInterval(() => {
    if (state.action === DEFAULT_ACTION) {
      speakRandomLine();
    }
  }, 7000);
}

async function syncSelectedPet(petId) {
  if (!window.desktopPetShell) return;
  await window.desktopPetShell.selectPet(petId);
}

function selectPet(petId, options = {}) {
  const nextPet = pets.find((pet) => pet.id === petId);
  if (!nextPet || !nextPet.ready) return;

  state.selectedPet = nextPet;
  state.bubbleIndex = 0;
  setAction(DEFAULT_ACTION);
  render();
  scheduleBubbleRotation();

  if (options.syncShell !== false) {
    syncSelectedPet(petId);
  }
}

function selectNextPet() {
  const readyPets = pets.filter((pet) => pet.ready);
  const index = readyPets.findIndex((pet) => pet.id === state.selectedPet.id);
  const next = readyPets[(index + 1) % readyPets.length];
  selectPet(next.id);
}

function renderBubbleEditor() {
  bubbleEditor.value = getCurrentLines().join("\n");
}

function openBubbleEditor() {
  state.bubbleEditorOpen = true;
  renderBubbleEditor();
  renderShellControls();

  window.setTimeout(() => {
    bubbleEditor.focus();
    bubbleEditor.setSelectionRange(bubbleEditor.value.length, bubbleEditor.value.length);
  }, 120);
}

function closeBubbleEditor() {
  state.bubbleEditorOpen = false;
  renderShellControls();
}

function scheduleAutoAction() {
  window.clearTimeout(state.autoActionTimer);
  if (state.action !== DEFAULT_ACTION) return;
  const pick = AUTO_ACTIONS[Math.floor(Math.random() * AUTO_ACTIONS.length)];
  state.autoActionTimer = window.setTimeout(() => {
    previewAction(pick.id, pick.durationMs, { auto: true });
  }, randomBetween(pick.minDelayMs, pick.maxDelayMs));
}

function setAction(action) {
  window.clearTimeout(state.resetTimer);
  state.action = action;
  state.actionStartedAt = performance.now();
  moodLabel.textContent = action;

  actionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.action === action);
  });

  scheduleAutoAction();
}

function previewAction(action, durationMs = 1800, options = {}) {
  window.clearTimeout(state.resetTimer);
  if (state.shellSettings.bubbleEnabled && !options.quiet) {
    speakRandomLine();
  }
  setAction(action);
  if (action === DEFAULT_ACTION) return;

  state.resetTimer = window.setTimeout(() => {
    setAction(DEFAULT_ACTION);
  }, durationMs);
}

function activateAction(action, options = {}) {
  window.clearTimeout(state.resetTimer);
  if (state.shellSettings.bubbleEnabled && !options.quiet) {
    speakRandomLine();
  }
  setAction(action);
}

function renderActionButtons() {
  actionButtons.forEach((button) => {
    const config = getActionConfig(button.dataset.action);
    button.textContent = config.icon;
    button.title = config.label;
    button.setAttribute("aria-label", config.label);
  });
}

function renderShellControls() {
  document.body.classList.toggle("bubble-editor-open", state.bubbleEditorOpen);
  document.body.classList.toggle("bubbles-off", !state.shellSettings.bubbleEnabled);
  document.body.classList.toggle("controls-visible", state.controlsOpen || state.controlsHoverOpen);
  pinButton.classList.toggle("active", state.shellSettings.alwaysOnTop);
  bubbleToggleButton.classList.toggle("active", state.shellSettings.bubbleEnabled);
  bubbleEditorModal.setAttribute("aria-hidden", String(!state.bubbleEditorOpen));
}

function render() {
  const pet = state.selectedPet;
  document.documentElement.style.setProperty("--pet-primary", pet.theme.primary);
  document.documentElement.style.setProperty("--pet-secondary", pet.theme.secondary);
  document.documentElement.style.setProperty("--pet-accent", pet.theme.accent);
  petTitle.textContent = pet.name;
  bubbleText.textContent = state.shellSettings.bubbleEnabled ? getCurrentLines()[state.bubbleIndex] : "";
  renderBubbleEditor();
  renderActionButtons();
  renderShellControls();
}

petButton.addEventListener("click", () => {
  if (Date.now() < suppressPetClickUntil) return;
  cycleBubble(1);
  activateAction("waving");
});

actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateAction(button.dataset.action);
  });
});

talkButton.addEventListener("click", () => {
  cycleBubble(1);
  activateAction("waving", { quiet: true });
});

nextPetButton.addEventListener("click", () => {
  selectNextPet();
});

idleButton.addEventListener("click", () => {
  if (state.shellSettings.bubbleEnabled) speakRandomLine();
  setAction(DEFAULT_ACTION);
});

scaleButton.addEventListener("click", () => {
  cyclePetScale();
});

editBubbleButton.addEventListener("click", async () => {
  openBubbleEditor();
});

petRoom.addEventListener("wheel", (event) => {
  event.preventDefault();
  const delta = event.deltaY > 0 ? -0.06 : 0.06;
  setPetScale(state.petScale + delta);
}, { passive: false });

saveBubbleButton.addEventListener("click", () => {
  const lines = bubbleEditor.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const overrides = readBubbleOverrides();
  overrides[state.selectedPet.id] = lines.length ? lines : state.selectedPet.bubbleText;
  writeBubbleOverrides(overrides);
  state.bubbleIndex = 0;
  render();
  scheduleBubbleRotation();
  closeBubbleEditor();
});

resetBubbleButton.addEventListener("click", () => {
  const overrides = readBubbleOverrides();
  delete overrides[state.selectedPet.id];
  writeBubbleOverrides(overrides);
  state.bubbleIndex = 0;
  render();
  scheduleBubbleRotation();
});

bubbleEditorBackdrop.addEventListener("click", () => {
  closeBubbleEditor();
});

function beginPetDrag(event) {
  if (!window.desktopPetShell || event.button !== 0) return;
  dragState = { x: event.screenX, y: event.screenY, pointerId: event.pointerId, moved: false };
  petCluster.setPointerCapture(event.pointerId);
  document.body.classList.add("dragging-pet");
  window.desktopPetShell.startWindowDrag();
}

function updatePetDrag(event) {
  if (!dragState) return;
  const deltaX = event.screenX - dragState.x;
  const deltaY = event.screenY - dragState.y;
  if (Math.abs(deltaX) + Math.abs(deltaY) > 3) {
    dragState.moved = true;
  }
}

function endPetDrag(event) {
  if (!dragState) return;
  if (window.desktopPetShell) {
    window.desktopPetShell.stopWindowDrag();
  }
  if (event?.pointerId !== undefined) {
    try {
      petCluster.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer may already be released.
    }
  }
  if (dragState.moved) {
    suppressPetClickUntil = Date.now() + 180;
  }
  dragState = null;
  document.body.classList.remove("dragging-pet");
}

petCluster.addEventListener("pointerdown", beginPetDrag);
petCluster.addEventListener("pointermove", updatePetDrag);
petCluster.addEventListener("pointerup", endPetDrag);
petCluster.addEventListener("pointercancel", endPetDrag);

function setControlsHoverOpen(open) {
  window.clearTimeout(controlsHoverTimer);
  state.controlsHoverOpen = open;
  renderShellControls();
}

petCluster.addEventListener("mouseenter", () => {
  setControlsHoverOpen(true);
});

petCluster.addEventListener("mouseleave", () => {
  controlsHoverTimer = window.setTimeout(() => setControlsHoverOpen(false), 180);
});

actionBar.addEventListener("mouseenter", () => {
  setControlsHoverOpen(true);
});

actionBar.addEventListener("mouseleave", () => {
  controlsHoverTimer = window.setTimeout(() => setControlsHoverOpen(false), 180);
});

document.addEventListener("click", (event) => {
  const clickedInsideControls = event.target.closest(".action-bar, .floating-toolbar, .side-action, .bubble-editor-dialog");
  const clickedPet = event.target.closest("#petButton");
  if (clickedPet) {
    return;
  }

  if (!clickedInsideControls) {
    state.controlsOpen = false;
    renderShellControls();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.bubbleEditorOpen) {
    closeBubbleEditor();
  }
  if (event.key === "Escape" && state.controlsOpen) {
    state.controlsOpen = false;
    renderShellControls();
  }
});

if (window.desktopPetShell) {
  bubbleToggleButton.addEventListener("click", async () => {
    const next = !state.shellSettings.bubbleEnabled;
    state.shellSettings = {
      ...state.shellSettings,
      ...(await window.desktopPetShell.setBubbleEnabled(next))
    };
    renderShellControls();
    scheduleBubbleRotation();
  });

  pinButton.addEventListener("click", async () => {
    state.shellSettings = {
      ...state.shellSettings,
      ...(await window.desktopPetShell.toggleAlwaysOnTop())
    };
    renderShellControls();
  });

  hideButton.addEventListener("click", async () => {
    await window.desktopPetShell.hideWindow();
  });

  quitButton.addEventListener("click", async () => {
    await window.desktopPetShell.quit();
  });

  window.desktopPetShell.getSettings().then((settings) => {
    state.shellSettings = { ...state.shellSettings, ...settings };
    if (!state.shellSettings.bubbleEnabled) {
      state.shellSettings.bubbleEnabled = true;
      window.desktopPetShell.setBubbleEnabled(true);
    }
    selectPet(state.shellSettings.selectedPetId || pets[0].id, { syncShell: false });
    renderShellControls();
    scheduleBubbleRotation();
  });

  window.desktopPetShell.onSettings((settings) => {
    state.shellSettings = { ...state.shellSettings, ...settings };
    renderShellControls();
  });

  window.desktopPetShell.onPetSelected(({ petId }) => {
    selectPet(petId, { syncShell: false });
  });

  window.desktopPetShell.onBubblesEnabled((enabled) => {
    state.shellSettings = { ...state.shellSettings, bubbleEnabled: Boolean(enabled) };
    renderShellControls();
    scheduleBubbleRotation();
  });
}

render();
setPetScale(state.petScale);
setAction(DEFAULT_ACTION);
scheduleBubbleRotation();
window.requestAnimationFrame(animatePet);
