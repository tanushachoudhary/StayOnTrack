// --- Keys in storage ---
const KEY_SETTINGS = "settings"; // {focusMinutes, breakMinutes}
const KEY_BLOCKLIST = "blocklist"; // array of domains e.g. ["youtube.com","instagram.com"]
const KEY_STATE = "state"; // {phase, endTime, paused, pomodorosCompleted, activeRuleIds}

const RULE_BASE_ID = 1000;

// Default values
const defaultSettings = { focusMinutes: 25, breakMinutes: 5 };
const defaultState = {
  phase: "idle", // 'idle' | 'focus' | 'break' | 'paused'
  endTime: null, // timestamp (ms)
  paused: false,
  remainingMs: null,
  pomodorosCompleted: 0,
  activeRuleIds: [],
};
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get([
    KEY_SETTINGS,
    KEY_BLOCKLIST,
    KEY_STATE,
  ]);
  if (!data[KEY_SETTINGS])
    await chrome.storage.sync.set({ [KEY_SETTINGS]: defaultSettings });
  if (!data[KEY_BLOCKLIST])
    await chrome.storage.sync.set({ [KEY_BLOCKLIST]: [] });
  if (!data[KEY_STATE])
    await chrome.storage.local.set({ [KEY_STATE]: defaultState });
});

// --- Helper: read/write state/settings ---
async function getSettings() {
  const { [KEY_SETTINGS]: s } = await chrome.storage.sync.get(KEY_SETTINGS);
  return { ...defaultSettings, ...(s || {}) };
}
async function setSettings(settings) {
  await chrome.storage.sync.set({ [KEY_SETTINGS]: settings });
}
async function getBlocklist() {
  const { [KEY_BLOCKLIST]: b } = await chrome.storage.sync.get(KEY_BLOCKLIST);
  return b || [];
}
async function setBlocklist(blocklist) {
  await chrome.storage.sync.set({ [KEY_BLOCKLIST]: blocklist });
}
async function getState() {
  const { [KEY_STATE]: st } = await chrome.storage.local.get(KEY_STATE);
  return { ...defaultState, ...(st || {}) };
}
async function setState(patch) {
  const cur = await getState();
  const next = { ...cur, ...patch };
  await chrome.storage.local.set({ [KEY_STATE]: next });
  // notify UIs
  chrome.runtime
    .sendMessage({ type: "state:update", state: next })
    .catch(() => {});
  return next;
}

// --- DNR: apply / clear rules ---
async function applyBlockRules(domains) {
  const ids = domains.map((_, i) => RULE_BASE_ID + i);
  const addRules = domains.map((domain, i) => ({
    id: RULE_BASE_ID + i,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { extensionPath: "/blocked.html" },
    },
    condition: {
      urlFilter: `||${domain}`,
      resourceTypes: [
        "main_frame",
        "sub_frame",
        "xmlhttprequest",
        "script",
        "image",
        "font",
        "media",
        "other",
      ],
    },
  }));

  // Remove any existing rules in our ID range before adding
  const curState = await getState();
  const toRemove = curState.activeRuleIds || [];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: toRemove,
    addRules,
  });

  await setState({ activeRuleIds: ids });
}

async function clearBlockRules() {
  const { activeRuleIds } = await getState();
  if ((activeRuleIds || []).length) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: activeRuleIds,
      addRules: [],
    });
    await setState({ activeRuleIds: [] });
  }
}

// --- Timer control ---
async function startFocus() {
  const { focusMinutes } = await getSettings();
  const endTime = Date.now() + focusMinutes * 60 * 1000;
  const blocklist = await getBlocklist();
  await applyBlockRules(blocklist);
  await setState({ phase: "focus", endTime, paused: false, remainingMs: null });
  await scheduleEndAlarm(endTime);
  notify("Focus started", `Stay on task for ${focusMinutes} minutes!`);
}

async function startBreak() {
  const { breakMinutes } = await getSettings();
  const endTime = Date.now() + breakMinutes * 60 * 1000;
  await clearBlockRules();
  const st = await getState();
  // Count a pomodoro completed when transitioning from focus -> break
  const add = st.phase === "focus" ? 1 : 0;
  await setState({
    phase: "break",
    endTime,
    paused: false,
    remainingMs: null,
    pomodorosCompleted: st.pomodorosCompleted + add,
  });
  await scheduleEndAlarm(endTime);
  notify("Break time", `Relax for ${breakMinutes} minutes.`);
}

async function resetTimer() {
  await clearBlockRules();
  await clearEndAlarm();
  await setState({ ...defaultState });
}

async function pauseTimer() {
  const st = await getState();
  if (st.phase === "focus" || st.phase === "break") {
    const remainingMs = Math.max(0, (st.endTime || 0) - Date.now());
    await clearEndAlarm();
    await setState({
      paused: true,
      phase: "paused",
      remainingMs,
      endTime: null,
    });
    await clearBlockRules(); // unblock while paused
  }
}

async function resumeTimer() {
  const st = await getState();
  if (st.phase === "paused" && st.remainingMs != null) {
    const endTime = Date.now() + st.remainingMs;
    await setState({ endTime, paused: false });
    // Re-apply rules only if we paused from focus
    // We can't know previous phase for sure; heuristic: if rules empty -> assume focus
    const toReblock = (st.activeRuleIds || []).length === 0;
    if (toReblock) {
      const blocklist = await getBlocklist();
      await applyBlockRules(blocklist);
    }
    await scheduleEndAlarm(endTime);
  }
}

async function switchPhase() {
  const st = await getState();
  if (st.phase === "focus") return startBreak();
  return startFocus();
}

// --- Alarms ---
const ALARM_NAME = "phaseEnd";
async function scheduleEndAlarm(endTimeMs) {
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, { when: endTimeMs });
}
async function clearEndAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
}
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const st = await getState();
  if (!st.endTime || Date.now() < st.endTime - 500) return;
  if (st.phase === "focus") {
    notify("Focus complete", "Great job! Time for a break.");
    await startBreak();
  } else if (st.phase === "break") {
    notify("Break over", "Ready for the next focus session?");
    await startFocus();
  }
});

// --- Notifications ---
function notify(title, message) {
  chrome.notifications.create(
    {
      type: "basic",
      iconUrl: "icons/16.png",
      title,
      message,
    },
    () => {}
  );
}

// --- Messages from popup/options ---
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case "state:get":
        sendResponse(await getState());
        break;
      case "timer:startFocus":
        await startFocus();
        sendResponse(true);
        break;
      case "timer:startBreak":
        await startBreak();
        sendResponse(true);
        break;
      case "timer:pause":
        await pauseTimer();
        sendResponse(true);
        break;
      case "timer:resume":
        await resumeTimer();
        sendResponse(true);
        break;
      case "timer:reset":
        await resetTimer();
        sendResponse(true);
        break;
      case "timer:switch":
        await switchPhase();
        sendResponse(true);
        break;
      case "settings:get":
        sendResponse(await getSettings());
        break;
      case "settings:set":
        await setSettings(msg.settings);
        sendResponse(true);
        break;
      case "blocklist:get":
        sendResponse(await getBlocklist());
        break;
      case "blocklist:set":
        await setBlocklist(msg.blocklist);
        // If we are in focus, update rules immediately
        const st = await getState();
        if (st.phase === "focus") await applyBlockRules(msg.blocklist || []);
        sendResponse(true);
        break;
      default:
        sendResponse(false);
    }
  })();
  return true; // keep channel open for async
});
