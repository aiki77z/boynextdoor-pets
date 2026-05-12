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
  detailsOpen: false,
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
const petButton = document.querySelector("#petButton");
const petList = document.querySelector("#petList");
const profileList = document.querySelector("#profileList");
const animationList = document.querySelector("#animationList");
const bubbleText = document.querySelector("#bubbleText");
const actionButtons = Array.from(document.querySelectorAll(".action-button"));
const pinButton = document.querySelector("#pinButton");
const detailsButton = document.querySelector("#detailsButton");
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
const PET_SCALE_STEPS = [0.8, 1, 1.2, 1.4, 1.6];

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
  state.petScale = Math.min(1.8, Math.max(0.7, nextScale));
  document.documentElement.style.setProperty("--pet-scale", String(state.petScale));
  window.localStorage.setItem("desktopPetScale", String(state.petScale));
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
    if (state.action === "idle") {
      speakRandomLine();
    }
  }, 7000);
}

function renderPetList() {
  petList.innerHTML = "";

  pets.forEach((pet) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pet-card ${pet.id === state.selectedPet.id ? "selected" : ""}`;
    button.disabled = !pet.ready;
    button.innerHTML = `
      <span class="pet-swatch" style="--swatch: ${pet.theme.secondary}"></span>
      <span>
        <strong>${pet.name}</strong>
        <small>${pet.ready ? pet.animalType : "coming soon"}</small>
      </span>
    `;
    button.addEventListener("click", () => selectPet(pet.id));
    petList.appendChild(button);
  });
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
  setAction("idle");
  render();
  scheduleBubbleRotation();

  if (options.syncShell !== false) {
    syncSelectedPet(petId);
  }
}

function selectNextPet() {
  const index = pets.findIndex((pet) => pet.id === state.selectedPet.id);
  const next = pets[(index + 1) % pets.length];
  selectPet(next.id);
}

function renderProfile() {
  const pet = state.selectedPet;
  const rows = [
    ["member", pet.member],
    ["animalType", pet.animalType],
    ["personality", pet.personality.join(" / ")],
    ["favoriteItem", pet.favoriteItem],
    ["favoriteFood", pet.favoriteFood],
    ["voiceLine", pet.voiceLine],
    ["visualStyle", pet.visualStyle]
  ];

  profileList.innerHTML = rows
    .map(([label, value]) => `<dt>${label}</dt><dd>${value || "pending"}</dd>`)
    .join("");
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

function renderAnimations() {
  const pet = state.selectedPet;
  animationList.innerHTML = ACTIONS.map((action) => {
    const description = pet.animations[action.id] || "No note yet.";
    return `<li><button type="button" data-action="${action.id}">${action.label}</button><span>${description}</span></li>`;
  }).join("");

  animationList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      triggerAction(button.dataset.action, 1800);
    });
  });
}

function scheduleAutoAction() {
  window.clearTimeout(state.autoActionTimer);
  const pick = AUTO_ACTIONS[Math.floor(Math.random() * AUTO_ACTIONS.length)];
  state.autoActionTimer = window.setTimeout(() => {
    triggerAction(pick.id, pick.durationMs, { auto: true });
  }, randomBetween(pick.minDelayMs, pick.maxDelayMs));
}

function setAction(action, options = {}) {
  window.clearTimeout(state.resetTimer);
  state.action = action;
  state.actionStartedAt = performance.now();
  moodLabel.textContent = action;

  actionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.action === action);
  });

  if (options.temporary) {
    state.resetTimer = window.setTimeout(() => {
      state.action = "idle";
      state.actionStartedAt = performance.now();
      moodLabel.textContent = "idle";
      actionButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.action === "idle");
      });
      scheduleAutoAction();
    }, options.durationMs || 1800);
    return;
  }

  scheduleAutoAction();
}

function triggerAction(action, durationMs = 1800, options = {}) {
  if (state.shellSettings.bubbleEnabled && !options.quiet) {
    speakRandomLine();
  }
  setAction(action, { temporary: action !== "idle", durationMs });
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
  document.body.classList.toggle("details-open", state.detailsOpen);
  document.body.classList.toggle("bubble-editor-open", state.bubbleEditorOpen);
  document.body.classList.toggle("bubbles-off", !state.shellSettings.bubbleEnabled);
  pinButton.classList.toggle("active", state.shellSettings.alwaysOnTop);
  bubbleToggleButton.classList.toggle("active", state.shellSettings.bubbleEnabled);
  detailsButton.classList.toggle("active", state.detailsOpen);
  bubbleEditorModal.setAttribute("aria-hidden", String(!state.bubbleEditorOpen));
}

function render() {
  const pet = state.selectedPet;
  document.documentElement.style.setProperty("--pet-primary", pet.theme.primary);
  document.documentElement.style.setProperty("--pet-secondary", pet.theme.secondary);
  document.documentElement.style.setProperty("--pet-accent", pet.theme.accent);
  petTitle.textContent = pet.name;
  bubbleText.textContent = state.shellSettings.bubbleEnabled ? getCurrentLines()[state.bubbleIndex] : "";
  renderPetList();
  renderProfile();
  renderAnimations();
  renderBubbleEditor();
  renderActionButtons();
  renderShellControls();
}

petButton.addEventListener("click", () => {
  cycleBubble(1);
  triggerAction("waving", 1700);
});

actionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    triggerAction(button.dataset.action, 1800);
  });
});

talkButton.addEventListener("click", () => {
  cycleBubble(1);
  triggerAction("waving", 1500, { quiet: true });
});

nextPetButton.addEventListener("click", () => {
  selectNextPet();
});

idleButton.addEventListener("click", () => {
  if (state.shellSettings.bubbleEnabled) speakRandomLine();
  setAction("idle");
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

petButton.addEventListener("dblclick", () => {
  setPetScale(1);
});

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

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.bubbleEditorOpen) {
    closeBubbleEditor();
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

  detailsButton.addEventListener("click", async () => {
    state.detailsOpen = !state.detailsOpen;
    await window.desktopPetShell.setDetailsOpen(state.detailsOpen);
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
    selectPet(state.shellSettings.selectedPetId || pets[0].id, { syncShell: false });
    renderShellControls();
    scheduleBubbleRotation();
  });

  window.desktopPetShell.onSettings((settings) => {
    state.shellSettings = { ...state.shellSettings, ...settings };
    renderShellControls();
  });

  window.desktopPetShell.onDetailsOpen((nextDetailsOpen) => {
    state.detailsOpen = Boolean(nextDetailsOpen);
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
setAction("idle");
scheduleBubbleRotation();
window.requestAnimationFrame(animatePet);
