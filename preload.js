const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPetShell", {
  toggleAlwaysOnTop: () => ipcRenderer.invoke("shell:toggle-always-on-top"),
  hideWindow: () => ipcRenderer.invoke("shell:hide-window"),
  closeCurrentPet: () => ipcRenderer.invoke("shell:close-current-pet"),
  quit: () => ipcRenderer.invoke("shell:quit"),
  getSettings: () => ipcRenderer.invoke("shell:get-settings"),
  setBubbleEnabled: (enabled) => ipcRenderer.invoke("shell:set-bubble-enabled", enabled),
  resetPosition: () => ipcRenderer.invoke("shell:reset-position"),
  setPetScale: (scale) => ipcRenderer.invoke("shell:set-pet-scale", scale),
  setCompanionMode: (enabled) => ipcRenderer.invoke("shell:set-companion-mode", enabled),
  setBubbleEditorOpen: (open) => ipcRenderer.invoke("shell:set-bubble-editor-open", open),
  setPetInputTransparent: (transparent) => ipcRenderer.invoke("shell:set-pet-input-transparent", transparent),
  startWindowDrag: () => ipcRenderer.invoke("shell:start-window-drag"),
  stopWindowDrag: () => ipcRenderer.invoke("shell:stop-window-drag"),
  onSettings: (callback) => ipcRenderer.on("shell:settings", (_event, payload) => callback(payload)),
  onBubblesEnabled: (callback) => ipcRenderer.on("shell:bubbles-enabled", (_event, payload) => callback(payload))
});
