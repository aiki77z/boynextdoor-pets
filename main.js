const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, screen } = require("electron");
const fs = require("fs");
const path = require("path");

const WINDOW_STATE_FILE = "window-state.json";
const APP_DISPLAY_NAME = "BOYNEXTDOOR Pets";
const STATE_SCHEMA_VERSION = 5;
const PET_SCALE_LIMITS = { min: 0.35, max: 0.7 };
const PET_ASPECT_RATIO = 384 / 416;
const DEFAULT_PET_SCALE = 0.6;
const PET_BASE_WIDTH = 184;
const PANEL_WINDOW_SIZE = { width: 360, height: 360 };
const BUBBLE_EDITOR_WINDOW_SIZE = { width: 660, height: 520 };
const PATROL_SPEED_PX = 1.4;
const PATROL_TICK_MS = 24;
const PET_ACTIONS = [
  { id: "idle", label: "待机" },
  { id: "running-right", label: "向右走" },
  { id: "running-left", label: "向左走" },
  { id: "waving", label: "挥手" },
  { id: "jumping", label: "跳跃" },
  { id: "failed", label: "失败" },
  { id: "waiting", label: "等待" },
  { id: "running", label: "忙碌" },
  { id: "review", label: "检查" }
];
const APP_PET_OPTIONS = [
  { id: "catbbi", label: "Catbbi" },
  { id: "dalring", label: "Dalring" },
  { id: "myngmyng", label: "Myngmyng" },
  { id: "hantatpung", label: "Hantatpung" },
  { id: "312", label: "312" },
  { id: "woonbaby", label: "Woonbaby" }
];
const APP_DEFAULT_PET_ID = "catbbi";
const APP_PET_ID_SET = new Set(APP_PET_OPTIONS.map((pet) => pet.id));

let tray = null;
let isQuitting = false;
let currentState = null;
const petWindows = new Map();
const dragSessions = new Map();
const patrolSessions = new Map();
const closingPets = new Set();

app.setName(APP_DISPLAY_NAME);

function getPackagedIconPath() {
  return path.join(process.resourcesPath, process.platform === "darwin" ? "icon.icns" : "icon.ico");
}

function getDevIconPath() {
  return path.join(__dirname, "build", process.platform === "darwin" ? "icon.icns" : "icon.ico");
}

function getAppIconPath() {
  return app.isPackaged ? getPackagedIconPath() : getDevIconPath();
}

function loadAppIcon() {
  const iconPath = getAppIconPath();
  if (fs.existsSync(iconPath)) {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) return icon;
  }
  return null;
}

function getWindowStatePath() {
  return path.join(app.getPath("userData"), WINDOW_STATE_FILE);
}

function clampPetScale(scale) {
  const value = Number(scale);
  if (!Number.isFinite(value)) return DEFAULT_PET_SCALE;
  return Math.min(PET_SCALE_LIMITS.max, Math.max(PET_SCALE_LIMITS.min, value));
}

function defaultPetWindowState(petId) {
  return {
    petId,
    petScale: DEFAULT_PET_SCALE,
    companionMode: false,
    panelOpen: false,
    patrolMode: false,
    bubbleEditorOpen: false
  };
}

function defaultState() {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    alwaysOnTop: true,
    openAtLogin: true,
    bubbleEnabled: true,
    hideDockIcon: false,
    petWindows: [defaultPetWindowState(APP_DEFAULT_PET_ID)],
    hiddenPetWindows: []
  };
}

function normalizePetWindowState(entry, fallbackPetScale = DEFAULT_PET_SCALE) {
  if (!entry || !APP_PET_ID_SET.has(entry.petId)) return null;

  const next = {
    ...defaultPetWindowState(entry.petId),
    petScale: clampPetScale(entry.petScale ?? fallbackPetScale),
    companionMode: Boolean(entry.companionMode),
    panelOpen: false,
    patrolMode: Boolean(entry.patrolMode),
    bubbleEditorOpen: false
  };

  if (typeof entry.x === "number") next.x = Math.round(entry.x);
  if (typeof entry.y === "number") next.y = Math.round(entry.y);

  return next;
}

function normalizeState(savedState) {
  const base = defaultState();
  const seen = new Set();
  const petWindowsState = [];
  const hiddenPetWindowsState = [];
  const migratedPetScale = clampPetScale(savedState.petScale);
  const isCurrentSchema = savedState.schemaVersion === STATE_SCHEMA_VERSION;

  if (Array.isArray(savedState.petWindows)) {
    for (const entry of savedState.petWindows) {
      const normalized = normalizePetWindowState(entry, migratedPetScale);
      if (!normalized || seen.has(normalized.petId)) continue;
      seen.add(normalized.petId);
      petWindowsState.push(normalized);
    }
  }

  if (Array.isArray(savedState.hiddenPetWindows)) {
    const hiddenSeen = new Set();
    for (const entry of savedState.hiddenPetWindows) {
      const normalized = normalizePetWindowState(entry, migratedPetScale);
      if (!normalized || hiddenSeen.has(normalized.petId)) continue;
      hiddenSeen.add(normalized.petId);
      hiddenPetWindowsState.push(normalized);
    }
  }

  if (!petWindowsState.length && APP_PET_ID_SET.has(savedState.selectedPetId)) {
    const migrated = normalizePetWindowState({
      petId: savedState.selectedPetId,
      x: savedState.x,
      y: savedState.y,
      petScale: migratedPetScale,
      companionMode: savedState.companionMode
    });
    if (migrated) {
      seen.add(migrated.petId);
      petWindowsState.push(migrated);
    }
  }

  const restorablePetWindows = petWindowsState.length ? petWindowsState : hiddenPetWindowsState;
  const hasCurrentPetWindowList = isCurrentSchema && Array.isArray(savedState.petWindows);

  return {
    ...base,
    schemaVersion: STATE_SCHEMA_VERSION,
    alwaysOnTop: savedState.alwaysOnTop === undefined ? base.alwaysOnTop : Boolean(savedState.alwaysOnTop),
    openAtLogin: savedState.openAtLogin === undefined ? base.openAtLogin : Boolean(savedState.openAtLogin),
    bubbleEnabled: savedState.bubbleEnabled === undefined ? base.bubbleEnabled : Boolean(savedState.bubbleEnabled),
    hideDockIcon: Boolean(savedState.hideDockIcon),
    petWindows: hasCurrentPetWindowList ? restorablePetWindows : base.petWindows,
    hiddenPetWindows: []
  };
}

function readWindowState() {
  try {
    const raw = fs.readFileSync(getWindowStatePath(), "utf8");
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

function writeWindowState() {
  if (!currentState) currentState = defaultState();
  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(currentState, null, 2));
  } catch {
    // Ignore persistence failures so the app remains usable.
  }
}

function getPetWindowState(petId) {
  return currentState.petWindows.find((entry) => entry.petId === petId) || null;
}

function ensurePetWindowState(petId) {
  let petState = getPetWindowState(petId);
  if (petState) return petState;

  petState = defaultPetWindowState(petId);
  currentState.petWindows.push(petState);
  writeWindowState();
  return petState;
}

function getWindowSizeForPetScale(scale, options = {}) {
  const normalizedScale = clampPetScale(scale);
  const petWidth = PET_BASE_WIDTH * normalizedScale;
  const petHeight = petWidth / PET_ASPECT_RATIO;

  if (options.bubbleEditorOpen) {
    return BUBBLE_EDITOR_WINDOW_SIZE;
  }

  if (options.panelOpen) {
    return PANEL_WINDOW_SIZE;
  }

  if (options.companionMode) {
    return {
      width: Math.max(166, Math.round(petWidth + 46)),
      height: Math.max(198, Math.round(petHeight + 70))
    };
  }

  return {
    width: Math.max(174, Math.round(petWidth + 52)),
    height: Math.max(208, Math.round(petHeight + 82))
  };
}

function getWindowSizeForPet(petId) {
  const petState = ensurePetWindowState(petId);
  return getWindowSizeForPetScale(petState.petScale, {
    companionMode: petState.companionMode,
    panelOpen: petState.panelOpen,
    bubbleEditorOpen: petState.bubbleEditorOpen
  });
}

function clampBoundsToWorkArea(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const { workArea } = display;
  const x = Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - bounds.width);
  const y = Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - bounds.height);

  return {
    ...bounds,
    x: Math.round(x),
    y: Math.round(y)
  };
}

function getDefaultBoundsForPet(petId) {
  const target = getWindowSizeForPet(petId);
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { workArea } = display;
  const index = Math.max(0, currentState.petWindows.findIndex((entry) => entry.petId === petId));
  const column = index % 3;
  const row = Math.floor(index / 3);

  return clampBoundsToWorkArea({
    x: Math.round(workArea.x + workArea.width - target.width - 48 - column * 42),
    y: Math.round(workArea.y + workArea.height - target.height - 64 - row * 28),
    width: target.width,
    height: target.height
  });
}

function syncBoundsIntoState(window) {
  if (!window || window.isDestroyed()) return;

  const petState = getPetWindowState(window.petId);
  if (!petState) return;

  const bounds = window.getBounds();
  petState.x = bounds.x;
  petState.y = bounds.y;
}

function writeWindowStateForWindow(window) {
  syncBoundsIntoState(window);
  writeWindowState();
}

function writeWindowStateForOpenPets() {
  for (const window of petWindows.values()) {
    if (window.isDestroyed()) continue;
    stopWindowDrag(window);
    syncBoundsIntoState(window);
  }
  writeWindowState();
}

function listActivePetIds() {
  return currentState.petWindows.map((entry) => entry.petId);
}

function sendShellSettings(window) {
  if (!window || window.isDestroyed()) return;
  const petState = getPetWindowState(window.petId) || defaultPetWindowState(window.petId);

  window.webContents.send("shell:settings", {
    alwaysOnTop: currentState.alwaysOnTop,
    openAtLogin: currentState.openAtLogin,
    bubbleEnabled: currentState.bubbleEnabled,
    companionMode: petState.companionMode,
    panelOpen: petState.panelOpen,
    patrolMode: petState.patrolMode,
    petId: window.petId,
    activePetIds: listActivePetIds(),
    hideDockIcon: currentState.hideDockIcon,
    petScale: petState.petScale
  });
}

function broadcastSettings() {
  for (const window of petWindows.values()) {
    sendShellSettings(window);
  }
}

function broadcastBubbleEnabled() {
  for (const window of petWindows.values()) {
    if (!window.isDestroyed()) {
      window.webContents.send("shell:bubbles-enabled", currentState.bubbleEnabled);
    }
  }
}

function createMacTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <rect x="4" y="4" width="36" height="36" rx="9" fill="#ffffff"/>
      <rect x="5.5" y="5.5" width="33" height="33" rx="7.5" fill="none" stroke="#111111" stroke-width="3"/>
      <text x="22" y="29" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif" font-size="21" font-weight="800" fill="#111111">B</text>
    </svg>
  `.trim();
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
  const trayIcon = icon.resize({ width: 22, height: 22, quality: "best" });
  trayIcon.setTemplateImage(false);
  return trayIcon;
}

function createTrayIcon() {
  if (process.platform === "darwin") {
    return createMacTrayIcon();
  }

  const fileIcon = loadAppIcon();
  if (fileIcon) {
    const trayIcon = fileIcon.resize({ width: 32, height: 32, quality: "best" });
    trayIcon.setTemplateImage(false);
    return trayIcon;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="28" fill="#ffffff"/>
      <circle cx="22" cy="26" r="3.5" fill="#111111"/>
      <circle cx="42" cy="26" r="3.5" fill="#111111"/>
      <path d="M20 38 C26 44, 38 44, 44 38" fill="none" stroke="#111111" stroke-width="4" stroke-linecap="round"/>
      <path d="M32 49 L26 43 C23 40, 23 35, 27 33 C29 32, 31 33, 32 35 C33 33, 35 32, 37 33 C41 35, 41 40, 38 43 Z" fill="#ef174f"/>
    </svg>
  `.trim();

  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
}

function shouldSkipTaskbar() {
  return process.platform === "win32" ? currentState.hideDockIcon : false;
}

function getHideAppIconLabel() {
  if (process.platform === "darwin") return "隐藏 Dock 图标";
  if (process.platform === "win32") return "隐藏任务栏图标";
  return "隐藏应用图标";
}

function anyPetVisible() {
  return Array.from(petWindows.values()).some((window) => !window.isDestroyed() && window.isVisible());
}

function showPetWindow(petId) {
  let window = petWindows.get(petId);
  if (!window || window.isDestroyed()) {
    window = createPetWindow(petId);
  }

  if (!window.isVisible()) window.show();
  return window;
}

function showAllPets() {
  let firstWindow = null;
  currentState.hiddenPetWindows = [];

  for (const { id: petId } of APP_PET_OPTIONS) {
    ensurePetWindowState(petId);
    const window = showPetWindow(petId);
    if (!firstWindow) firstWindow = window;
  }

  writeWindowState();
  refreshTrayMenu();
  broadcastSettings();

  if (firstWindow && !firstWindow.isDestroyed()) {
    firstWindow.focus();
  }
}

function getHiddenPetWindowStates() {
  return Array.isArray(currentState.hiddenPetWindows)
    ? currentState.hiddenPetWindows
        .map((entry) => normalizePetWindowState(entry))
        .filter(Boolean)
    : [];
}

function restoreHiddenPets() {
  if (!currentState.petWindows.length) {
    const hiddenPetWindows = getHiddenPetWindowStates();
    if (hiddenPetWindows.length) {
      currentState.petWindows = hiddenPetWindows;
    }
  }
  currentState.hiddenPetWindows = [];

  let firstWindow = null;
  for (const entry of currentState.petWindows) {
    const window = showPetWindow(entry.petId);
    if (!firstWindow) firstWindow = window;
  }

  writeWindowState();
  refreshTrayMenu();
  broadcastSettings();

  if (firstWindow && !firstWindow.isDestroyed()) {
    firstWindow.focus();
  }
}

function hideAllPets() {
  const activePetWindows = currentState.petWindows
    .map((entry) => {
      const window = petWindows.get(entry.petId);
      if (window && !window.isDestroyed()) {
        stopPatrol(window, { quiet: true });
        stopWindowDrag(window);
        syncBoundsIntoState(window);
      }
      return normalizePetWindowState(entry);
    })
    .filter(Boolean);

  currentState.petWindows = activePetWindows;

  for (const window of petWindows.values()) {
    if (window.isDestroyed()) continue;
    window.hide();
  }

  currentState.hiddenPetWindows = [];
  writeWindowState();
  refreshTrayMenu();
}

function applyWindowSizeForPet(window, anchor = "center") {
  if (!window || window.isDestroyed()) return;

  const target = getWindowSizeForPet(window.petId);
  const bounds = window.getBounds();
  const nextBounds = anchor === "bottom"
    ? {
        x: Math.round(bounds.x + bounds.width / 2 - target.width / 2),
        y: Math.round(bounds.y + bounds.height - target.height),
        width: target.width,
        height: target.height
      }
    : {
        x: Math.round(bounds.x + bounds.width / 2 - target.width / 2),
        y: Math.round(bounds.y + bounds.height / 2 - target.height / 2),
        width: target.width,
        height: target.height
      };

  if (target.width >= bounds.width || target.height >= bounds.height) {
    window.setMaximumSize(target.width, target.height);
    window.setMinimumSize(target.width, target.height);
  } else {
    window.setMinimumSize(target.width, target.height);
    window.setMaximumSize(target.width, target.height);
  }

  window.setBounds(clampBoundsToWorkArea(nextBounds));
  writeWindowStateForWindow(window);
}

function sendPetCommand(window, command) {
  if (!window || window.isDestroyed()) return;
  window.webContents.send("shell:pet-command", command);
}

function setAlwaysOnTop(enabled) {
  currentState.alwaysOnTop = Boolean(enabled);

  for (const window of petWindows.values()) {
    if (window.isDestroyed()) continue;
    window.setAlwaysOnTop(currentState.alwaysOnTop, "screen-saver");
  }

  writeWindowState();
  refreshTrayMenu();
  broadcastSettings();
  return currentState.alwaysOnTop;
}

function setBubbleEnabled(enabled) {
  currentState.bubbleEnabled = Boolean(enabled);
  writeWindowState();
  refreshTrayMenu();
  broadcastSettings();
  broadcastBubbleEnabled();
}

function applyLoginItemSetting(enabled) {
  currentState.openAtLogin = Boolean(enabled);
  app.setLoginItemSettings({
    openAtLogin: currentState.openAtLogin,
    path: process.execPath,
    args: []
  });
  writeWindowState();
  refreshTrayMenu();
  broadcastSettings();
}

function applyDockVisibility(hideDockIcon) {
  currentState.hideDockIcon = Boolean(hideDockIcon);

  if (process.platform === "darwin" && app.dock) {
    if (currentState.hideDockIcon) app.dock.hide();
    else app.dock.show();
  }

  for (const window of petWindows.values()) {
    if (window.isDestroyed()) continue;
    window.setSkipTaskbar(shouldSkipTaskbar());
  }

  writeWindowState();
  refreshTrayMenu();
  broadcastSettings();
}

function setPetScale(window, scale) {
  if (!window || window.isDestroyed()) return 1;

  const petState = ensurePetWindowState(window.petId);
  petState.petScale = clampPetScale(scale);
  applyWindowSizeForPet(window, "center");

  writeWindowState();
  sendShellSettings(window);
  return petState.petScale;
}

function setCompanionMode(window, enabled) {
  if (!window || window.isDestroyed()) return false;

  const petState = ensurePetWindowState(window.petId);
  petState.companionMode = Boolean(enabled);
  applyWindowSizeForPet(window, "center");
  sendShellSettings(window);
  return petState.companionMode;
}

function setPanelOpen(window, open) {
  if (!window || window.isDestroyed()) return false;
  if (closingPets.has(window.petId)) return false;

  const petState = ensurePetWindowState(window.petId);
  petState.panelOpen = Boolean(open);
  if (petState.panelOpen) {
    petState.bubbleEditorOpen = false;
  }
  applyWindowSizeForPet(window, "center");
  sendShellSettings(window);
  return petState.panelOpen;
}

function setBubbleEditorOpen(window, open) {
  if (!window || window.isDestroyed()) return false;

  const petState = ensurePetWindowState(window.petId);
  petState.bubbleEditorOpen = Boolean(open);
  if (petState.bubbleEditorOpen) {
    petState.panelOpen = false;
  }
  applyWindowSizeForPet(window, "center");
  sendShellSettings(window);
  return petState.bubbleEditorOpen;
}

function stopWindowDrag(window) {
  if (!window) return;

  const session = dragSessions.get(window.petId);
  if (!session) return;

  clearInterval(session.timer);
  dragSessions.delete(window.petId);
  writeWindowStateForWindow(window);
}

function stopPatrol(window, options = {}) {
  if (!window || window.isDestroyed()) return false;

  const session = patrolSessions.get(window.petId);
  if (session) {
    clearInterval(session.timer);
    patrolSessions.delete(window.petId);
  }

  const petState = getPetWindowState(window.petId);
  if (petState) {
    petState.patrolMode = false;
    writeWindowStateForWindow(window);
    sendShellSettings(window);
  } else {
    writeWindowState();
  }
  if (!options.quiet) {
    sendPetCommand(window, { type: "action", action: "idle" });
  }
  return false;
}

function startPatrol(window) {
  if (!window || window.isDestroyed()) return true;

  const petState = ensurePetWindowState(window.petId);
  petState.patrolMode = true;
  writeWindowState();

  if (patrolSessions.has(window.petId)) {
    sendShellSettings(window);
    return true;
  }

  let direction = 1;
  sendPetCommand(window, { type: "action", action: "running-right", hold: true, quiet: true, patrol: true });

  const timer = setInterval(() => {
    if (!window || window.isDestroyed()) {
      clearInterval(timer);
      patrolSessions.delete(window?.petId);
      return;
    }

    const bounds = window.getBounds();
    const { workArea } = screen.getDisplayMatching(bounds);
    let nextX = Math.round(bounds.x + direction * PATROL_SPEED_PX);
    const minX = workArea.x;
    const maxX = workArea.x + workArea.width - bounds.width;

    if (nextX <= minX) {
      nextX = minX;
      direction = 1;
      sendPetCommand(window, { type: "action", action: "running-right", hold: true, quiet: true, patrol: true });
    } else if (nextX >= maxX) {
      nextX = maxX;
      direction = -1;
      sendPetCommand(window, { type: "action", action: "running-left", hold: true, quiet: true, patrol: true });
    }

    window.setPosition(nextX, bounds.y);
  }, PATROL_TICK_MS);

  patrolSessions.set(window.petId, { timer });
  sendShellSettings(window);
  return true;
}

function setPatrolMode(window, enabled) {
  if (!window || window.isDestroyed()) return false;
  if (enabled) return startPatrol(window);
  return stopPatrol(window);
}

function startWindowDrag(window) {
  if (!window || window.isDestroyed()) return false;

  stopPatrol(window, { quiet: true });
  stopWindowDrag(window);
  const cursor = screen.getCursorScreenPoint();
  const bounds = window.getBounds();

  dragSessions.set(window.petId, {
    cursor,
    bounds,
    timer: setInterval(() => {
      const session = dragSessions.get(window.petId);
      if (!session || window.isDestroyed()) {
        stopWindowDrag(window);
        return;
      }

      const nextCursor = screen.getCursorScreenPoint();
      window.setPosition(
        session.bounds.x + nextCursor.x - session.cursor.x,
        session.bounds.y + nextCursor.y - session.cursor.y
      );
    }, 16)
  });

  return true;
}

function resetAllPetPositions() {
  for (const petId of listActivePetIds()) {
    const window = showPetWindow(petId);
    window.setBounds(getDefaultBoundsForPet(petId));
    writeWindowStateForWindow(window);
  }
}

function addPetToDesktop(petId) {
  if (!APP_PET_ID_SET.has(petId)) return;
  currentState.hiddenPetWindows = [];
  if (!getPetWindowState(petId)) {
    currentState.petWindows.push(defaultPetWindowState(petId));
    writeWindowState();
  }

  const window = showPetWindow(petId);
  window.setAlwaysOnTop(currentState.alwaysOnTop, "screen-saver");
  refreshTrayMenu();
  broadcastSettings();
}

function removePetFromDesktop(petId) {
  currentState.petWindows = currentState.petWindows.filter((entry) => entry.petId !== petId);
  currentState.hiddenPetWindows = currentState.hiddenPetWindows.filter((entry) => entry.petId !== petId);
  writeWindowState();

  const window = petWindows.get(petId);
  if (window && !window.isDestroyed()) {
    closingPets.add(petId);
    stopPatrol(window, { quiet: true });
    stopWindowDrag(window);
    window.close();
  }

  petWindows.delete(petId);
  refreshTrayMenu();
  broadcastSettings();
}

function buildPetSelectionSubmenu() {
  return APP_PET_OPTIONS.map((pet) => ({
    label: pet.label,
    type: "checkbox",
    checked: Boolean(getPetWindowState(pet.id)),
    click: () => {
      if (getPetWindowState(pet.id)) removePetFromDesktop(pet.id);
      else addPetToDesktop(pet.id);
    }
  }));
}

function buildPetControlMenuItems() {
  const menuItems = [
    {
      label: "显示全部宠物",
      click: () => {
        showAllPets();
      }
    },
    { label: "隐藏全部宠物", click: () => hideAllPets() },
    { type: "separator" },
    { label: "选择宠物", submenu: buildPetSelectionSubmenu() },
    {
      label: "显示气泡",
      type: "checkbox",
      checked: currentState.bubbleEnabled,
      click: (item) => setBubbleEnabled(item.checked)
    },
    {
      label: "置顶显示",
      type: "checkbox",
      checked: currentState.alwaysOnTop,
      click: (item) => setAlwaysOnTop(item.checked)
    }
  ];

  if (process.platform === "darwin" || process.platform === "win32") {
    menuItems.push({
      label: getHideAppIconLabel(),
      type: "checkbox",
      checked: currentState.hideDockIcon,
      click: (item) => applyDockVisibility(item.checked)
    });
  }

  menuItems.push(
    {
      label: "开机启动",
      type: "checkbox",
      checked: currentState.openAtLogin,
      click: (item) => applyLoginItemSetting(item.checked)
    },
    { label: "重置位置", click: () => resetAllPetPositions() },
    { type: "separator" }
  );

  return menuItems;
}

function buildAppMenuTemplate() {
  if (process.platform !== "darwin") {
    return null;
  }

  return [
    {
      label: app.name,
      submenu: [
        { role: "about", label: `关于 ${APP_DISPLAY_NAME}` },
        { type: "separator" },
        ...buildPetControlMenuItems(),
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        {
          label: `退出 ${APP_DISPLAY_NAME}`,
          accelerator: "Command+Q",
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
    { role: "help" }
  ];
}

function refreshApplicationMenu() {
  const appMenuTemplate = buildAppMenuTemplate();
  if (appMenuTemplate) {
    Menu.setApplicationMenu(Menu.buildFromTemplate(appMenuTemplate));
  }
}

function refreshTrayMenu() {
  if (process.platform === "darwin") {
    refreshApplicationMenu();
    return;
  }

  if (!tray) return;

  const menuTemplate = [
    ...buildPetControlMenuItems(),
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ];

  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
}

function showPetControlMenu(window) {
  if (!window || window.isDestroyed()) return false;
  const petState = ensurePetWindowState(window.petId);

  const menuTemplate = [
    {
      label: "控制面板",
      enabled: false
    },
    { type: "separator" },
    {
      label: "巡逻模式",
      type: "checkbox",
      checked: Boolean(petState.patrolMode),
      click: (item) => setPatrolMode(window, item.checked)
    },
    {
      label: "步态",
      submenu: [
        {
          label: "待机",
          click: () => {
            stopPatrol(window, { quiet: true });
            sendPetCommand(window, { type: "action", action: "idle" });
          }
        },
        {
          label: "向左走",
          click: () => {
            stopPatrol(window, { quiet: true });
            sendPetCommand(window, { type: "action", action: "running-left", hold: true });
          }
        },
        {
          label: "向右走",
          click: () => {
            stopPatrol(window, { quiet: true });
            sendPetCommand(window, { type: "action", action: "running-right", hold: true });
          }
        },
        {
          label: "忙碌奔跑",
          click: () => {
            stopPatrol(window, { quiet: true });
            sendPetCommand(window, { type: "action", action: "running", hold: true });
          }
        }
      ]
    },
    {
      label: "动作",
      submenu: PET_ACTIONS
        .filter((action) => !["idle", "running-left", "running-right", "running"].includes(action.id))
        .map((action) => ({
          label: action.label,
          click: () => {
            stopPatrol(window, { quiet: true });
            sendPetCommand(window, { type: "action", action: action.id });
          }
        }))
    },
    { type: "separator" },
    {
      label: "下一句气泡",
      click: () => sendPetCommand(window, { type: "bubble-next" })
    },
    {
      label: "重命名宠物",
      click: () => sendPetCommand(window, { type: "open-name-editor" })
    },
    {
      label: "编辑气泡文字",
      click: () => sendPetCommand(window, { type: "open-bubble-editor" })
    },
    {
      label: "缩放宠物",
      submenu: [
        { label: "小", click: () => setPetScale(window, 0.4) },
        { label: "中", click: () => setPetScale(window, 0.55) },
        { label: "大", click: () => setPetScale(window, 0.7) }
      ]
    },
    { type: "separator" },
    {
      label: "显示气泡",
      type: "checkbox",
      checked: currentState.bubbleEnabled,
      click: (item) => setBubbleEnabled(item.checked)
    },
    {
      label: "置顶显示",
      type: "checkbox",
      checked: currentState.alwaysOnTop,
      click: (item) => setAlwaysOnTop(item.checked)
    },
    {
      label: "关闭这只宠物",
      click: () => removePetFromDesktop(window.petId)
    },
    { type: "separator" },
    ...buildPetControlMenuItems(),
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  menu.popup({ window, callback: () => setPanelOpen(window, false) });
  setPanelOpen(window, false);
  return true;
}

function createTray() {
  if (process.platform === "darwin") {
    refreshApplicationMenu();
    return;
  }

  tray = new Tray(createTrayIcon());
  tray.setToolTip(APP_DISPLAY_NAME);
  tray.on("click", () => {
    if (anyPetVisible()) hideAllPets();
    else restoreHiddenPets();
  });
  refreshTrayMenu();
}

function createPetWindow(petId) {
  const petState = ensurePetWindowState(petId);
  const size = getWindowSizeForPet(petId);
  const initialBounds = typeof petState.x === "number" && typeof petState.y === "number"
    ? clampBoundsToWorkArea({ x: petState.x, y: petState.y, width: size.width, height: size.height })
    : getDefaultBoundsForPet(petId);

  const petLabel = APP_PET_OPTIONS.find((pet) => pet.id === petId)?.label || petId;
  const window = new BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    minWidth: initialBounds.width,
    minHeight: initialBounds.height,
    maxWidth: initialBounds.width,
    maxHeight: initialBounds.height,
    transparent: true,
    frame: false,
    hasShadow: false,
    roundedCorners: false,
    resizable: false,
    backgroundColor: "#00000000",
    autoHideMenuBar: true,
    show: false,
    skipTaskbar: shouldSkipTaskbar(),
    alwaysOnTop: currentState.alwaysOnTop,
    title: `${APP_DISPLAY_NAME} - ${petLabel}`,
    icon: getAppIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false
    }
  });

  window.petId = petId;
  window.setAlwaysOnTop(currentState.alwaysOnTop, "screen-saver");

  window.once("ready-to-show", () => {
    if (typeof petState.x !== "number" || typeof petState.y !== "number") {
      window.setBounds(getDefaultBoundsForPet(petId));
      writeWindowStateForWindow(window);
    }

    window.show();
    sendShellSettings(window);
    window.webContents.send("shell:bubbles-enabled", currentState.bubbleEnabled);
    if (petState.patrolMode) {
      startPatrol(window);
    }
  });

  window.on("close", (event) => {
    if (isQuitting || closingPets.has(petId)) {
      stopPatrol(window, { quiet: true });
      stopWindowDrag(window);
      writeWindowStateForWindow(window);
      return;
    }

    event.preventDefault();
    hideAllPets();
  });

  window.on("closed", () => {
    stopPatrol(window, { quiet: true });
    stopWindowDrag(window);
    closingPets.delete(petId);
    petWindows.delete(petId);
    refreshTrayMenu();
  });

  window.on("move", () => {
    if (!patrolSessions.has(petId)) {
      writeWindowStateForWindow(window);
    }
  });
  window.on("query-session-end", () => writeWindowStateForOpenPets());
  window.on("session-end", () => writeWindowStateForOpenPets());
  window.on("blur", () => stopWindowDrag(window));
  window.on("show", () => sendShellSettings(window));

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  window.loadFile(path.join(__dirname, "index.html"));
  petWindows.set(petId, window);
  return window;
}

function getEventWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

ipcMain.handle("shell:toggle-always-on-top", () => {
  return { alwaysOnTop: setAlwaysOnTop(!currentState.alwaysOnTop) };
});

ipcMain.handle("shell:set-pet-scale", (_event, scale) => {
  const window = getEventWindow(_event);
  return { petScale: setPetScale(window, scale) };
});

ipcMain.handle("shell:set-companion-mode", (event, enabled) => {
  const window = getEventWindow(event);
  return { companionMode: setCompanionMode(window, enabled) };
});

ipcMain.handle("shell:set-bubble-editor-open", (event, open) => {
  const window = getEventWindow(event);
  return { bubbleEditorOpen: setBubbleEditorOpen(window, open) };
});

ipcMain.handle("shell:set-patrol-mode", (event, enabled) => {
  return { patrolMode: setPatrolMode(getEventWindow(event), enabled) };
});

ipcMain.handle("shell:set-pet-input-transparent", (event, transparent) => {
  const window = getEventWindow(event);
  if (window && !window.isDestroyed()) {
    window.setIgnoreMouseEvents(Boolean(transparent), { forward: true });
  }
  return { ok: true };
});

ipcMain.handle("shell:start-window-drag", (event) => {
  return { ok: startWindowDrag(getEventWindow(event)) };
});

ipcMain.handle("shell:stop-window-drag", (event) => {
  stopWindowDrag(getEventWindow(event));
  return { ok: true };
});

ipcMain.handle("shell:show-control-menu", (event) => {
  return { ok: showPetControlMenu(getEventWindow(event)) };
});

ipcMain.handle("shell:hide-window", () => {
  hideAllPets();
  return { ok: true };
});

ipcMain.handle("shell:close-current-pet", (event) => {
  const window = getEventWindow(event);
  if (window?.petId) {
    removePetFromDesktop(window.petId);
  }
  return { ok: true };
});

ipcMain.handle("shell:quit", () => {
  isQuitting = true;
  app.quit();
  return { ok: true };
});

ipcMain.handle("shell:get-settings", (event) => {
  const window = getEventWindow(event);
  const petState = window?.petId ? ensurePetWindowState(window.petId) : defaultPetWindowState(APP_DEFAULT_PET_ID);
  return {
    alwaysOnTop: currentState.alwaysOnTop,
    openAtLogin: currentState.openAtLogin,
    bubbleEnabled: currentState.bubbleEnabled,
    companionMode: petState.companionMode,
    panelOpen: petState.panelOpen,
    patrolMode: petState.patrolMode,
    petId: window?.petId || currentState.petWindows[0]?.petId || APP_DEFAULT_PET_ID,
    activePetIds: listActivePetIds(),
    hideDockIcon: currentState.hideDockIcon,
    petScale: petState.petScale
  };
});

ipcMain.handle("shell:set-bubble-enabled", (_event, enabled) => {
  setBubbleEnabled(enabled);
  return { bubbleEnabled: currentState.bubbleEnabled };
});

ipcMain.handle("shell:reset-position", () => {
  resetAllPetPositions();
  return { ok: true };
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (anyPetVisible()) return;
    restoreHiddenPets();
  });

  app.whenReady().then(() => {
    currentState = readWindowState();
    const appIcon = loadAppIcon();
    if (process.platform === "darwin" && app.dock && appIcon) {
      app.dock.setIcon(appIcon);
    }

    for (const petId of listActivePetIds()) {
      createPetWindow(petId);
    }

    createTray();
    applyDockVisibility(currentState.hideDockIcon);
    applyLoginItemSetting(currentState.openAtLogin);

    app.on("activate", () => {
      if (!currentState.petWindows.length) {
        restoreHiddenPets();
      } else if (BrowserWindow.getAllWindows().length === 0) {
        for (const petId of listActivePetIds()) {
          createPetWindow(petId);
        }
      } else {
        for (const petId of listActivePetIds()) {
          showPetWindow(petId);
        }
      }
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
    for (const window of petWindows.values()) {
      stopPatrol(window, { quiet: true });
    }
    writeWindowStateForOpenPets();
  });

  app.on("window-all-closed", (event) => {
    event.preventDefault();
  });
}
