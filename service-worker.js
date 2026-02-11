const MENU_ID = "inspect-ax";
const STORAGE_PREFIX = "lastContextTarget:";
const TARGET_TTL_MS = 15_000;
const MAX_SELECTOR_LENGTH = 2_048;
const MAX_XPATH_LENGTH = 2_048;
const MAX_TAG_LENGTH = 64;

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Inspect AX",
    contexts: ["all"],
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "record-context-target") {
    void (async () => {
      try {
        const tabId = sender.tab?.id;
        if (tabId === undefined) {
          sendResponse({ ok: false, error: "No tab context available." });
          return;
        }

        const sanitized = sanitizeTargetPayload(message.payload);
        if (!sanitized.selector && !sanitized.xpath) {
          sendResponse({ ok: false, error: "No valid selector or XPath captured." });
          return;
        }

        const value = {
          ...sanitized,
          frameId: sender.frameId ?? 0,
          recordedAt: Date.now(),
        };

        await chrome.storage.session.set({
          [`${STORAGE_PREFIX}${tabId}`]: value,
        });

        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: toErrorMessage(error) });
      }
    })();

    return true;
  }

  return false;
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || tab?.id === undefined) {
    return;
  }

  const tabId = tab.id;

  try {
    const target = await getLastRecordedTarget(tabId);
    if (!target) {
      throw new Error(
        "No right-click target was captured for this tab. Right-click an element first."
      );
    }

    if (Date.now() - Number(target.recordedAt || 0) > TARGET_TTL_MS) {
      throw new Error("Captured target is stale. Right-click the element again.");
    }

    await sendPopupMessage(tabId, target.frameId ?? info.frameId ?? 0, {
      type: "inspect-target-in-page",
      payload: target,
    });
  } catch (error) {
    try {
      await sendPopupMessage(tabId, 0, {
        type: "show-ax-popup",
        payload: {
          ok: false,
          error: toErrorMessage(error),
        },
      });
    } catch (_popupError) {
      // Ignore if the tab cannot receive extension messages.
    }
  } finally {
    await clearLastRecordedTarget(tabId);
  }
});

async function getLastRecordedTarget(tabId) {
  const key = `${STORAGE_PREFIX}${tabId}`;
  const data = await chrome.storage.session.get(key);
  return data[key] ?? null;
}

async function clearLastRecordedTarget(tabId) {
  const key = `${STORAGE_PREFIX}${tabId}`;
  await chrome.storage.session.remove(key);
}

function sanitizeTargetPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  return {
    selector: sanitizeString(source.selector, MAX_SELECTOR_LENGTH),
    xpath: sanitizeString(source.xpath, MAX_XPATH_LENGTH),
    tagName: sanitizeString(source.tagName, MAX_TAG_LENGTH),
    pointer: {
      x: sanitizeNumber(source.pointer?.x),
      y: sanitizeNumber(source.pointer?.y),
    },
  };
}

function sanitizeString(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, maxLength);
}

function sanitizeNumber(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value);
}

async function sendPopupMessage(tabId, frameId, message) {
  try {
    if (Number.isInteger(frameId)) {
      await chrome.tabs.sendMessage(tabId, message, { frameId });
      return;
    }
  } catch (_error) {
    // Fall through to top frame.
  }

  await chrome.tabs.sendMessage(tabId, message);
}

function toErrorMessage(error) {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error.message === "string") {
    return error.message;
  }
  return "Unknown error";
}
