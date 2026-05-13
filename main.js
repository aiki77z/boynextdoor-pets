const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, screen } = require("electron");
const fs = require("fs");
const path = require("path");

const WINDOW_STATE_FILE = "window-state.json";
const COMPACT_SIZE = { width: 280, height: 360 };
const PET_SCALE_LIMITS = { min: 0.35, max: 1 };
const PET_OPTIONS = [
  { id: "catbbi", label: "Catbbi" },
  { id: "dalring", label: "Dalring" },
  { id: "myngmyng", label: "Myngmyng" },
  { id: "hantatpung", label: "Hantatpung" },
  { id: "312", label: "312" },
  { id: "woonbaby", label: "Woonbaby" }
];

let mainWindow = null;
let tray = null;
let isQuitting = false;
let currentState = null;
let dragSession = null;

function getPackagedIconPath() {
  return path.join(process.resourcesPath, "icon.ico");
}

function getDevIconPath() {
  return path.join(__dirname, "build", "icon.ico");
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

function defaultState() {
  return {
    width: COMPACT_SIZE.width,
    height: COMPACT_SIZE.height,
    alwaysOnTop: true,
    openAtLogin: true,
    selectedPetId: "catbbi",
    bubbleEnabled: true,
    petScale: 1
  };
}

function readWindowState() {
  try {
    const raw = fs.readFileSync(getWindowStatePath(), "utf8");
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function syncBoundsIntoState(window) {
  if (!window || window.isDestroyed()) return;
  const bounds = window.getBounds();
  currentState = {
    ...currentState,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    alwaysOnTop: window.isAlwaysOnTop()
  };
}

function writeWindowState(window) {
  if (!currentState) currentState = defaultState();
  syncBoundsIntoState(window);
  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(currentState, null, 2));
  } catch {
    // Ignore persistence failures so the app remains usable.
  }
}

function sendShellSettings() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("shell:settings", {
    alwaysOnTop: mainWindow.isAlwaysOnTop(),
    openAtLogin: currentState.openAtLogin,
    bubbleEnabled: currentState.bubbleEnabled,
    selectedPetId: currentState.selectedPetId
  });
}

function selectPet(petId) {
  if (!PET_OPTIONS.some((pet) => pet.id === petId)) return;
  currentState.selectedPetId = petId;
  writeWindowState(mainWindow);
  refreshTrayMenu();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("pet:selected", { petId });
    sendShellSettings();
  }
}

function setBubbleEnabled(enabled) {
  currentState.bubbleEnabled = Boolean(enabled);
  writeWindowState(mainWindow);
  refreshTrayMenu();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("shell:bubbles-enabled", currentState.bubbleEnabled);
    sendShellSettings();
  }
}

function applyLoginItemSetting(enabled) {
  currentState.openAtLogin = Boolean(enabled);
  app.setLoginItemSettings({
    openAtLogin: currentState.openAtLogin,
    path: process.execPath,
    args: []
  });
  writeWindowState(mainWindow);
  refreshTrayMenu();
  sendShellSettings();
}

function createTrayIcon() {
  const fileIcon = loadAppIcon();
  if (fileIcon) return fileIcon;

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

function showWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function hideWindow() {
  if (!mainWindow) return;
  stopWindowDrag();
  writeWindowState(mainWindow);
  mainWindow.hide();
}

function clampPetScale(scale) {
  const value = Number(scale);
  if (!Number.isFinite(value)) return 1;
  return Math.min(PET_SCALE_LIMITS.max, Math.max(PET_SCALE_LIMITS.min, value));
}

function getWindowSizeForPetScale(scale) {
  const normalizedScale = clampPetScale(scale);
  const petWidth = 220 * normalizedScale;
  const petHeight = petWidth / 0.92;
  return {
    width: Math.max(214, Math.round(petWidth + 64)),
    height: Math.max(410, Math.round(petHeight + 330))
  };
}

function setPetScale(scale) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  currentState.petScale = clampPetScale(scale);
  const target = getWindowSizeForPetScale(currentState.petScale);
  const bounds = mainWindow.getBounds();
  if (target.width >= bounds.width || target.height >= bounds.height) {
    mainWindow.setMaximumSize(target.width, target.height);
    mainWindow.setMinimumSize(target.width, target.height);
  } else {
    mainWindow.setMinimumSize(target.width, target.height);
    mainWindow.setMaximumSize(target.width, target.height);
  }
  mainWindow.setBounds({
    x: bounds.x,
    y: bounds.y + bounds.height - target.height,
    width: target.width,
    height: target.height
  });
  writeWindowState(mainWindow);
}

function stopWindowDrag() {
  if (!dragSession) return;
  clearInterval(dragSession.timer);
  dragSession = null;
  writeWindowState(mainWindow);
}

function startWindowDrag() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  stopWindowDrag();

  const cursor = screen.getCursorScreenPoint();
  const bounds = mainWindow.getBounds();
  dragSession = {
    cursor,
    bounds,
    timer: setInterval(() => {
      if (!mainWindow || mainWindow.isDestroyed() || !dragSession) {
        stopWindowDrag();
        return;
      }

      const nextCursor = screen.getCursorScreenPoint();
      mainWindow.setPosition(
        dragSession.bounds.x + nextCursor.x - dragSession.cursor.x,
        dragSession.bounds.y + nextCursor.y - dragSession.cursor.y
      );
    }, 16)
  };

  return true;
}

function resetWindowPosition() {
  if (!mainWindow) return;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { workArea } = display;
  const { width, height } = getWindowSizeForPetScale(currentState.petScale);
  const x = Math.round(workArea.x + workArea.width - width - 48);
  const y = Math.round(workArea.y + workArea.height - height - 64);
  mainWindow.setBounds({ x, y, width, height });
  writeWindowState(mainWindow);
}

function refreshTrayMenu() {
  if (!tray || !mainWindow) return;

  const petSubmenu = PET_OPTIONS.map((pet) => ({
    label: pet.label,
    type: "radio",
    checked: currentState.selectedPetId === pet.id,
    click: () => selectPet(pet.id)
  }));

  const menu = Menu.buildFromTemplate([
    { label: "Show Pet", click: () => showWindow() },
    { label: "Hide Pet", click: () => hideWindow() },
    { type: "separator" },
    { label: "Choose Pet", submenu: petSubmenu },
    {
      label: "Show Bubbles",
      type: "checkbox",
      checked: currentState.bubbleEnabled,
      click: (item) => setBubbleEnabled(item.checked)
    },
    {
      label: "Always On Top",
      type: "checkbox",
      checked: mainWindow.isAlwaysOnTop(),
      click: (item) => {
        mainWindow.setAlwaysOnTop(item.checked, "screen-saver");
        writeWindowState(mainWindow);
        sendShellSettings();
      }
    },
    {
      label: "Open At Login",
      type: "checkbox",
      checked: currentState.openAtLogin,
      click: (item) => applyLoginItemSetting(item.checked)
    },
    { label: "Reset Position", click: () => resetWindowPosition() },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(menu);
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("BOYNEXTDOOR Pets");
  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) hideWindow();
    else showWindow();
  });
  refreshTrayMenu();
}

function createMainWindow() {
  currentState = readWindowState();
  const initialSize = getWindowSizeForPetScale(currentState.petScale);

  const window = new BrowserWindow({
    x: currentState.x,
    y: currentState.y,
    width: initialSize.width,
    height: initialSize.height,
    minWidth: initialSize.width,
    minHeight: initialSize.height,
    maxWidth: initialSize.width,
    maxHeight: initialSize.height,
    transparent: true,
    frame: false,
    hasShadow: false,
    roundedCorners: false,
    resizable: false,
    backgroundColor: "#00000000",
    autoHideMenuBar: true,
    show: false,
    skipTaskbar: false,
    alwaysOnTop: currentState.alwaysOnTop,
    title: "BOYNEXTDOOR Pets",
    icon: getAppIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false
    }
  });

  window.setAlwaysOnTop(currentState.alwaysOnTop, "screen-saver");

  window.once("ready-to-show", () => {
    if (typeof currentState.x !== "number" || typeof currentState.y !== "number") {
      resetWindowPosition();
    }
    window.show();
    sendShellSettings();
    window.webContents.send("pet:selected", { petId: currentState.selectedPetId });
    window.webContents.send("shell:bubbles-enabled", currentState.bubbleEnabled);
  });

  window.on("close", (event) => {
    if (isQuitting) {
      writeWindowState(window);
      return;
    }

    event.preventDefault();
    hideWindow();
  });

  window.on("move", () => writeWindowState(window));
  window.on("blur", () => stopWindowDrag());
  window.on("show", () => sendShellSettings());

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  window.loadFile(path.join(__dirname, "index.html"));
  return window;
}

ipcMain.handle("shell:toggle-always-on-top", () => {
  if (!mainWindow) return { alwaysOnTop: false };
  const next = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(next, "screen-saver");
  writeWindowState(mainWindow);
  refreshTrayMenu();
  return { alwaysOnTop: next };
});

ipcMain.handle("shell:set-pet-scale", (_event, scale) => {
  setPetScale(scale);
  return { petScale: currentState.petScale };
});

ipcMain.handle("shell:start-window-drag", () => {
  return { ok: startWindowDrag() };
});

ipcMain.handle("shell:stop-window-drag", () => {
  stopWindowDrag();
  return { ok: true };
});

ipcMain.handle("shell:hide-window", () => {
  hideWindow();
  return { ok: true };
});

ipcMain.handle("shell:quit", () => {
  isQuitting = true;
  app.quit();
  return { ok: true };
});

ipcMain.handle("shell:get-settings", () => {
  return {
    alwaysOnTop: mainWindow ? mainWindow.isAlwaysOnTop() : true,
    openAtLogin: currentState.openAtLogin,
    bubbleEnabled: currentState.bubbleEnabled,
    selectedPetId: currentState.selectedPetId
  };
});

ipcMain.handle("shell:set-bubble-enabled", (_event, enabled) => {
  setBubbleEnabled(enabled);
  return { bubbleEnabled: currentState.bubbleEnabled };
});

ipcMain.handle("shell:select-pet", (_event, petId) => {
  selectPet(petId);
  return { selectedPetId: currentState.selectedPetId };
});

ipcMain.handle("shell:reset-position", () => {
  resetWindowPosition();
  return { ok: true };
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    showWindow();
  });

  app.whenReady().then(() => {
    mainWindow = createMainWindow();
    createTray();
    applyLoginItemSetting(readWindowState().openAtLogin);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      } else {
        showWindow();
      }
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
    if (mainWindow) writeWindowState(mainWindow);
  });

  app.on("window-all-closed", (event) => {
    event.preventDefault();
  });
}
