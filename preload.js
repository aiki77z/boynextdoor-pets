const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopPetShell", {
  toggleAlwaysOnTop: () => ipcRenderer.invoke("shell:toggle-always-on-top"),
  hideWindow: () => ipcRenderer.invoke("shell:hide-window"),
  quit: () => ipcRenderer.invoke("shell:quit"),
  getSettings: () => ipcRenderer.invoke("shell:get-settings"),
  setBubbleEnabled: (enabled) => ipcRenderer.invoke("shell:set-bubble-enabled", enabled),
  selectPet: (petId) => ipcRenderer.invoke("shell:select-pet", petId),
  resetPosition: () => ipcRenderer.invoke("shell:reset-position"),
  setPetScale: (scale) => ipcRenderer.invoke("shell:set-pet-scale", scale),
  setCompanionMode: (enabled) => ipcRenderer.invoke("shell:set-companion-mode", enabled),
  setBubbleEditorOpen: (open) => ipcRenderer.invoke("shell:set-bubble-editor-open", open),
  setChatPanelOpen: (open) => ipcRenderer.invoke("shell:set-chat-panel-open", open),
  setChatWindowOpen: (open) => ipcRenderer.invoke("shell:set-chat-window-open", open),
  startWindowDrag: () => ipcRenderer.invoke("shell:start-window-drag"),
  stopWindowDrag: () => ipcRenderer.invoke("shell:stop-window-drag"),
  getChatState: (petId) => ipcRenderer.invoke("shell:get-chat-state", petId),
  updateChatSettings: (payload) => ipcRenderer.invoke("shell:update-chat-settings", payload),
  clearChatMemory: (petId) => ipcRenderer.invoke("shell:clear-chat-memory", petId),
  sendPetChat: (payload) => ipcRenderer.invoke("shell:send-pet-chat", payload),
  onSettings: (callback) => ipcRenderer.on("shell:settings", (_event, payload) => callback(payload)),
  onPetSelected: (callback) => ipcRenderer.on("pet:selected", (_event, payload) => callback(payload)),
  onBubblesEnabled: (callback) => ipcRenderer.on("shell:bubbles-enabled", (_event, payload) => callback(payload))
});
