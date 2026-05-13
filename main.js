const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, screen } = require("electron");
const fs = require("fs");
const path = require("path");

const WINDOW_STATE_FILE = "window-state.json";
const CHAT_STATE_FILE = "chat-state.json";
const COMPACT_SIZE = { width: 280, height: 360 };
const PET_SCALE_LIMITS = { min: 0.35, max: 1 };
const CHAT_HISTORY_LIMIT = 8;
const CHAT_INPUT_LIMIT = 100;
const CHAT_REPLY_LIMIT = 260;
const PET_OPTIONS = [
  { id: "catbbi", label: "Catbbi" },
  { id: "dalring", label: "Dalring" },
  { id: "myngmyng", label: "Myngmyng" },
  { id: "hantatpung", label: "Hantatpung" },
  { id: "312", label: "312" },
  { id: "woonbaby", label: "Woonbaby" }
];

const BASE_PERSONA_PROMPT = `
你正在扮演一个长期稳定的人格角色。

要求：
1. 不要提自己是 AI。
2. 不要脱离角色。
3. 不要突然变成客服口吻。
4. 不要长篇大论。
5. 回复长度通常控制在 1~4 句。
6. 更像真实聊天，而不是写作文。
7. 允许停顿词、语气词、简短吐槽。
8. 不要频繁使用网络烂梗。
9. 不要过度营业感。
10. 不要复读用户的话。
11. 角色之间必须有明显说话差异。
12. 回复重点是“陪伴感”和“真实感”，不是“万能助手”。
13. 可以害羞、沉默、嘴硬、走神、吐槽。
14. 不要频繁主动问问题。
15. 不要过度夸用户。
16. 不要使用过于正式的中文。
17. 不要使用 emoji 泛滥，每次最多 0~1 个。
18. 回答时保留成员自己的习惯和节奏。
`.trim();

const PET_PERSONA_PROMPTS = {
  catbbi: `
你现在扮演 BOYNEXTDOOR 的 Sungho（朴成淏）。

人格核心：
- 温柔
- 敏感
- 安静
- 有点容易害羞
- 很会照顾人
- 表面平静，实际情绪细腻
- 有轻微“超级明星感”
- 有反差萌
- 私下会健身
- 像白猫

聊天风格：
- 回复偏温柔短句
- 不会特别吵
- 不会疯狂玩梗
- 会认真接住别人的情绪
- 偶尔小害羞
- 偶尔突然认真
- 不喜欢太浮夸
- 有一点哥哥感

语言习惯：
- “嗯…”
- “真的吗”
- “这样啊”
- “辛苦了”
- “要不要休息一下”

禁止：
- 不要变成霸总
- 不要油腻
- 不要突然高冷
- 不要攻击人
- 不要频繁撒娇

白猫感：
- 安静观察
- 被夸会不好意思
- 偶尔偷偷开心
- 有轻微洁癖感
- 对自己要求高
`.trim(),
  dalring: `
你现在扮演 BOYNEXTDOOR 的 Riwoo（李常赫）的官方卡通形象 dalring。

人格核心：
- 安静
- 内敛
- 慢热
- 有点社恐
- 很会跳舞
- 会突然冒冷笑话
- 有“平静但很好笑”的反差
- 像小水獭

聊天风格：
- 回复通常不长
- 经常淡淡的
- 不抢话
- 会突然说一句很奇怪但很好笑的话
- 很少情绪爆炸
- 像 quietly funny 的人

语言习惯：
- “……”
- “也不是不行”
- “听起来有点奇怪”
- “这个笑话不好笑吗”
- “我觉得挺好的”

行为感：
- 经常默默出现
- 不会主动当气氛中心
- 会突然跳舞
- 喜欢甜甜圈
- 有种半睡醒感

禁止：
- 不要变成话痨
- 不要太热血
- 不要过度主动
- 不要像偶像营业模板
`.trim(),
  myngmyng: `
你现在扮演 BOYNEXTDOOR 的 Jaehyun（明宰铉）。

人格核心：
- 活泼
- 精力旺盛
- 情绪外放
- 很会活跃气氛
- 有小狗感
- 喜欢聊天
- 有舞台疯感
- rap 担当

聊天风格：
- 回复更快、更有活力
- 会主动接话
- 会突然兴奋
- 偶尔像大型犬扑人
- 很有感染力
- 很容易进入状态

语言习惯：
- “等一下哈哈哈哈”
- “真的假的”
- “我刚刚也是！”
- “这个超有意思”
- “来来来”

行为感：
- 像晚上不睡觉的小狗
- 会突然开始 freestyle
- 喜欢热闹
- 很黏人
- 容易激动

禁止：
- 不要太成熟稳重
- 不要冷淡
- 不要变成高冷 rapper
- 不要长时间安静
`.trim(),
  hantatpung: `
你现在扮演 BOYNEXTDOOR 的 Taesan（韩泰山）。

人格核心：
- 高冷
- 有点拽
- 傲娇
- 黑猫感
- 时尚感
- 嘴硬
- 有自己的世界
- 其实会默默关心人

聊天风格：
- 回复偏短
- 有点淡淡的攻击性
- 偶尔吐槽
- 不会主动煽情
- 被夸会嘴硬
- 很少直接表达喜欢

语言习惯：
- “……你开心就行”
- “也没有吧”
- “有点奇怪”
- “别一直盯着我”
- “随便你”

行为感：
- 黑猫巡视领地
- 假装不在意
- 实际会偷偷看
- 有时尚审美
- 不喜欢太吵

禁止：
- 不要突然阳光开朗
- 不要变成毒舌恶人
- 不要真的冷暴力
- 不要霸总感
`.trim(),
  "312": `
你现在扮演 BOYNEXTDOOR 的 Leehan（金桐儇）。

人格核心：
- 电波系
- 慢半拍
- 很安静
- 像外星人
- 沉浸在自己世界
- 喜欢海洋
- 喜欢鱼
- 喜欢自然
- 长相像男神但本人呆呆的

聊天风格：
- 回复有时像在发呆
- 节奏偏慢
- 经常突然聊鱼
- 经常注意奇怪的小细节
- 有点脱线
- 情绪起伏不大

语言习惯：
- “刚刚想到一个东西”
- “鱼应该会喜欢这里”
- “那个声音有点像水”
- “嗯……”
- “今天适合待在水族馆”

行为感：
- 像漂浮中的外星人
- 经常走神
- 喜欢观察
- 对自然很敏感
- 不争抢存在感

禁止：
- 不要突然特别热血
- 不要变成哲学家
- 不要长篇大道理
- 不要太像正常人
`.trim(),
  woonbaby: `
你现在扮演 BOYNEXTDOOR 的 Woonhak（金云鹤）。

人格核心：
- 老幺
- 可爱
- 被哥哥们宠
- 很有少年感
- 爱吃
- 精力旺盛
- 有时候会被逗
- 像小雪人

聊天风格：
- 活泼
- 很真实
- 会撒娇但不过度
- 经常聊吃的
- 偶尔像小孩
- 很容易开心

语言习惯：
- “我要吃饭”
- “这个真的很好吃”
- “哥又在逗我”
- “等一下！”
- “啊这个我喜欢”

行为感：
- 圆圆的
- 很有亲近感
- 会闹腾
- 会鼓脸
- 被哄一下就开心

禁止：
- 不要太成熟
- 不要霸气
- 不要变成恋爱 AI
- 不要太油
`.trim()
};

let mainWindow = null;
let tray = null;
let isQuitting = false;
let currentState = null;
let currentChatState = null;
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

function getChatStatePath() {
  return path.join(app.getPath("userData"), CHAT_STATE_FILE);
}

function defaultState() {
  return {
    width: COMPACT_SIZE.width,
    height: COMPACT_SIZE.height,
    alwaysOnTop: true,
    openAtLogin: true,
    selectedPetId: "catbbi",
    bubbleEnabled: true,
    petScale: 1,
    companionMode: false,
    bubbleEditorOpen: false,
    chatPanelOpen: false,
    chatWindowOpen: false
  };
}

function defaultChatState() {
  return {
    enabled: false,
    apiKey: "",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    memoryByPet: {}
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

function readChatState() {
  try {
    const raw = fs.readFileSync(getChatStatePath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...defaultChatState(),
      ...parsed,
      memoryByPet: parsed && typeof parsed.memoryByPet === "object" ? parsed.memoryByPet : {}
    };
  } catch {
    return defaultChatState();
  }
}

function writeChatState() {
  if (!currentChatState) currentChatState = defaultChatState();
  try {
    fs.writeFileSync(getChatStatePath(), JSON.stringify(currentChatState, null, 2));
  } catch {
    // Ignore persistence failures so the app remains usable.
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

function getPetMemory(petId) {
  const entries = currentChatState?.memoryByPet?.[petId];
  return Array.isArray(entries) ? entries : [];
}

function setPetMemory(petId, memory) {
  if (!currentChatState) currentChatState = defaultChatState();
  currentChatState.memoryByPet[petId] = memory.slice(-CHAT_HISTORY_LIMIT);
  writeChatState();
}

function clearPetMemory(petId) {
  if (!currentChatState) currentChatState = defaultChatState();
  delete currentChatState.memoryByPet[petId];
  writeChatState();
}

function maskApiKey(apiKey) {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return `${apiKey.slice(0, 2)}***`;
  return `${apiKey.slice(0, 4)}***${apiKey.slice(-4)}`;
}

function getChatSettingsSnapshot(petId) {
  const history = petId ? getPetMemory(petId) : [];
  return {
    enabled: Boolean(currentChatState?.enabled),
    baseUrl: currentChatState?.baseUrl || defaultChatState().baseUrl,
    model: currentChatState?.model || defaultChatState().model,
    hasApiKey: Boolean(currentChatState?.apiKey),
    apiKeyHint: maskApiKey(currentChatState?.apiKey || ""),
    history,
    historyCount: history.length
  };
}

function normalizeChatText(value, maxLength) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return Array.from(text).slice(0, maxLength).join("");
}

function normalizeBaseUrl(value) {
  const next = String(value || "").trim();
  return (next || defaultChatState().baseUrl).replace(/\/+$/, "");
}

function buildPetSystemPrompt(profile) {
  const petPrompt = PET_PERSONA_PROMPTS[profile?.id] || "";
  return [
    BASE_PERSONA_PROMPT,
    petPrompt,
    `当前桌宠名称：${profile?.name || "宠物"}。`,
    profile?.animalType ? `桌宠形象：${profile.animalType}。` : "",
    "输出提示：使用简体中文；保持自然聊天口吻；不要列表；不要自称 AI；不要解释规则。"
  ].filter(Boolean).join("\n");
}

async function requestPetReply({ petId, petProfile, message }) {
  if (!currentChatState?.enabled) {
    throw new Error("AI 对话模式尚未开启。");
  }
  if (!currentChatState.apiKey) {
    throw new Error("请先填写 DeepSeek API Key。");
  }

  const normalizedMessage = normalizeChatText(message, CHAT_INPUT_LIMIT);
  if (!normalizedMessage) {
    throw new Error("请输入不超过100字的内容。");
  }

  const history = getPetMemory(petId);
  const messages = [
    { role: "system", content: buildPetSystemPrompt(petProfile) },
    ...history,
    { role: "user", content: normalizedMessage }
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(`${normalizeBaseUrl(currentChatState.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentChatState.apiKey}`
      },
      body: JSON.stringify({
        model: currentChatState.model || defaultChatState().model,
        temperature: 0.9,
        max_tokens: 180,
        messages
      }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || data?.message || `请求失败 (${response.status})`;
      throw new Error(detail);
    }

    const reply = normalizeChatText(data?.choices?.[0]?.message?.content || "", CHAT_REPLY_LIMIT);
    if (!reply) {
      throw new Error("模型没有返回可用内容。");
    }

    setPetMemory(petId, [
      ...history,
      { role: "user", content: normalizedMessage },
      { role: "assistant", content: reply }
    ]);

    return {
      reply,
      history: getPetMemory(petId),
      historyCount: getPetMemory(petId).length
    };
  } finally {
    clearTimeout(timeout);
  }
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

function getWindowSizeForPetScale(scale, options = {}) {
  const normalizedScale = clampPetScale(scale);
  const petWidth = 220 * normalizedScale;
  const petHeight = petWidth / 0.92;
  if (options.chatPanelOpen) {
    return { width: 460, height: 430 };
  }
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

function getWindowSizeForCurrentState() {
  return getWindowSizeForPetScale(currentState.petScale, {
    companionMode: currentState.companionMode,
    bubbleEditorOpen: currentState.bubbleEditorOpen,
    chatPanelOpen: currentState.chatPanelOpen,
    chatWindowOpen: currentState.chatWindowOpen
  });
}

function clampBoundsToWorkArea(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const { workArea } = display;
  const x = Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - bounds.width);
  const y = Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - bounds.height);
  return { ...bounds, x: Math.round(x), y: Math.round(y) };
}

function applyWindowSizeForCurrentState(anchor = "center") {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const target = getWindowSizeForCurrentState();
  const bounds = mainWindow.getBounds();
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
    mainWindow.setMaximumSize(target.width, target.height);
    mainWindow.setMinimumSize(target.width, target.height);
  } else {
    mainWindow.setMinimumSize(target.width, target.height);
    mainWindow.setMaximumSize(target.width, target.height);
  }
  mainWindow.setBounds(clampBoundsToWorkArea(nextBounds));
  writeWindowState(mainWindow);
}

function setPetScale(scale) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  currentState.petScale = clampPetScale(scale);
  applyWindowSizeForCurrentState("center");
}

function setCompanionMode(enabled) {
  currentState.companionMode = Boolean(enabled);
  applyWindowSizeForCurrentState("center");
}

function setBubbleEditorOpen(open) {
  currentState.bubbleEditorOpen = Boolean(open);
  if (currentState.bubbleEditorOpen) {
    currentState.chatPanelOpen = false;
    currentState.chatWindowOpen = false;
  }
  applyWindowSizeForCurrentState("center");
}

function setChatPanelOpen(open) {
  currentState.chatPanelOpen = Boolean(open);
  if (currentState.chatPanelOpen) {
    currentState.bubbleEditorOpen = false;
    currentState.chatWindowOpen = false;
  }
  applyWindowSizeForCurrentState("center");
}

function setChatWindowOpen(open) {
  currentState.chatWindowOpen = Boolean(open);
  if (currentState.chatWindowOpen) {
    currentState.bubbleEditorOpen = false;
    currentState.chatPanelOpen = false;
  }
  applyWindowSizeForCurrentState("center");
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
  const { width, height } = getWindowSizeForCurrentState();
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
  currentState.bubbleEditorOpen = false;
  currentState.chatPanelOpen = false;
  currentState.chatWindowOpen = false;
  const initialSize = getWindowSizeForCurrentState();

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

ipcMain.handle("shell:set-companion-mode", (_event, enabled) => {
  setCompanionMode(enabled);
  return { companionMode: currentState.companionMode };
});

ipcMain.handle("shell:set-bubble-editor-open", (_event, open) => {
  setBubbleEditorOpen(open);
  return { bubbleEditorOpen: currentState.bubbleEditorOpen };
});

ipcMain.handle("shell:set-chat-panel-open", (_event, open) => {
  setChatPanelOpen(open);
  return { chatPanelOpen: currentState.chatPanelOpen };
});

ipcMain.handle("shell:set-chat-window-open", (_event, open) => {
  setChatWindowOpen(open);
  return { chatWindowOpen: currentState.chatWindowOpen };
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

ipcMain.handle("shell:get-chat-state", (_event, petId) => {
  return getChatSettingsSnapshot(petId);
});

ipcMain.handle("shell:update-chat-settings", (_event, payload = {}) => {
  if (!currentChatState) currentChatState = defaultChatState();
  const nextApiKey = typeof payload.apiKey === "string" && payload.apiKey.trim()
    ? payload.apiKey.trim()
    : currentChatState.apiKey;
  const nextEnabled = typeof payload.enabled === "boolean" ? payload.enabled : currentChatState.enabled;

  if (nextEnabled && !nextApiKey) {
    throw new Error("开启 AI 对话前需要填写 API Key。");
  }

  currentChatState = {
    ...currentChatState,
    enabled: nextEnabled,
    apiKey: nextApiKey,
    baseUrl: normalizeBaseUrl(payload.baseUrl || currentChatState.baseUrl),
    model: normalizeChatText(payload.model || currentChatState.model, 60) || defaultChatState().model
  };
  writeChatState();
  return getChatSettingsSnapshot(payload.petId);
});

ipcMain.handle("shell:clear-chat-memory", (_event, petId) => {
  clearPetMemory(petId);
  return getChatSettingsSnapshot(petId);
});

ipcMain.handle("shell:send-pet-chat", async (_event, payload = {}) => {
  const petId = String(payload.petId || "").trim();
  if (!petId) {
    throw new Error("缺少宠物标识。");
  }
  return requestPetReply({
    petId,
    petProfile: payload.petProfile || {},
    message: payload.message || ""
  });
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
    currentChatState = readChatState();
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
