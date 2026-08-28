const pets = window.BND_PETS || [];

pets.sort((left, right) => left.id.localeCompare(right.id));

const ATLAS = {
  cellWidth: 192,
  cellHeight: 208
};

const ACTIONS = [
  { id: "idle", label: "Idle", chip: "Idle", row: 0, frames: 6, fps: 4 },
  { id: "running-right", label: "Run Right", chip: "Run ->", row: 1, frames: 8, fps: 10 },
  { id: "running-left", label: "Run Left", chip: "Run <-", row: 2, frames: 8, fps: 10 },
  { id: "waving", label: "Wave", chip: "Wave", row: 3, frames: 4, fps: 6 },
  { id: "jumping", label: "Jump", chip: "Jump", row: 4, frames: 5, fps: 7 },
  { id: "failed", label: "Fail", chip: "Oops", row: 5, frames: 8, fps: 8 },
  { id: "waiting", label: "Wait", chip: "Wait", row: 6, frames: 6, fps: 4 },
  { id: "running", label: "Busy", chip: "Busy", row: 7, frames: 6, fps: 8 },
  { id: "review", label: "Review", chip: "Check", row: 8, frames: 6, fps: 5 }
];

const ACTION_MAP = Object.fromEntries(ACTIONS.map((action) => [action.id, action]));
const RANDOM_ACTIONS = ACTIONS.filter((action) => action.id !== "idle");
const PET_SPRITESHEETS = Object.fromEntries(
  pets.map((pet) => [pet.id, pet.spritePath || `./${pet.id}/final/spritesheet.webp`])
);

const STORAGE_KEYS = {
  selectedPet: "bndMemoSelectedPet",
  deskEnabled: "bndMemoDeskEnabled",
  names: "bndMemoPetNames",
  memos: "bndMemoPetMemos",
  memoPages: "bndMemoPetPages"
};

const DEFAULT_MEMOS = ["\u526a\u89c6\u9891", "\u559d\u6c34", "\u6574\u7406\u7d20\u6750", "\u65e9\u70b9\u4f11\u606f"];
const DEFAULT_PET_ID = pets.some((pet) => pet.id === "catbbi") ? "catbbi" : pets[0]?.id || "";
const ACTION_SHOWCASE = ["idle", "waving", "waiting", "review", "jumping", "running-left", "running-right"];

const state = {
  selectedPetId: readString(STORAGE_KEYS.selectedPet, DEFAULT_PET_ID),
  action: "idle",
  actionStartedAt: performance.now(),
  actionOverrideUntil: 0,
  deskEnabled: readBoolean(STORAGE_KEYS.deskEnabled, true),
  editorOpen: false,
  draftName: "",
  draftMemos: [],
  memoPointer: null
};

const imageCache = new Map();

const memoListButton = document.querySelector("#memoListButton");
const petButton = document.querySelector("#petButton");
const petCanvas = document.querySelector("#petCanvas");
const petCtx = petCanvas.getContext("2d");
const petThumbCanvas = document.querySelector("#petThumbCanvas");
const petThumbCtx = petThumbCanvas.getContext("2d");
const actionChip = document.querySelector("#actionChip");
const deskToggle = document.querySelector("#deskToggle");
const deskToggleText = document.querySelector("#deskToggleText");
const prevPetButton = document.querySelector("#prevPetButton");
const nextPetButton = document.querySelector("#nextPetButton");
const activePetName = document.querySelector("#activePetName");
const editPetButton = document.querySelector("#editPetButton");
const petDots = document.querySelector("#petDots");
const editorModal = document.querySelector("#editorModal");
const editorBackdrop = document.querySelector("#editorBackdrop");
const editorTitle = document.querySelector("#editorTitle");
const editorCloseButton = document.querySelector("#editorCloseButton");
const petNameInput = document.querySelector("#petNameInput");
const memoEditorList = document.querySelector("#memoEditorList");
const addMemoButton = document.querySelector("#addMemoButton");
const resetMemoButton = document.querySelector("#resetMemoButton");
const cancelEditorButton = document.querySelector("#cancelEditorButton");
const saveEditorButton = document.querySelector("#saveEditorButton");

let currentFrameBounds = { x: 0, y: 0, width: petCanvas.width, height: petCanvas.height };

function readString(key, fallback) {
  return window.localStorage.getItem(key) || fallback;
}

function readBoolean(key, fallback) {
  const value = window.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "true";
}

function readJson(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getSelectedPetIndex() {
  const index = pets.findIndex((pet) => pet.id === state.selectedPetId);
  return index >= 0 ? index : 0;
}

function getSelectedPet() {
  return pets[getSelectedPetIndex()];
}

function getPetDisplayName(pet) {
  const names = readJson(STORAGE_KEYS.names, {});
  const custom = String(names[pet.id] || "").trim();
  return custom || pet.name;
}

function getPetMemos(pet) {
  const memos = readJson(STORAGE_KEYS.memos, {});
  const petMemos = memos[pet.id];
  if (Array.isArray(petMemos) && petMemos.some((line) => String(line).trim())) {
    return petMemos.map((line) => String(line).trim()).filter(Boolean);
  }
  return DEFAULT_MEMOS;
}

function getMemoPage(pet) {
  const pages = readJson(STORAGE_KEYS.memoPages, {});
  const page = Number(pages[pet.id]);
  return Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
}

function setMemoPage(pet, page) {
  const maxPage = Math.max(0, Math.ceil(getPetMemos(pet).length / 4) - 1);
  const nextPage = ((page % (maxPage + 1)) + maxPage + 1) % (maxPage + 1);
  const pages = readJson(STORAGE_KEYS.memoPages, {});
  pages[pet.id] = nextPage;
  writeJson(STORAGE_KEYS.memoPages, pages);
  renderMemoList();
}

function savePetName(pet, name) {
  const names = readJson(STORAGE_KEYS.names, {});
  const normalized = String(name || "").trim().slice(0, 16);
  if (normalized) {
    names[pet.id] = normalized;
  } else {
    delete names[pet.id];
  }
  writeJson(STORAGE_KEYS.names, names);
}

function savePetMemos(pet, lines) {
  const memos = readJson(STORAGE_KEYS.memos, {});
  const normalized = lines.map((line) => String(line).trim()).filter(Boolean).slice(0, 12);
  memos[pet.id] = normalized.length ? normalized : DEFAULT_MEMOS;
  writeJson(STORAGE_KEYS.memos, memos);
  setMemoPage(pet, getMemoPage(pet));
}

function loadSpritesheet(petId) {
  if (imageCache.has(petId)) return imageCache.get(petId);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error(`Failed to load ${petId}`)));
    image.src = PET_SPRITESHEETS[petId];
  });
  imageCache.set(petId, promise);
  return promise;
}

function getActionConfig(actionId) {
  return ACTION_MAP[actionId] || ACTION_MAP.idle;
}

function frameIndexFor(now, actionId) {
  const config = getActionConfig(actionId);
  const elapsedMs = now - state.actionStartedAt;
  const elapsedFrames = Math.floor((elapsedMs / 1000) * config.fps);
  return elapsedFrames % config.frames;
}

function drawSpriteFrame(ctx, canvas, image, actionId, frame) {
  const config = getActionConfig(actionId);
  const sx = frame * ATLAS.cellWidth;
  const sy = config.row * ATLAS.cellHeight;
  const scale = Math.min(canvas.width / ATLAS.cellWidth, canvas.height / ATLAS.cellHeight);
  const dw = Math.round(ATLAS.cellWidth * scale);
  const dh = Math.round(ATLAS.cellHeight * scale);
  const dx = Math.round((canvas.width - dw) / 2);
  const dy = Math.round((canvas.height - dh) / 2);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, ATLAS.cellWidth, ATLAS.cellHeight, dx, dy, dw, dh);
  return { x: dx, y: dy, width: dw, height: dh };
}

function drawPlaceholder(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 3, 0, Math.PI * 2);
  ctx.fill();
}

function isPetBodyAtClientPoint(clientX, clientY) {
  const rect = petCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const x = Math.round(((clientX - rect.left) / rect.width) * petCanvas.width);
  const y = Math.round(((clientY - rect.top) / rect.height) * petCanvas.height);
  const insideFrame = x >= currentFrameBounds.x
    && x < currentFrameBounds.x + currentFrameBounds.width
    && y >= currentFrameBounds.y
    && y < currentFrameBounds.y + currentFrameBounds.height;
  if (!insideFrame) return false;

  try {
    return petCtx.getImageData(x, y, 1, 1).data[3] >= 18;
  } catch {
    return true;
  }
}

function renderMemoList() {
  const pet = getSelectedPet();
  const allMemos = getPetMemos(pet);
  const maxPage = Math.max(0, Math.ceil(allMemos.length / 4) - 1);
  const page = Math.min(getMemoPage(pet), maxPage);
  const visibleMemos = allMemos.slice(page * 4, page * 4 + 4);
  memoListButton.innerHTML = "";

  if (!state.deskEnabled) {
    const empty = document.createElement("div");
    empty.className = "memo-empty";
    empty.textContent = "Desk memo is paused";
    memoListButton.appendChild(empty);
    return;
  }

  visibleMemos.forEach((memo, index) => {
    const row = document.createElement("div");
    row.className = "memo-row";
    row.innerHTML = `<span class="memo-index">${page * 4 + index + 1}.</span><strong class="memo-text"></strong>`;
    row.querySelector(".memo-text").textContent = memo;
    memoListButton.appendChild(row);
  });

  if (allMemos.length > 4) {
    const indicator = document.createElement("span");
    indicator.className = "memo-page-indicator";
    indicator.textContent = `${page + 1}/${maxPage + 1}`;
    memoListButton.appendChild(indicator);
  }
}

function renderPetSwitcher() {
  const pet = getSelectedPet();
  const selectedIndex = getSelectedPetIndex();
  activePetName.textContent = getPetDisplayName(pet);
  petDots.innerHTML = "";
  pets.forEach((item, index) => {
    const dot = document.createElement("span");
    dot.className = `pet-dot ${index === selectedIndex ? "active" : ""}`;
    petDots.appendChild(dot);
  });
}

function renderDeskToggle() {
  deskToggle.classList.toggle("is-on", state.deskEnabled);
  deskToggle.setAttribute("aria-pressed", String(state.deskEnabled));
  deskToggleText.textContent = state.deskEnabled ? "Desk ON" : "Desk OFF";
}

function renderEditor() {
  document.body.classList.toggle("editor-open", state.editorOpen);
  editorModal.setAttribute("aria-hidden", String(!state.editorOpen));
  if (!state.editorOpen) return;

  const pet = getSelectedPet();
  editorTitle.textContent = getPetDisplayName(pet);
  petNameInput.value = state.draftName;
  memoEditorList.innerHTML = "";

  state.draftMemos.forEach((line, index) => {
    const row = document.createElement("div");
    row.className = "memo-edit-row";
    row.innerHTML = `
      <span>${index + 1}</span>
      <input class="memo-input" type="text" maxlength="36" autocomplete="off">
      <button class="delete-memo-button" type="button" aria-label="Delete memo">x</button>
    `;
    const input = row.querySelector("input");
    input.value = line;
    input.addEventListener("input", () => {
      state.draftMemos[index] = input.value;
    });
    row.querySelector("button").addEventListener("click", () => {
      state.draftMemos.splice(index, 1);
      if (!state.draftMemos.length) state.draftMemos.push("");
      renderEditor();
    });
    memoEditorList.appendChild(row);
  });
}

function render() {
  renderMemoList();
  renderPetSwitcher();
  renderDeskToggle();
  renderEditor();
}

function selectPetByIndex(index) {
  const normalized = (index + pets.length) % pets.length;
  state.selectedPetId = pets[normalized].id;
  window.localStorage.setItem(STORAGE_KEYS.selectedPet, state.selectedPetId);
  state.action = "idle";
  state.actionStartedAt = performance.now();
  state.actionOverrideUntil = 0;
  render();
}

function playActionOnce(actionId, durationMs = 1800) {
  state.action = actionId;
  state.actionStartedAt = performance.now();
  state.actionOverrideUntil = performance.now() + durationMs;
  actionChip.textContent = getActionConfig(actionId).chip;
}

function playRandomAction() {
  const action = RANDOM_ACTIONS[Math.floor(Math.random() * RANDOM_ACTIONS.length)];
  playActionOnce(action.id, Math.max(1200, Math.min(2400, (action.frames / action.fps) * 1000 + 900)));
}

function openEditor() {
  const pet = getSelectedPet();
  state.editorOpen = true;
  state.draftName = getPetDisplayName(pet);
  state.draftMemos = getPetMemos(pet).slice(0, 12);
  renderEditor();
  window.setTimeout(() => petNameInput.focus(), 40);
}

function closeEditor() {
  state.editorOpen = false;
  renderEditor();
}

function saveEditor() {
  const pet = getSelectedPet();
  savePetName(pet, petNameInput.value);
  savePetMemos(pet, state.draftMemos);
  state.editorOpen = false;
  render();
}

function tickShowcase(now) {
  if (state.actionOverrideUntil && now > state.actionOverrideUntil) {
    state.actionOverrideUntil = 0;
    state.action = "idle";
    state.actionStartedAt = now;
  }

  if (!state.actionOverrideUntil) {
    const segmentMs = 4200;
    const index = Math.floor(now / segmentMs) % ACTION_SHOWCASE.length;
    const nextAction = ACTION_SHOWCASE[index];
    if (state.action !== nextAction) {
      state.action = nextAction;
      state.actionStartedAt = now;
    }
  }
}

function animate(now) {
  const pet = getSelectedPet();
  tickShowcase(now);
  actionChip.textContent = getActionConfig(state.action).chip;

  loadSpritesheet(pet.id)
    .then((image) => {
      currentFrameBounds = drawSpriteFrame(petCtx, petCanvas, image, state.action, frameIndexFor(now, state.action));
      drawSpriteFrame(petThumbCtx, petThumbCanvas, image, "idle", 0);
    })
    .catch(() => {
      drawPlaceholder(petCtx, petCanvas);
      drawPlaceholder(petThumbCtx, petThumbCanvas);
    });

  window.requestAnimationFrame(animate);
}

deskToggle.addEventListener("click", () => {
  state.deskEnabled = !state.deskEnabled;
  window.localStorage.setItem(STORAGE_KEYS.deskEnabled, String(state.deskEnabled));
  render();
});

prevPetButton.addEventListener("click", () => selectPetByIndex(getSelectedPetIndex() - 1));
nextPetButton.addEventListener("click", () => selectPetByIndex(getSelectedPetIndex() + 1));
editPetButton.addEventListener("click", openEditor);
memoListButton.addEventListener("click", (event) => {
  if (event.defaultPrevented) return;
  openEditor();
});

memoListButton.addEventListener("pointerdown", (event) => {
  state.memoPointer = { x: event.clientX, y: event.clientY };
});

memoListButton.addEventListener("pointerup", (event) => {
  if (!state.memoPointer) return;
  const deltaX = event.clientX - state.memoPointer.x;
  const deltaY = event.clientY - state.memoPointer.y;
  state.memoPointer = null;
  const distance = Math.abs(deltaX) + Math.abs(deltaY);
  if (distance < 34) return;
  event.preventDefault();
  const pet = getSelectedPet();
  const forward = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX < 0 : deltaY < 0;
  setMemoPage(pet, getMemoPage(pet) + (forward ? 1 : -1));
});

petButton.addEventListener("click", (event) => {
  if (!isPetBodyAtClientPoint(event.clientX, event.clientY)) return;
  playRandomAction();
});

editorBackdrop.addEventListener("click", closeEditor);
editorCloseButton.addEventListener("click", closeEditor);
cancelEditorButton.addEventListener("click", closeEditor);
saveEditorButton.addEventListener("click", saveEditor);

resetMemoButton.addEventListener("click", () => {
  state.draftName = getSelectedPet().name;
  state.draftMemos = [...DEFAULT_MEMOS];
  renderEditor();
});

addMemoButton.addEventListener("click", () => {
  state.draftMemos.push("");
  renderEditor();
  const inputs = memoEditorList.querySelectorAll("input");
  inputs[inputs.length - 1]?.focus();
});

petNameInput.addEventListener("input", () => {
  state.draftName = petNameInput.value;
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.editorOpen) closeEditor();
});

if (!pets.some((pet) => pet.id === state.selectedPetId) && pets[0]) {
  state.selectedPetId = pets[0].id;
}

render();
window.requestAnimationFrame(animate);
