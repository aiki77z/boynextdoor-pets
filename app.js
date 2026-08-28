const pets = window.BND_PETS;
pets.sort((left, right) => left.id.localeCompare(right.id));
const APP_MODE = document.documentElement.dataset.appMode || "desktop";
const IS_IPAD_MODE = APP_MODE === "ipad";
const HAS_DESKTOP_SHELL = Boolean(window.desktopPetShell);
const DEFAULT_PET_ID = "catbbi";
const DEFAULT_PET = pets.find((pet) => pet.id === DEFAULT_PET_ID) || pets[0];

const ATLAS = {
  cellWidth: 192,
  cellHeight: 208
};

const ACTIONS = [
  { id: "idle", label: "待机", icon: "o", row: 0, frames: 6, fps: 4 },
  { id: "running-right", label: "向右", icon: ">", row: 1, frames: 8, fps: 10 },
  { id: "running-left", label: "向左", icon: "<", row: 2, frames: 8, fps: 10 },
  { id: "waving", label: "挥手", icon: "~", row: 3, frames: 4, fps: 6 },
  { id: "jumping", label: "跳跃", icon: "^", row: 4, frames: 5, fps: 7 },
  { id: "failed", label: "失败", icon: "!", row: 5, frames: 8, fps: 8 },
  { id: "waiting", label: "等待", icon: "z", row: 6, frames: 6, fps: 4 },
  { id: "running", label: "忙碌", icon: ">>", row: 7, frames: 6, fps: 8 },
  { id: "review", label: "检查", icon: "?", row: 8, frames: 6, fps: 5 }
];

const PET_SPRITESHEETS = Object.fromEntries(
  pets.map((pet) => [pet.id, pet.spritePath || `./${pet.id}/final/spritesheet.webp`])
);
const SPRITE_ALPHA_THRESHOLD = 18;
const NORMALIZED_DRAW_RATIO = { width: 0.82, height: 0.84 };

const NORMAL_ACTION_CYCLE = [
  { id: "waving", durationMs: 1800 },
  { id: "jumping", durationMs: 1600 },
  { id: "failed", durationMs: 1900 },
  { id: "waiting", durationMs: 2600 },
  { id: "running", durationMs: 1800 },
  { id: "review", durationMs: 2400 }
];
const NORMAL_ACTION_IDLE_GAP_MS = 1200;

const ACTION_MAP = Object.fromEntries(ACTIONS.map((action) => [action.id, action]));
const ACTION_PREVIEW_DURATIONS = {
  waving: 1800,
  jumping: 1600,
  failed: 1900,
  waiting: 2600,
  review: 2400
};

const state = {
  selectedPet: DEFAULT_PET,
  action: "idle",
  bubbleIndex: 0,
  resetTimer: null,
  autoActionTimer: null,
  bubbleTimer: null,
  actionStartedAt: performance.now(),
  controlsOpen: false,
  controlsHoverOpen: false,
  companionMode: false,
  patrolMode: false,
  bubbleEditorOpen: false,
  nameEditorOpen: false,
  bubbleDraftLines: [],
  selectedBubbleLineIndex: 0,
  bubbleLineEditMode: null,
  shellSettings: {
    alwaysOnTop: true,
    openAtLogin: true,
    bubbleEnabled: true,
    petId: DEFAULT_PET.id,
    activePetIds: [DEFAULT_PET.id],
    hideDockIcon: false,
    patrolMode: false
  },
  petScale: 0.6
};

const ipadDragOffset = { x: 0, y: 0 };

const petTitle = document.querySelector("#petTitle");
const petCanvas = document.querySelector("#petCanvas");
const petCtx = petCanvas.getContext("2d");
const petRoom = document.querySelector("#petRoom");
const petCluster = document.querySelector("#petCluster");
const petButton = document.querySelector("#petButton");
const petPicker = document.querySelector("#petPicker");
const actionBar = document.querySelector(".action-bar");
const bubbleText = document.querySelector("#bubbleText");
const actionButtons = Array.from(document.querySelectorAll(".action-button"));
const pinButton = document.querySelector("#pinButton");
const hideButton = document.querySelector("#hideButton");
const quitButton = document.querySelector("#quitButton");
const talkButton = document.querySelector("#talkButton");
const closePetButton = document.querySelector("#closePetButton");
const bubbleToggleButton = document.querySelector("#bubbleToggleButton");
const settingsMenuButton = document.querySelector("#settingsMenuButton");
const companionButton = document.querySelector("#companionButton");
const idleButton = document.querySelector("#idleButton");
const scaleButton = document.querySelector("#scaleButton");
const renamePetButton = document.querySelector("#renamePetButton");
const editBubbleButton = document.querySelector("#editBubbleButton");
const bubbleEditorModal = document.querySelector("#bubbleEditorModal");
const bubbleEditorBackdrop = document.querySelector("#bubbleEditorBackdrop");
const nameEditorModal = document.querySelector("#nameEditorModal");
const nameEditorBackdrop = document.querySelector("#nameEditorBackdrop");
const petNameInput = document.querySelector("#petNameInput");
const savePetNameButton = document.querySelector("#savePetNameButton");
const resetPetNameButton = document.querySelector("#resetPetNameButton");
const cancelPetNameButton = document.querySelector("#cancelPetNameButton");
const bubbleLineList = document.querySelector("#bubbleLineList");
const bubbleLineForm = document.querySelector("#bubbleLineForm");
const bubbleLineInput = document.querySelector("#bubbleLineInput");
const addBubbleLineButton = document.querySelector("#addBubbleLineButton");
const editBubbleLineButton = document.querySelector("#editBubbleLineButton");
const deleteBubbleLineButton = document.querySelector("#deleteBubbleLineButton");
const confirmBubbleLineButton = document.querySelector("#confirmBubbleLineButton");
const cancelBubbleLineButton = document.querySelector("#cancelBubbleLineButton");
const saveBubbleButton = document.querySelector("#saveBubbleButton");
const resetBubbleButton = document.querySelector("#resetBubbleButton");
const cancelBubbleEditorButton = document.querySelector("#cancelBubbleEditorButton");

petCanvas.width = ATLAS.cellWidth * 2;
petCanvas.height = ATLAS.cellHeight * 2;

const petAssetCache = new Map();
const BUBBLE_TEXT_STORAGE_KEY = "desktopPetCustomBubbleText";
const PET_NAME_STORAGE_KEY = "desktopPetCustomNames";
const PET_NAME_MAX_LENGTH = 12;
const PET_SCALE_STEPS = [0.4, 0.5, 0.6, 0.7];
const DEFAULT_ACTION = "idle";

let dragState = null;
let suppressPetClickUntil = 0;
let controlsHoverTimer = null;
let currentFrameBounds = { x: 0, y: 0, width: petCanvas.width, height: petCanvas.height };
let petInputTransparent = false;
let normalActionCycleIndex = 0;

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

function readNameOverrides() {
  try {
    return JSON.parse(window.localStorage.getItem(PET_NAME_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeNameOverrides(overrides) {
  window.localStorage.setItem(PET_NAME_STORAGE_KEY, JSON.stringify(overrides));
}

function getPetDisplayName(pet) {
  const overrides = readNameOverrides();
  const customName = String(overrides[pet.id] || "").trim();
  return customName || pet.name;
}

function fitPetTitle() {
  petTitle.style.fontSize = "";
  let size = 9;
  while (petTitle.scrollWidth > petTitle.clientWidth && size > 7) {
    size -= 0.5;
    petTitle.style.fontSize = `${size}px`;
  }
}

function setPetTitleText(text) {
  petTitle.textContent = text;
  petTitle.title = text;
  window.requestAnimationFrame(fitPetTitle);
}

function getBubbleLinesForPet(pet) {
  const overrides = readBubbleOverrides();
  const custom = overrides[pet.id];
  if (Array.isArray(custom) && custom.length) return custom;
  return pet.bubbleText;
}

function setPetScale(nextScale, options = {}) {
  state.petScale = Math.min(0.7, Math.max(0.35, nextScale));
  document.documentElement.style.setProperty("--pet-scale", String(state.petScale));
  if (options.syncShell !== false && HAS_DESKTOP_SHELL) {
    window.desktopPetShell.setPetScale(state.petScale);
  }
  updateScaleButtonLabel();
}

function updateScaleButtonLabel() {
  const currentPercent = Math.round(state.petScale * 100);
  scaleButton.title = `缩放宠物 (${currentPercent}%)`;
  scaleButton.setAttribute("aria-label", `缩放宠物 (${currentPercent}%)`);
}

function cyclePetScale() {
  const currentIndex = PET_SCALE_STEPS.findIndex((step) => Math.abs(step - state.petScale) < 0.05);
  const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % PET_SCALE_STEPS.length;
  setPetScale(PET_SCALE_STEPS[nextIndex]);
}

function openPetNameEditor() {
  state.nameEditorOpen = true;
  state.controlsOpen = false;
  state.controlsHoverOpen = false;
  petNameInput.value = getPetDisplayName(state.selectedPet);
  renderShellControls();
  window.setTimeout(() => {
    petNameInput.focus();
    petNameInput.select();
  }, 40);
}

function closePetNameEditor() {
  state.nameEditorOpen = false;
  renderShellControls();
}

function savePetNameFromEditor() {
  const pet = state.selectedPet;
  const nextName = petNameInput.value;

  const overrides = readNameOverrides();
  const normalized = nextName.trim();
  if (normalized) {
    overrides[pet.id] = normalized.slice(0, PET_NAME_MAX_LENGTH);
  } else {
    delete overrides[pet.id];
  }
  writeNameOverrides(overrides);
  render();
  closePetNameEditor();
}

function randomBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function findOpaqueBounds(imageData, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = imageData[(y * width + x) * 4 + 3];
      if (alpha < SPRITE_ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function computeSpriteSourceBounds(image) {
  const probeCanvas = document.createElement("canvas");
  probeCanvas.width = image.width;
  probeCanvas.height = image.height;
  const probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
  probeCtx.drawImage(image, 0, 0);

  let union = null;
  for (const action of ACTIONS) {
    for (let frame = 0; frame < action.frames; frame += 1) {
      const data = probeCtx.getImageData(
        frame * ATLAS.cellWidth,
        action.row * ATLAS.cellHeight,
        ATLAS.cellWidth,
        ATLAS.cellHeight
      ).data;
      const bounds = findOpaqueBounds(data, ATLAS.cellWidth, ATLAS.cellHeight);
      if (!bounds) continue;

      if (!union) {
        union = bounds;
        continue;
      }

      const nextMinX = Math.min(union.x, bounds.x);
      const nextMinY = Math.min(union.y, bounds.y);
      const nextMaxX = Math.max(union.x + union.width, bounds.x + bounds.width);
      const nextMaxY = Math.max(union.y + union.height, bounds.y + bounds.height);
      union = {
        x: nextMinX,
        y: nextMinY,
        width: nextMaxX - nextMinX,
        height: nextMaxY - nextMinY
      };
    }
  }

  return union || { x: 0, y: 0, width: ATLAS.cellWidth, height: ATLAS.cellHeight };
}

function loadPetAsset(petId) {
  if (petAssetCache.has(petId)) return petAssetCache.get(petId);

  const src = PET_SPRITESHEETS[petId];
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve({ image, bounds: computeSpriteSourceBounds(image) }));
    image.addEventListener("error", () => reject(new Error(`加载失败：${src}`)));
    image.src = src;
  });

  petAssetCache.set(petId, promise);
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

function jumpOffsetForFrame(frame, frameCount, scale) {
  if (state.action !== "jumping" || frameCount <= 1) return 0;
  const progress = frame / (frameCount - 1);
  const arc = Math.sin(progress * Math.PI);
  return -Math.round(22 * scale * arc);
}

function drawingScaleForAction(maxScale) {
  const baseScale = maxScale;
  if (state.action !== "jumping") return baseScale;
  return Math.min(baseScale, maxScale * 0.81);
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

function drawFrame(now, petAsset) {
  const { image, bounds } = petAsset;
  const config = getActionConfig(state.action);
  const frame = frameIndexFor(now);
  const sx = frame * ATLAS.cellWidth + bounds.x;
  const sy = config.row * ATLAS.cellHeight + bounds.y;
  const sourceWidth = Math.max(1, bounds.width);
  const sourceHeight = Math.max(1, bounds.height);
  const maxScale = Math.min(
    (petCanvas.width * NORMALIZED_DRAW_RATIO.width) / sourceWidth,
    (petCanvas.height * NORMALIZED_DRAW_RATIO.height) / sourceHeight
  );
  const scale = drawingScaleForAction(maxScale);
  const dw = Math.round(sourceWidth * scale);
  const dh = Math.round(sourceHeight * scale);
  const dx = Math.round((petCanvas.width - dw) / 2);
  const motionScale = Math.min(dw / ATLAS.cellWidth, dh / ATLAS.cellHeight);
  const dy = Math.round((petCanvas.height - dh) / 2) + jumpOffsetForFrame(frame, config.frames, motionScale);

  petCtx.clearRect(0, 0, petCanvas.width, petCanvas.height);
  petCtx.imageSmoothingEnabled = true;
  petCtx.imageSmoothingQuality = "high";
  petCtx.drawImage(image, sx, sy, sourceWidth, sourceHeight, dx, dy, dw, dh);
  currentFrameBounds = { x: dx, y: dy, width: dw, height: dh };
}

function canvasPointFromClient(clientX, clientY) {
  const rect = petCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: Math.round(((clientX - rect.left) / rect.width) * petCanvas.width),
    y: Math.round(((clientY - rect.top) / rect.height) * petCanvas.height)
  };
}

function isPointInsideDrawnFrame(point) {
  return point
    && point.x >= currentFrameBounds.x
    && point.x < currentFrameBounds.x + currentFrameBounds.width
    && point.y >= currentFrameBounds.y
    && point.y < currentFrameBounds.y + currentFrameBounds.height;
}

function isPetBodyAtClientPoint(clientX, clientY) {
  const point = canvasPointFromClient(clientX, clientY);
  if (!isPointInsideDrawnFrame(point)) return false;

  try {
    const alpha = petCtx.getImageData(point.x, point.y, 1, 1).data[3];
    return alpha >= Number(getComputedStyle(document.documentElement).getPropertyValue("--pet-hit-alpha")) || alpha >= 18;
  } catch {
    return true;
  }
}

function isPetBodyPointerEvent(event) {
  if (event.detail === 0 && event.clientX === 0 && event.clientY === 0) return true;
  return isPetBodyAtClientPoint(event.clientX, event.clientY);
}

function setPetInputTransparent(transparent) {
  const next = Boolean(transparent);
  if (!HAS_DESKTOP_SHELL || petInputTransparent === next || !window.desktopPetShell.setPetInputTransparent) return;
  petInputTransparent = next;
  window.desktopPetShell.setPetInputTransparent(next);
}

function animatePet(now) {
  loadPetAsset(state.selectedPet.id)
    .then((petAsset) => drawFrame(now, petAsset))
    .catch(() => drawPlaceholder("宠物暂不可用"));

  window.requestAnimationFrame(animatePet);
}

function getCurrentLines() {
  const lines = getBubbleLinesForPet(state.selectedPet);
  return Array.isArray(lines) && lines.length
    ? lines
    : [state.selectedPet.name];
}

function calculateBubbleWidth(text) {
  const length = Array.from(String(text || "").trim()).length;
  return Math.min(210, Math.max(72, 42 + length * 8));
}

function setBubbleText(text) {
  const nextText = String(text || "");
  bubbleText.textContent = nextText;
  bubbleText.style.setProperty("--bubble-width", `${calculateBubbleWidth(nextText)}px`);
}

function cycleBubble(step = 1) {
  const lines = getCurrentLines();
  state.bubbleIndex = (state.bubbleIndex + step + lines.length) % lines.length;
  setBubbleText(lines[state.bubbleIndex]);
}

function speakRandomLine() {
  const lines = getCurrentLines();
  state.bubbleIndex = Math.floor(Math.random() * lines.length);
  setBubbleText(lines[state.bubbleIndex]);
}

function scheduleBubbleRotation() {
  window.clearInterval(state.bubbleTimer);
  if (!state.shellSettings.bubbleEnabled) {
    setBubbleText("");
    return;
  }
  speakRandomLine();
  state.bubbleTimer = window.setInterval(() => {
    if (state.action === DEFAULT_ACTION) {
      speakRandomLine();
    }
  }, 7000);
}

function selectPet(petId) {
  const nextPet = pets.find((pet) => pet.id === petId);
  if (!nextPet || !nextPet.ready) return;

  state.selectedPet = nextPet;
  state.bubbleIndex = 0;
  setAction(DEFAULT_ACTION);
  render();
  scheduleBubbleRotation();
}

function renderPetPicker() {
  if (!petPicker) return;
  petPicker.innerHTML = "";

  pets
    .filter((pet) => pet.ready)
    .forEach((pet) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `pet-picker-button ${pet.id === state.selectedPet.id ? "active" : ""}`;
      button.textContent = getPetDisplayName(pet);
      button.setAttribute("aria-pressed", String(pet.id === state.selectedPet.id));
      button.addEventListener("click", () => selectPet(pet.id));
      petPicker.appendChild(button);
    });
}

function normalizeBubbleLines(lines) {
  return lines
    .map((line) => String(line).trim())
    .filter(Boolean);
}

function renderBubbleEditor() {
  bubbleLineList.innerHTML = "";

  state.bubbleDraftLines.forEach((line, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `bubble-line-item ${index === state.selectedBubbleLineIndex ? "selected" : ""}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(index === state.selectedBubbleLineIndex));
    button.innerHTML = `<span>${index + 1}</span><strong></strong>`;
    button.querySelector("strong").textContent = line;
    button.addEventListener("click", () => {
      state.selectedBubbleLineIndex = index;
      renderBubbleEditor();
    });
    button.addEventListener("dblclick", () => {
      openBubbleLineForm("edit");
    });
    bubbleLineList.appendChild(button);
  });

  if (!state.bubbleDraftLines.length) {
    const empty = document.createElement("p");
    empty.className = "bubble-line-empty";
    empty.textContent = "还没有气泡文字。点击新增来添加一句。";
    bubbleLineList.appendChild(empty);
  }

  editBubbleLineButton.disabled = !state.bubbleDraftLines.length;
  deleteBubbleLineButton.disabled = !state.bubbleDraftLines.length;
  bubbleLineForm.hidden = state.bubbleLineEditMode === null;
}

function openBubbleLineForm(mode) {
  state.bubbleLineEditMode = mode;
  const selectedLine = state.bubbleDraftLines[state.selectedBubbleLineIndex] || "";
  bubbleLineInput.value = mode === "edit" ? selectedLine : "";
  renderBubbleEditor();

  window.setTimeout(() => {
    bubbleLineInput.focus();
    bubbleLineInput.setSelectionRange(bubbleLineInput.value.length, bubbleLineInput.value.length);
  }, 40);
}

function closeBubbleLineForm() {
  state.bubbleLineEditMode = null;
  bubbleLineInput.value = "";
  renderBubbleEditor();
}

function confirmBubbleLineForm() {
  const value = bubbleLineInput.value.trim();
  if (!value) {
    bubbleLineInput.focus();
    return;
  }

  if (state.bubbleLineEditMode === "edit" && state.bubbleDraftLines.length) {
    state.bubbleDraftLines[state.selectedBubbleLineIndex] = value;
  } else {
    state.bubbleDraftLines.push(value);
    state.selectedBubbleLineIndex = state.bubbleDraftLines.length - 1;
  }

  closeBubbleLineForm();
}

function openBubbleEditor() {
  state.bubbleEditorOpen = true;
  state.controlsOpen = false;
  state.controlsHoverOpen = false;
  state.bubbleDraftLines = [...getCurrentLines()];
  state.selectedBubbleLineIndex = 0;
  state.bubbleLineEditMode = null;
  if (HAS_DESKTOP_SHELL) {
    window.desktopPetShell.setBubbleEditorOpen(true);
  }
  renderBubbleEditor();
  renderShellControls();
}

function closeBubbleEditor() {
  state.bubbleEditorOpen = false;
  state.bubbleLineEditMode = null;
  if (HAS_DESKTOP_SHELL) {
    window.desktopPetShell.setBubbleEditorOpen(false);
  }
  renderShellControls();
}

function scheduleAutoAction() {
  window.clearTimeout(state.autoActionTimer);
  if (state.patrolMode || state.action !== DEFAULT_ACTION) return;

  state.autoActionTimer = window.setTimeout(() => {
    if (state.patrolMode || state.action !== DEFAULT_ACTION) return;
    const pick = NORMAL_ACTION_CYCLE[normalActionCycleIndex % NORMAL_ACTION_CYCLE.length];
    normalActionCycleIndex += 1;
    previewAction(pick.id, pick.durationMs, { auto: true });
  }, NORMAL_ACTION_IDLE_GAP_MS);
}

function setAction(action) {
  window.clearTimeout(state.resetTimer);
  state.action = action;
  state.actionStartedAt = performance.now();

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

function runCommandAction(action, options = {}) {
  if (action === "running-left" || action === "running-right") {
    state.patrolMode = Boolean(options.patrol);
    window.clearTimeout(state.autoActionTimer);
  }

  if (action === DEFAULT_ACTION) {
    setAction(DEFAULT_ACTION);
    return;
  }

  if (options.hold) {
    activateAction(action, options);
    return;
  }

  previewAction(action, ACTION_PREVIEW_DURATIONS[action] || 1800, options);
}

function renderActionButtons() {
  actionButtons.forEach((button) => {
    const config = getActionConfig(button.dataset.action);
    button.textContent = config.icon;
    button.title = config.label;
    button.setAttribute("aria-label", config.label);
  });
}

function setCompanionMode(enabled) {
  state.companionMode = Boolean(enabled);
  if (state.companionMode) {
    state.controlsOpen = false;
    state.controlsHoverOpen = false;
    if (state.nameEditorOpen) {
      state.nameEditorOpen = false;
    }
    if (state.bubbleEditorOpen) {
      state.bubbleEditorOpen = false;
      state.bubbleLineEditMode = null;
      if (HAS_DESKTOP_SHELL) {
        window.desktopPetShell.setBubbleEditorOpen(false);
      }
    }
  }
  if (HAS_DESKTOP_SHELL) {
    window.desktopPetShell.setCompanionMode(state.companionMode);
  }
  renderShellControls();
}

function ensureBubbleContent() {
  if (!state.shellSettings.bubbleEnabled) {
    setBubbleText("");
    return;
  }

  if (bubbleText.textContent.trim()) return;

  const lines = getCurrentLines();
  const safeIndex = Math.min(state.bubbleIndex, lines.length - 1);
  state.bubbleIndex = Math.max(0, safeIndex);
  setBubbleText(lines[state.bubbleIndex] || state.selectedPet.name);
}

function renderShellControls() {
  document.body.classList.toggle("bubble-editor-open", state.bubbleEditorOpen);
  document.body.classList.toggle("name-editor-open", state.nameEditorOpen);
  document.body.classList.toggle("bubbles-off", !state.shellSettings.bubbleEnabled);
  document.body.classList.toggle("companion-mode", state.companionMode);
  document.body.classList.toggle("patrol-mode", state.patrolMode);
  document.body.classList.toggle("controls-visible", !state.companionMode && (state.controlsOpen || state.controlsHoverOpen));
  pinButton.classList.toggle("active", state.shellSettings.alwaysOnTop);
  bubbleToggleButton.classList.toggle("active", state.shellSettings.bubbleEnabled);
  companionButton.classList.toggle("active", state.companionMode);
  companionButton.title = state.companionMode ? "双击宠物退出陪伴模式" : "陪伴模式";
  companionButton.setAttribute("aria-label", companionButton.title);
  bubbleEditorModal.setAttribute("aria-hidden", String(!state.bubbleEditorOpen));
  nameEditorModal.setAttribute("aria-hidden", String(!state.nameEditorOpen));
  ensureBubbleContent();
}

function render() {
  const pet = state.selectedPet;
  document.documentElement.style.setProperty("--pet-primary", pet.theme.primary);
  document.documentElement.style.setProperty("--pet-secondary", pet.theme.secondary);
  document.documentElement.style.setProperty("--pet-accent", pet.theme.accent);
  setPetTitleText(getPetDisplayName(pet));
  setBubbleText(state.shellSettings.bubbleEnabled ? getCurrentLines()[state.bubbleIndex] : "");
  renderBubbleEditor();
  renderActionButtons();
  renderPetPicker();
  renderShellControls();
}

petButton.addEventListener("pointermove", (event) => {
  const transparent = !isPetBodyPointerEvent(event);
  petButton.classList.toggle("hit-transparent", transparent);
  setPetInputTransparent(transparent);
});

petButton.addEventListener("pointerleave", () => {
  petButton.classList.remove("hit-transparent");
  setPetInputTransparent(false);
});

petButton.addEventListener("click", (event) => {
  if (!isPetBodyPointerEvent(event)) {
    setPetInputTransparent(true);
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  setPetInputTransparent(false);
  if (Date.now() < suppressPetClickUntil) return;
  if (state.companionMode) return;
  window.clearTimeout(controlsHoverTimer);
  state.controlsOpen = !HAS_DESKTOP_SHELL;
  state.controlsHoverOpen = false;
  renderShellControls();
  cycleBubble(1);
  activateAction("jumping");
});

petButton.addEventListener("contextmenu", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!isPetBodyPointerEvent(event)) {
    setPetInputTransparent(true);
    return;
  }
  setPetInputTransparent(false);
  state.controlsOpen = false;
  state.controlsHoverOpen = false;
  renderShellControls();
  if (HAS_DESKTOP_SHELL && window.desktopPetShell.showControlMenu) {
    await window.desktopPetShell.showControlMenu();
  }
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

closePetButton.addEventListener("click", async () => {
  if (!window.desktopPetShell) return;
  await window.desktopPetShell.closeCurrentPet();
});

idleButton.addEventListener("click", () => {
  if (state.shellSettings.bubbleEnabled) speakRandomLine();
  setAction(DEFAULT_ACTION);
});

scaleButton.addEventListener("click", () => {
  cyclePetScale();
});

renamePetButton.addEventListener("click", () => {
  openPetNameEditor();
});

savePetNameButton.addEventListener("click", () => {
  savePetNameFromEditor();
});

resetPetNameButton.addEventListener("click", () => {
  petNameInput.value = "";
  savePetNameFromEditor();
});

cancelPetNameButton.addEventListener("click", () => {
  closePetNameEditor();
});

nameEditorBackdrop.addEventListener("click", () => {
  closePetNameEditor();
});

petNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    savePetNameFromEditor();
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closePetNameEditor();
  }
});

editBubbleButton.addEventListener("click", async () => {
  openBubbleEditor();
});

companionButton.addEventListener("click", () => {
  setCompanionMode(true);
});

petRoom.addEventListener("wheel", (event) => {
  event.preventDefault();
  const delta = event.deltaY > 0 ? -0.06 : 0.06;
  setPetScale(state.petScale + delta);
}, { passive: false });

addBubbleLineButton.addEventListener("click", () => {
  openBubbleLineForm("add");
});

editBubbleLineButton.addEventListener("click", () => {
  if (!state.bubbleDraftLines.length) return;
  openBubbleLineForm("edit");
});

deleteBubbleLineButton.addEventListener("click", () => {
  if (!state.bubbleDraftLines.length) return;
  state.bubbleDraftLines.splice(state.selectedBubbleLineIndex, 1);
  state.selectedBubbleLineIndex = Math.max(0, Math.min(state.selectedBubbleLineIndex, state.bubbleDraftLines.length - 1));
  closeBubbleLineForm();
});

confirmBubbleLineButton.addEventListener("click", () => {
  confirmBubbleLineForm();
});

cancelBubbleLineButton.addEventListener("click", () => {
  closeBubbleLineForm();
});

bubbleLineInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    confirmBubbleLineForm();
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeBubbleLineForm();
  }
});

bubbleLineList.addEventListener("keydown", (event) => {
  if (!state.bubbleDraftLines.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.selectedBubbleLineIndex = Math.min(state.selectedBubbleLineIndex + 1, state.bubbleDraftLines.length - 1);
    renderBubbleEditor();
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.selectedBubbleLineIndex = Math.max(state.selectedBubbleLineIndex - 1, 0);
    renderBubbleEditor();
  }

  if (event.key === "Enter") {
    event.preventDefault();
    openBubbleLineForm("edit");
  }

  if (event.key === "Delete") {
    event.preventDefault();
    deleteBubbleLineButton.click();
  }
});

saveBubbleButton.addEventListener("click", () => {
  const lines = normalizeBubbleLines(state.bubbleDraftLines);
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
  state.bubbleDraftLines = [...state.selectedPet.bubbleText];
  state.selectedBubbleLineIndex = 0;
  state.bubbleLineEditMode = null;
  render();
  scheduleBubbleRotation();
});

cancelBubbleEditorButton.addEventListener("click", () => {
  closeBubbleEditor();
});

bubbleEditorBackdrop.addEventListener("click", () => {
  closeBubbleEditor();
});

function beginPetDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;
  if (!isPetBodyPointerEvent(event)) {
    setPetInputTransparent(true);
    return;
  }
  setPetInputTransparent(false);

  dragState = {
    x: event.screenX,
    y: event.screenY,
    lastX: event.screenX,
    pointerId: event.pointerId,
    moved: false,
    dragAction: null,
    localStartX: ipadDragOffset.x,
    localStartY: ipadDragOffset.y
  };
  petCluster.setPointerCapture(event.pointerId);
  document.body.classList.add("dragging-pet");
  if (HAS_DESKTOP_SHELL) {
    window.desktopPetShell.startWindowDrag();
  }
}

function updatePetDrag(event) {
  if (!dragState) return;
  const deltaX = event.screenX - dragState.x;
  const deltaY = event.screenY - dragState.y;
  const moveX = event.screenX - dragState.lastX;
  if (Math.abs(deltaX) + Math.abs(deltaY) > 3) {
    dragState.moved = true;
  }
  if (Math.abs(moveX) > 2) {
    const dragAction = moveX < 0 ? "running-left" : "running-right";
    if (dragState.dragAction !== dragAction) {
      dragState.dragAction = dragAction;
      setAction(dragAction);
    }
  }
  dragState.lastX = event.screenX;
  if (IS_IPAD_MODE && dragState.moved) {
    const stageRect = petRoom.getBoundingClientRect();
    const petRect = petCluster.getBoundingClientRect();
    const maxX = Math.max(0, (stageRect.width - petRect.width) / 2 - 12);
    const maxY = Math.max(0, (stageRect.height - petRect.height) / 2 - 96);
    ipadDragOffset.x = Math.max(-maxX, Math.min(maxX, dragState.localStartX + deltaX));
    ipadDragOffset.y = Math.max(-maxY, Math.min(maxY, dragState.localStartY + deltaY));
    petCluster.style.setProperty("--pet-offset-x", `${Math.round(ipadDragOffset.x)}px`);
    petCluster.style.setProperty("--pet-offset-y", `${Math.round(ipadDragOffset.y)}px`);
  }
}

function endPetDrag(event) {
  if (!dragState) return;
  if (HAS_DESKTOP_SHELL) {
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
  setAction(DEFAULT_ACTION);
  document.body.classList.remove("dragging-pet");
}

petCluster.addEventListener("pointerdown", beginPetDrag);
petCluster.addEventListener("pointermove", updatePetDrag);
petCluster.addEventListener("pointerup", endPetDrag);
petCluster.addEventListener("pointercancel", endPetDrag);

function setControlsHoverOpen(open) {
  window.clearTimeout(controlsHoverTimer);
  if (state.companionMode) {
    state.controlsHoverOpen = false;
    renderShellControls();
    return;
  }
  state.controlsHoverOpen = open;
  renderShellControls();
}

petCluster.addEventListener("mouseenter", () => {
  if (state.companionMode) return;
  setControlsHoverOpen(true);
});

petCluster.addEventListener("mouseleave", () => {
  if (state.controlsOpen) return;
  controlsHoverTimer = window.setTimeout(() => setControlsHoverOpen(false), 180);
});

actionBar.addEventListener("mouseenter", () => {
  if (state.companionMode) return;
  if (state.controlsOpen) return;
  setControlsHoverOpen(true);
});

actionBar.addEventListener("mouseleave", () => {
  if (state.controlsOpen) return;
  controlsHoverTimer = window.setTimeout(() => setControlsHoverOpen(false), 180);
});

petCluster.addEventListener("dblclick", (event) => {
  if (!state.companionMode) return;
  event.preventDefault();
  event.stopPropagation();
  suppressPetClickUntil = Date.now() + 250;
  setCompanionMode(false);
});

document.addEventListener("click", (event) => {
  const clickedInsideControls = event.target.closest(".action-bar, .bubble-editor-dialog, .name-editor-dialog");
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
  if (event.key === "Escape" && state.nameEditorOpen) {
    closePetNameEditor();
  }
  if (event.key === "Escape" && state.bubbleEditorOpen) {
    closeBubbleEditor();
  }
  if (event.key === "Escape" && state.controlsOpen) {
    state.controlsOpen = false;
    renderShellControls();
  }
});

if (HAS_DESKTOP_SHELL) {
  window.desktopPetShell.setBubbleEditorOpen(false);

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

  settingsMenuButton.addEventListener("click", async () => {
    state.controlsOpen = true;
    renderShellControls();
    await window.desktopPetShell.showControlMenu();
  });

  hideButton.addEventListener("click", async () => {
    await window.desktopPetShell.hideWindow();
  });

  quitButton.addEventListener("click", async () => {
    await window.desktopPetShell.quit();
  });

  window.desktopPetShell.getSettings().then((settings) => {
    state.shellSettings = { ...state.shellSettings, ...settings };
    state.companionMode = Boolean(settings.companionMode);
    state.patrolMode = Boolean(settings.patrolMode);
    if (state.patrolMode) {
      window.clearTimeout(state.autoActionTimer);
    }
    if (typeof settings.petScale === "number") {
      setPetScale(settings.petScale, { syncShell: false });
    }
    selectPet(state.shellSettings.petId || pets[0].id);
    renderShellControls();
    scheduleBubbleRotation();
  });

  window.desktopPetShell.onSettings((settings) => {
    const wasPatrolling = state.patrolMode;
    state.shellSettings = { ...state.shellSettings, ...settings };
    if (typeof settings.companionMode === "boolean") {
      state.companionMode = settings.companionMode;
    }
    if (typeof settings.patrolMode === "boolean") {
      state.patrolMode = settings.patrolMode;
    }
    if (wasPatrolling && !state.patrolMode && (state.action === "running-left" || state.action === "running-right")) {
      setAction(DEFAULT_ACTION);
    } else if (!wasPatrolling && state.patrolMode) {
      window.clearTimeout(state.autoActionTimer);
    }
    if (typeof settings.petScale === "number" && Math.abs(settings.petScale - state.petScale) > 0.001) {
      setPetScale(settings.petScale, { syncShell: false });
    }
    if (settings.petId && settings.petId !== state.selectedPet.id) {
      selectPet(settings.petId);
      return;
    }
    renderShellControls();
  });

  window.desktopPetShell.onBubblesEnabled((enabled) => {
    state.shellSettings = { ...state.shellSettings, bubbleEnabled: Boolean(enabled) };
    renderShellControls();
    scheduleBubbleRotation();
  });

  window.desktopPetShell.onPetCommand((command) => {
    if (!command || typeof command !== "object") return;

    if (command.type === "action") {
      runCommandAction(command.action, command);
    }

    if (command.type === "bubble-next") {
      cycleBubble(1);
      runCommandAction("waving", { quiet: true });
    }

    if (command.type === "open-name-editor") {
      openPetNameEditor();
    }

    if (command.type === "open-bubble-editor") {
      openBubbleEditor();
    }
  });
} else {
  bubbleToggleButton.addEventListener("click", () => {
    state.shellSettings = {
      ...state.shellSettings,
      bubbleEnabled: !state.shellSettings.bubbleEnabled
    };
    renderShellControls();
    scheduleBubbleRotation();
  });
}

render();
setPetScale(state.petScale, { syncShell: false });
setAction(DEFAULT_ACTION);
scheduleBubbleRotation();
window.requestAnimationFrame(animatePet);

if ("serviceWorker" in navigator && IS_IPAD_MODE) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
