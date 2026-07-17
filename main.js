const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, screen } = require("electron");
const fs = require("fs");
const path = require("path");

const WINDOW_STATE_FILE = "window-state.json";
const APP_DISPLAY_NAME = "BOYNEXTDOOR Pets";
const STATE_SCHEMA_VERSION = 3;
const PET_SCALE_LIMITS = { min: 0.35, max: 1 };
const PET_ASPECT_RATIO = 384 / 416;
const DEFAULT_PET_SCALE = 0.6;
const PET_OPTIONS = [
  { id: "catbbi", label: "Catbbi" },
  { id: "dalring", label: "Dalring" },
  { id: "myngmyng", label: "Myngmyng" },
  { id: "hantatpung", label: "Hantatpung" },
  { id: "312", label: "312" },
  { id: "woonbaby", label: "Woonbaby" }
];
const DEFAULT_PET_ID = "catbbi";
const PET_ID_SET = new Set(PET_OPTIONS.map((pet) => pet.id));

let tray = null;
let isQuitting = false;
let currentState = null;
const petWindows = new Map();
const dragSessions = new Map();
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
    petWindows: [defaultPetWindowState(DEFAULT_PET_ID)],
    hiddenPetWindows: []
  };
}

function normalizePetWindowState(entry, fallbackPetScale = DEFAULT_PET_SCALE) {
  if (!entry || !PET_ID_SET.has(entry.petId)) return null;

  const next = {
    ...defaultPetWindowState(entry.petId),
    petScale: clampPetScale(entry.petScale ?? fallbackPetScale),
    companionMode: Boolean(entry.companionMode),
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

  if (!petWindowsState.length && PET_ID_SET.has(savedState.selectedPetId)) {
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

  return {
    ...base,
    schemaVersion: STATE_SCHEMA_VERSION,
    alwaysOnTop: savedState.alwaysOnTop === undefined ? base.alwaysOnTop : Boolean(savedState.alwaysOnTop),
    openAtLogin: savedState.openAtLogin === undefined ? base.openAtLogin : Boolean(savedState.openAtLogin),
    bubbleEnabled: savedState.bubbleEnabled === undefined ? base.bubbleEnabled : Boolean(savedState.bubbleEnabled),
    hideDockIcon: Boolean(savedState.hideDockIcon),
    petWindows: isCurrentSchema && petWindowsState.length ? petWindowsState : base.petWindows,
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
  const petWidth = 200 * normalizedScale;
  const petHeight = petWidth / PET_ASPECT_RATIO;

  if (options.bubbleEditorOpen) {
    return { width: 660, height: 520 };
  }

  if (options.companionMode) {
    return {
      width: Math.max(304, Math.round(petWidth + 48)),
      height: Math.max(198, Math.round(petHeight + 118))
    };
  }

  return {
    width: Math.max(214, Math.round(petWidth + 64)),
    height: Math.max(410, Math.round(petHeight + 330))
  };
}

function getWindowSizeForPet(petId) {
  const petState = ensurePetWindowState(petId);
  return getWindowSizeForPetScale(petState.petScale, {
    companionMode: petState.companionMode,
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
      <text x="22" y="29" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif" font-size="21" font-weight="800" fill="#111111">R</text>
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
  if (process.platform === "darwin") return "Hide Dock Icon";
  if (process.platform === "win32") return "Hide Taskbar Icon";
  return "Hide App Icon";
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

  for (const { id: petId } of PET_OPTIONS) {
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
  const hiddenPetWindows = getHiddenPetWindowStates();
  const petsToRestore = hiddenPetWindows.length ? hiddenPetWindows : [defaultPetWindowState(DEFAULT_PET_ID)];
  currentState.petWindows = petsToRestore;
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
        stopWindowDrag(window);
        syncBoundsIntoState(window);
      }
      return normalizePetWindowState(entry);
    })
    .filter(Boolean);

  for (const window of petWindows.values()) {
    if (window.isDestroyed()) continue;
    window.hide();
  }

  currentState.hiddenPetWindows = activePetWindows;
  currentState.petWindows = [];
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

function setBubbleEditorOpen(window, open) {
  if (!window || window.isDestroyed()) return false;

  const petState = ensurePetWindowState(window.petId);
  petState.bubbleEditorOpen = Boolean(open);
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

function startWindowDrag(window) {
  if (!window || window.isDestroyed()) return false;

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
  if (!PET_ID_SET.has(petId)) return;
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
  writeWindowState();

  const window = petWindows.get(petId);
  if (window && !window.isDestroyed()) {
    closingPets.add(petId);
    stopWindowDrag(window);
    window.close();
  }

  petWindows.delete(petId);
  refreshTrayMenu();
  broadcastSettings();
}

function buildPetSelectionSubmenu() {
  return PET_OPTIONS.map((pet) => ({
    label: pet.label,
    type: "checkbox",
    checked: Boolean(getPetWindowState(pet.id)),
    click: (item) => {
      if (item.checked) addPetToDesktop(pet.id);
      else removePetFromDesktop(pet.id);
    }
  }));
}

function buildPetControlMenuItems() {
  const menuItems = [
    {
      label: "Show All Pets",
      click: () => {
        showAllPets();
      }
    },
    { label: "Hide All Pets", click: () => hideAllPets() },
    { type: "separator" },
    { label: "Choose Pet", submenu: buildPetSelectionSubmenu() },
    {
      label: "Show Bubbles",
      type: "checkbox",
      checked: currentState.bubbleEnabled,
      click: (item) => setBubbleEnabled(item.checked)
    },
    {
      label: "Always On Top",
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
      label: "Open At Login",
      type: "checkbox",
      checked: currentState.openAtLogin,
      click: (item) => applyLoginItemSetting(item.checked)
    },
    { label: "Reset Positions", click: () => resetAllPetPositions() },
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
        { role: "about", label: `About ${APP_DISPLAY_NAME}` },
        { type: "separator" },
        ...buildPetControlMenuItems(),
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        {
          label: `Quit ${APP_DISPLAY_NAME}`,
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
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ];

  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate));
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

  const petLabel = PET_OPTIONS.find((pet) => pet.id === petId)?.label || petId;
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
  });

  window.on("close", (event) => {
    if (isQuitting || closingPets.has(petId)) {
      stopWindowDrag(window);
      writeWindowStateForWindow(window);
      return;
    }

    event.preventDefault();
    hideAllPets();
  });

  window.on("closed", () => {
    stopWindowDrag(window);
    closingPets.delete(petId);
    petWindows.delete(petId);
    refreshTrayMenu();
  });

  window.on("move", () => writeWindowStateForWindow(window));
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
  const petState = window?.petId ? ensurePetWindowState(window.petId) : defaultPetWindowState(DEFAULT_PET_ID);
  return {
    alwaysOnTop: currentState.alwaysOnTop,
    openAtLogin: currentState.openAtLogin,
    bubbleEnabled: currentState.bubbleEnabled,
    companionMode: petState.companionMode,
    petId: window?.petId || currentState.petWindows[0]?.petId || DEFAULT_PET_ID,
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
      writeWindowStateForWindow(window);
    }
  });

  app.on("window-all-closed", (event) => {
    event.preventDefault();
  });
}
