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
  companionMode: window.localStorage.getItem("desktopPetCompanionMode") === "true",
  bubbleEditorOpen: false,
  chatPanelOpen: false,
  chatWindowOpen: false,
  bubbleDraftLines: [],
  selectedBubbleLineIndex: 0,
  bubbleLineEditMode: null,
  chatDraft: "",
  chatSending: false,
  lastChatReply: "",
  chatBubblePinnedUntil: 0,
  chatSettings: {
    enabled: false,
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    hasApiKey: false,
    apiKeyHint: "",
    history: [],
    historyCount: 0
  },
  shellSettings: {
    alwaysOnTop: true,
    openAtLogin: true,
    bubbleEnabled: true,
    selectedPetId: pets[0].id
  },
  petScale: Number(window.localStorage.getItem("desktopPetScale") || "1")
};

const petTitle = document.querySelector("#petTitle");
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
const companionButton = document.querySelector("#companionButton");
const aiSettingsButton = document.querySelector("#aiSettingsButton");
const aiChatButton = document.querySelector("#aiChatButton");
const idleButton = document.querySelector("#idleButton");
const scaleButton = document.querySelector("#scaleButton");
const editBubbleButton = document.querySelector("#editBubbleButton");
const bubbleEditorModal = document.querySelector("#bubbleEditorModal");
const bubbleEditorBackdrop = document.querySelector("#bubbleEditorBackdrop");
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
const chatPanelModal = document.querySelector("#chatPanelModal");
const chatPanelBackdrop = document.querySelector("#chatPanelBackdrop");
const closeChatPanelButton = document.querySelector("#closeChatPanelButton");
const chatPanelSubtitle = document.querySelector("#chatPanelSubtitle");
const chatEnabledInput = document.querySelector("#chatEnabledInput");
const chatModelInput = document.querySelector("#chatModelInput");
const chatBaseUrlInput = document.querySelector("#chatBaseUrlInput");
const chatApiKeyInput = document.querySelector("#chatApiKeyInput");
const saveChatSettingsButton = document.querySelector("#saveChatSettingsButton");
const clearChatMemoryButton = document.querySelector("#clearChatMemoryButton");
const chatSettingsHint = document.querySelector("#chatSettingsHint");
const chatComposeForm = document.querySelector("#chatComposeForm");
const chatInput = document.querySelector("#chatInput");
const chatCounter = document.querySelector("#chatCounter");
const sendChatButton = document.querySelector("#sendChatButton");
const chatWindowModal = document.querySelector("#chatWindowModal");
const closeChatWindowButton = document.querySelector("#closeChatWindowButton");
const chatWindowSubtitle = document.querySelector("#chatWindowSubtitle");
const chatReplyActions = document.querySelector("#chatReplyActions");
const archiveChatReplyButton = document.querySelector("#archiveChatReplyButton");
const keepChatReplyButton = document.querySelector("#keepChatReplyButton");

petCanvas.width = ATLAS.cellWidth * 2;
petCanvas.height = ATLAS.cellHeight * 2;

const imageCache = new Map();
const BUBBLE_TEXT_STORAGE_KEY = "desktopPetCustomBubbleText";
const PET_SCALE_STEPS = [0.35, 0.5, 0.65, 0.8, 1];
const DEFAULT_ACTION = "idle";
const CHAT_INPUT_LIMIT = 100;
const CHAT_BUBBLE_PIN_MS = 20000;

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

function clampTextLength(value, maxLength) {
  return Array.from(String(value || "")).slice(0, maxLength).join("");
}

function setChatStatus(message) {
  const nextMessage = String(message || "");
  chatSettingsHint.textContent = nextMessage;
  if (nextMessage) {
    chatWindowSubtitle.textContent = nextMessage;
  }
}

function setChatBubble(text) {
  state.chatBubblePinnedUntil = Date.now() + CHAT_BUBBLE_PIN_MS;
  setBubbleText(text);
}

function updateChatCounter() {
  const length = Array.from(chatInput.value).length;
  chatCounter.textContent = `${length} / ${CHAT_INPUT_LIMIT}`;
}

function setReplyArchiveOptionsVisible(visible) {
  chatReplyActions.hidden = !visible;
}

function archiveLastChatReply() {
  const reply = String(state.lastChatReply || "").trim();
  if (!reply) return;

  const overrides = readBubbleOverrides();
  const existing = getBubbleLinesForPet(state.selectedPet);
  const nextLines = existing.includes(reply) ? existing : [...existing, reply];
  overrides[state.selectedPet.id] = nextLines;
  writeBubbleOverrides(overrides);
  state.bubbleIndex = nextLines.length - 1;
  setBubbleText(reply);
  setReplyArchiveOptionsVisible(false);
  setChatStatus("已归档为台词。");
}

function applyChatSettings(nextState) {
  state.chatSettings = {
    ...state.chatSettings,
    ...nextState,
    history: Array.isArray(nextState?.history) ? nextState.history : state.chatSettings.history
  };

  const chatReady = Boolean(state.chatSettings.enabled && state.chatSettings.hasApiKey);
  aiSettingsButton.classList.toggle("active", state.chatSettings.enabled);
  aiChatButton.classList.toggle("active", chatReady);
  aiChatButton.disabled = !chatReady;
  chatEnabledInput.checked = Boolean(state.chatSettings.enabled);
  chatModelInput.value = state.chatSettings.model || "deepseek-chat";
  chatBaseUrlInput.value = state.chatSettings.baseUrl || "https://api.deepseek.com";
  chatApiKeyInput.placeholder = state.chatSettings.hasApiKey
    ? `已保存 ${state.chatSettings.apiKeyHint}，留空则保留当前 Key`
    : "Enable AI 时填写，留空则保留当前 Key";
  chatPanelSubtitle.textContent = `${state.selectedPet.name} · model settings`;
  chatWindowSubtitle.textContent = `recent memory ${state.chatSettings.historyCount || 0}`;
  sendChatButton.disabled = state.chatSending || !chatReady;
}

async function refreshChatState() {
  if (!window.desktopPetShell) return;
  try {
    applyChatSettings(await window.desktopPetShell.getChatState(state.selectedPet.id));
    const status = state.chatSettings.enabled
      ? "AI 已启用。"
      : "开启 AI 后可以聊天。";
    if (state.chatPanelOpen) {
      setChatStatus(status);
    } else if (state.chatWindowOpen) {
      chatWindowSubtitle.textContent = `recent memory ${state.chatSettings.historyCount || 0}`;
    }
  } catch (error) {
    setChatStatus(error.message || "无法读取聊天状态。");
  }
}

function openChatPanel() {
  state.chatPanelOpen = true;
  state.chatWindowOpen = false;
  state.controlsOpen = false;
  state.controlsHoverOpen = false;
  if (state.bubbleEditorOpen) {
    state.bubbleEditorOpen = false;
    state.bubbleLineEditMode = null;
    if (window.desktopPetShell) {
      window.desktopPetShell.setBubbleEditorOpen(false);
    }
  }
  if (window.desktopPetShell) {
    window.desktopPetShell.setChatPanelOpen(true);
    window.desktopPetShell.setChatWindowOpen(false);
  }
  renderShellControls();
  refreshChatState();
  window.setTimeout(() => chatModelInput.focus(), 40);
}

function closeChatPanel() {
  state.chatPanelOpen = false;
  state.chatSending = false;
  if (window.desktopPetShell) {
    window.desktopPetShell.setChatPanelOpen(false);
  }
  renderShellControls();
}

function openChatWindow() {
  if (!state.chatSettings.enabled || !state.chatSettings.hasApiKey) return;
  state.chatWindowOpen = true;
  state.chatPanelOpen = false;
  state.controlsOpen = false;
  state.controlsHoverOpen = false;
  if (state.bubbleEditorOpen) {
    state.bubbleEditorOpen = false;
    state.bubbleLineEditMode = null;
    if (window.desktopPetShell) {
      window.desktopPetShell.setBubbleEditorOpen(false);
    }
  }
  if (window.desktopPetShell) {
    window.desktopPetShell.setChatWindowOpen(true);
    window.desktopPetShell.setChatPanelOpen(false);
  }
  renderShellControls();
  refreshChatState();
  updateChatCounter();
  setReplyArchiveOptionsVisible(Boolean(state.lastChatReply));
  window.setTimeout(() => chatInput.focus(), 40);
}

function closeChatWindow() {
  state.chatWindowOpen = false;
  state.chatSending = false;
  setReplyArchiveOptionsVisible(false);
  if (window.desktopPetShell) {
    window.desktopPetShell.setChatWindowOpen(false);
  }
  renderShellControls();
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

function calculateBubbleWidth(text) {
  const length = Array.from(String(text || "").trim()).length;
  return Math.min(280, Math.max(96, 54 + length * 12));
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
    if (state.action === DEFAULT_ACTION && Date.now() > state.chatBubblePinnedUntil) {
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
  state.lastChatReply = "";
  setReplyArchiveOptionsVisible(false);
  setAction(DEFAULT_ACTION);
  render();
  scheduleBubbleRotation();
  if (state.chatPanelOpen || state.chatWindowOpen) {
    refreshChatState();
  }

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
    empty.textContent = "No lines yet. Click New to add one.";
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
  state.chatPanelOpen = false;
  state.chatWindowOpen = false;
  state.controlsOpen = false;
  state.controlsHoverOpen = false;
  state.bubbleDraftLines = [...getCurrentLines()];
  state.selectedBubbleLineIndex = 0;
  state.bubbleLineEditMode = null;
  if (window.desktopPetShell) {
    window.desktopPetShell.setBubbleEditorOpen(true);
    window.desktopPetShell.setChatPanelOpen(false);
    window.desktopPetShell.setChatWindowOpen(false);
  }
  renderBubbleEditor();
  renderShellControls();
}

function closeBubbleEditor() {
  state.bubbleEditorOpen = false;
  state.bubbleLineEditMode = null;
  if (window.desktopPetShell) {
    window.desktopPetShell.setBubbleEditorOpen(false);
  }
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

function setCompanionMode(enabled) {
  state.companionMode = Boolean(enabled);
  window.localStorage.setItem("desktopPetCompanionMode", String(state.companionMode));
  if (state.companionMode) {
    state.controlsOpen = false;
    state.controlsHoverOpen = false;
    state.chatPanelOpen = false;
    state.chatWindowOpen = false;
    if (state.bubbleEditorOpen) {
      state.bubbleEditorOpen = false;
      state.bubbleLineEditMode = null;
      if (window.desktopPetShell) {
        window.desktopPetShell.setBubbleEditorOpen(false);
      }
    }
  }
  if (window.desktopPetShell) {
    window.desktopPetShell.setCompanionMode(state.companionMode);
    if (state.companionMode) {
      window.desktopPetShell.setChatPanelOpen(false);
      window.desktopPetShell.setChatWindowOpen(false);
    }
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
  document.body.classList.toggle("chat-panel-open", state.chatPanelOpen);
  document.body.classList.toggle("chat-window-open", state.chatWindowOpen);
  document.body.classList.toggle("bubbles-off", !state.shellSettings.bubbleEnabled);
  document.body.classList.toggle("companion-mode", state.companionMode);
  document.body.classList.toggle("controls-visible", !state.companionMode && (state.controlsOpen || state.controlsHoverOpen));
  pinButton.classList.toggle("active", state.shellSettings.alwaysOnTop);
  bubbleToggleButton.classList.toggle("active", state.shellSettings.bubbleEnabled);
  companionButton.classList.toggle("active", state.companionMode);
  aiSettingsButton.classList.toggle("active", state.chatSettings.enabled);
  aiChatButton.classList.toggle("active", state.chatSettings.enabled && state.chatSettings.hasApiKey);
  aiChatButton.disabled = !(state.chatSettings.enabled && state.chatSettings.hasApiKey);
  companionButton.title = state.companionMode ? "Exit Companion Mode by double-clicking pet" : "Companion Mode";
  companionButton.setAttribute("aria-label", companionButton.title);
  bubbleEditorModal.setAttribute("aria-hidden", String(!state.bubbleEditorOpen));
  chatPanelModal.setAttribute("aria-hidden", String(!state.chatPanelOpen));
  chatWindowModal.setAttribute("aria-hidden", String(!state.chatWindowOpen));
  ensureBubbleContent();
}

function render() {
  const pet = state.selectedPet;
  document.documentElement.style.setProperty("--pet-primary", pet.theme.primary);
  document.documentElement.style.setProperty("--pet-secondary", pet.theme.secondary);
  document.documentElement.style.setProperty("--pet-accent", pet.theme.accent);
  petTitle.textContent = pet.name;
  setBubbleText(state.shellSettings.bubbleEnabled ? getCurrentLines()[state.bubbleIndex] : "");
  renderBubbleEditor();
  applyChatSettings(state.chatSettings);
  updateChatCounter();
  renderActionButtons();
  renderShellControls();
}

petButton.addEventListener("click", () => {
  if (Date.now() < suppressPetClickUntil) return;
  if (state.companionMode) return;
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

companionButton.addEventListener("click", () => {
  setCompanionMode(true);
});

aiSettingsButton.addEventListener("click", () => {
  openChatPanel();
});

aiChatButton.addEventListener("click", () => {
  openChatWindow();
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

closeChatPanelButton.addEventListener("click", () => {
  closeChatPanel();
});

chatPanelBackdrop.addEventListener("click", () => {
  closeChatPanel();
});

closeChatWindowButton.addEventListener("click", () => {
  closeChatWindow();
});

chatInput.addEventListener("input", () => {
  const clamped = clampTextLength(chatInput.value, CHAT_INPUT_LIMIT);
  if (clamped !== chatInput.value) {
    chatInput.value = clamped;
  }
  state.chatDraft = chatInput.value;
  setReplyArchiveOptionsVisible(false);
  updateChatCounter();
});

archiveChatReplyButton.addEventListener("click", () => {
  archiveLastChatReply();
});

keepChatReplyButton.addEventListener("click", () => {
  setReplyArchiveOptionsVisible(false);
  setChatStatus("已保留在记忆里。");
});

saveChatSettingsButton.addEventListener("click", async () => {
  if (!window.desktopPetShell) return;
  saveChatSettingsButton.disabled = true;
  try {
    const nextState = await window.desktopPetShell.updateChatSettings({
      petId: state.selectedPet.id,
      enabled: chatEnabledInput.checked,
      model: chatModelInput.value.trim(),
      baseUrl: chatBaseUrlInput.value.trim(),
      apiKey: chatApiKeyInput.value.trim()
    });
    chatApiKeyInput.value = "";
    applyChatSettings(nextState);
    setChatStatus(nextState.enabled ? "AI 设置已保存。" : "AI 对话已关闭。");
  } catch (error) {
    setChatStatus(error.message || "保存 AI 设置失败。");
  } finally {
    saveChatSettingsButton.disabled = false;
  }
});

clearChatMemoryButton.addEventListener("click", async () => {
  if (!window.desktopPetShell) return;
  try {
    applyChatSettings(await window.desktopPetShell.clearChatMemory(state.selectedPet.id));
    setChatStatus("这只宠物的上下文记忆已清空。");
  } catch (error) {
    setChatStatus(error.message || "清空记忆失败。");
  }
});

chatComposeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!window.desktopPetShell || state.chatSending) return;

  const message = clampTextLength(chatInput.value.trim(), CHAT_INPUT_LIMIT);
  if (!message) {
    setChatStatus("先输入一点点内容吧。");
    chatInput.focus();
    return;
  }

  state.chatSending = true;
  sendChatButton.disabled = true;
  setReplyArchiveOptionsVisible(false);
  setChatStatus("正在等宠物回复...");
  previewAction("review", 2000, { quiet: true });
  if (state.shellSettings.bubbleEnabled) {
    setChatBubble("...");
  }

  try {
    const result = await window.desktopPetShell.sendPetChat({
      petId: state.selectedPet.id,
      petProfile: {
        id: state.selectedPet.id,
        name: state.selectedPet.name,
        animalType: state.selectedPet.animalType,
        personality: state.selectedPet.personality,
        favoriteFood: state.selectedPet.favoriteFood
      },
      message
    });
    state.lastChatReply = result.reply;
    state.chatDraft = "";
    chatInput.value = "";
    updateChatCounter();
    applyChatSettings({
      ...state.chatSettings,
      history: result.history,
      historyCount: result.historyCount
    });
    setChatBubble(result.reply);
    setReplyArchiveOptionsVisible(true);
    activateAction("waving", { quiet: true });
    setChatStatus("可以归档为台词。");
  } catch (error) {
    setChatStatus(error.message || "发送失败。");
    if (state.shellSettings.bubbleEnabled) {
      setChatBubble("我刚刚卡住了。");
    }
    activateAction("failed", { quiet: true });
  } finally {
    state.chatSending = false;
    sendChatButton.disabled = !(state.chatSettings.enabled && state.chatSettings.hasApiKey);
  }
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
  controlsHoverTimer = window.setTimeout(() => setControlsHoverOpen(false), 180);
});

actionBar.addEventListener("mouseenter", () => {
  if (state.companionMode) return;
  setControlsHoverOpen(true);
});

actionBar.addEventListener("mouseleave", () => {
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
  const clickedInsideControls = event.target.closest(".action-bar, .bubble-editor-dialog, .chat-panel-dialog, .chat-quick-compose");
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
  if (event.key === "Escape" && state.chatPanelOpen) {
    closeChatPanel();
  }
  if (event.key === "Escape" && state.chatWindowOpen) {
    closeChatWindow();
  }
  if (event.key === "Escape" && state.controlsOpen) {
    state.controlsOpen = false;
    renderShellControls();
  }
});

if (window.desktopPetShell) {
  window.desktopPetShell.setCompanionMode(state.companionMode);
  window.desktopPetShell.setBubbleEditorOpen(false);
  window.desktopPetShell.setChatPanelOpen(false);
  window.desktopPetShell.setChatWindowOpen(false);

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
    refreshChatState();
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
