(function initContextCapture() {
  document.addEventListener(
    "contextmenu",
    (event) => {
      const target =
        event.target instanceof Element
          ? event.target
          : event.target?.parentElement || null;

      if (!target) {
        return;
      }

      const payload = {
        selector: createUniqueSelector(target),
        xpath: createXPath(target),
        tagName: target.tagName.toLowerCase(),
        pointer: {
          x: Number(event.clientX),
          y: Number(event.clientY),
        },
      };

      try {
        chrome.runtime.sendMessage(
          { type: "record-context-target", payload },
          () => {
            void chrome.runtime.lastError;
          }
        );
      } catch (_error) {
        // Ignore; extension context may be unavailable.
      }
    },
    true
  );
})();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }

  if (message.type === "inspect-target-in-page") {
    const result = inspectTargetInPage(message.payload || {});
    renderPopup(result);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "show-ax-popup") {
    renderPopup(message.payload || {});
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

let clearPopupDismissHandlers = null;
const SEMANTIC_ANCESTOR_SELECTOR =
  'a[href], button, input, select, textarea, summary, [role]:not([role="generic"]):not([role="none"]):not([role="presentation"]), [contenteditable]:not([contenteditable="false"])';
const MAX_SEMANTIC_ANCESTOR_STEPS = 5;

function inspectTargetInPage(targetDescriptor) {
  const element = resolveTargetElement(targetDescriptor);
  if (!element) {
    return {
      ok: false,
      pointer: targetDescriptor.pointer || null,
      error: "Could not resolve the selected element. Try right-clicking it again.",
    };
  }

  const snapshot = computeSnapshotWithSemanticFallback(element);
  return {
    ok: true,
    pointer: targetDescriptor.pointer || null,
    role: snapshot.role || "-",
    name: snapshot.name || "-",
  };
}

function resolveTargetElement(targetDescriptor) {
  const selector = targetDescriptor?.selector || "";
  const xpath = targetDescriptor?.xpath || "";
  const pointer = targetDescriptor?.pointer || null;

  if (selector) {
    try {
      const node = document.querySelector(selector);
      if (node) {
        return node;
      }
    } catch (_error) {
      // Ignore selector parse errors and try other fallbacks.
    }
  }

  if (xpath) {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      if (result.singleNodeValue instanceof Element) {
        return result.singleNodeValue;
      }
    } catch (_error) {
      // Ignore XPath parse errors and try pointer fallback.
    }
  }

  if (
    pointer &&
    Number.isFinite(pointer.x) &&
    Number.isFinite(pointer.y) &&
    typeof document.elementFromPoint === "function"
  ) {
    const node = document.elementFromPoint(pointer.x, pointer.y);
    if (node instanceof Element) {
      return node;
    }
  }

  return null;
}

function computeAccessibilitySnapshot(element) {
  const nativeSnapshot = getNativeAccessibilitySnapshot(element);
  const inferredRole = inferRole(element);
  const role = pickPreferredRole(nativeSnapshot.role, inferredRole);
  const name = nativeSnapshot.name || inferName(element);
  return { role, name };
}

function computeSnapshotWithSemanticFallback(element) {
  const snapshot = computeAccessibilitySnapshot(element);
  if (!isGenericRole(snapshot.role)) {
    return snapshot;
  }

  const ancestor = findSemanticAncestor(element, MAX_SEMANTIC_ANCESTOR_STEPS);
  if (!ancestor) {
    return snapshot;
  }

  const fallbackSnapshot = computeAccessibilitySnapshot(ancestor);
  return shouldPreferFallbackSnapshot(snapshot, fallbackSnapshot)
    ? fallbackSnapshot
    : snapshot;
}

function pickPreferredRole(nativeRole, inferredRole) {
  if (isGenericRole(nativeRole) && !isGenericRole(inferredRole)) {
    return inferredRole;
  }

  return nativeRole || inferredRole;
}

function findSemanticAncestor(element, maxSteps) {
  let current = element.parentElement;
  let steps = 0;

  while (current && steps < maxSteps) {
    if (isSemanticFallbackCandidate(current)) {
      return current;
    }

    if (current === document.body || current === document.documentElement) {
      break;
    }

    current = current.parentElement;
    steps += 1;
  }

  return null;
}

function isSemanticFallbackCandidate(element) {
  if (!(element instanceof Element) || typeof element.matches !== "function") {
    return false;
  }

  try {
    return element.matches(SEMANTIC_ANCESTOR_SELECTOR);
  } catch (_error) {
    return false;
  }
}

function shouldPreferFallbackSnapshot(snapshot, fallbackSnapshot) {
  const currentGeneric = isGenericRole(snapshot.role);
  const fallbackGeneric = isGenericRole(fallbackSnapshot.role);

  if (currentGeneric && !fallbackGeneric) {
    return true;
  }

  if (currentGeneric === fallbackGeneric) {
    return !hasReadableValue(snapshot.name) && hasReadableValue(fallbackSnapshot.name);
  }

  return false;
}

function isGenericRole(role) {
  const normalized = readString(role).toLowerCase();
  return !normalized || normalized === "generic";
}

function hasReadableValue(value) {
  const text = readString(value);
  return Boolean(text && text !== "-");
}

function getNativeAccessibilitySnapshot(element) {
  if (typeof window.getComputedAccessibleNode !== "function") {
    return { role: "", name: "" };
  }

  try {
    const node = window.getComputedAccessibleNode(element);
    if (!node) {
      return { role: "", name: "" };
    }

    return {
      role: readString(node.role || node.computedRole),
      name: readString(node.name || node.computedName),
    };
  } catch (_error) {
    return { role: "", name: "" };
  }
}

function inferRole(element) {
  const explicitRole = readString(element.getAttribute("role"));
  if (explicitRole) {
    return explicitRole;
  }

  const tagName = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tagName)) {
    return "heading";
  }
  if (tagName === "a" && element.hasAttribute("href")) {
    return "link";
  }
  if (tagName === "button") {
    return "button";
  }
  if (tagName === "textarea") {
    return "textbox";
  }
  if (tagName === "select") {
    return element.multiple ? "listbox" : "combobox";
  }
  if (tagName === "img") {
    return "img";
  }
  if (tagName === "ul" || tagName === "ol") {
    return "list";
  }
  if (tagName === "li") {
    return "listitem";
  }
  if (tagName === "main") {
    return "main";
  }
  if (tagName === "nav") {
    return "navigation";
  }
  if (tagName === "input") {
    return inferInputRole(element);
  }

  return "generic";
}

function inferInputRole(inputElement) {
  const type = (inputElement.getAttribute("type") || "text").toLowerCase();

  if (type === "button" || type === "submit" || type === "reset") {
    return "button";
  }
  if (type === "checkbox") {
    return "checkbox";
  }
  if (type === "radio") {
    return "radio";
  }
  if (type === "range") {
    return "slider";
  }
  if (type === "number") {
    return "spinbutton";
  }
  return "textbox";
}

function inferName(element) {
  const ariaLabel = readString(element.getAttribute("aria-label"));
  if (ariaLabel) {
    return ariaLabel;
  }

  const labelledBy = readString(element.getAttribute("aria-labelledby"));
  if (labelledBy) {
    const labelText = labelledBy
      .split(/\s+/)
      .map((id) => {
        const node = document.getElementById(id);
        return node ? normalizeText(node.textContent || "", 200) : "";
      })
      .filter(Boolean)
      .join(" ");
    if (labelText) {
      return labelText;
    }
  }

  const alt = readString(element.getAttribute("alt"));
  if (alt) {
    return alt;
  }

  const associatedLabel = getAssociatedLabelText(element);
  if (associatedLabel) {
    return associatedLabel;
  }

  const placeholder = readString(element.getAttribute("placeholder"));
  if (placeholder) {
    return placeholder;
  }

  const title = readString(element.getAttribute("title"));
  if (title) {
    return title;
  }

  return normalizeText(element.innerText || element.textContent || "", 200);
}

function getAssociatedLabelText(element) {
  if ("labels" in element && element.labels && element.labels.length > 0) {
    const labelText = Array.from(element.labels)
      .map((label) => normalizeText(label.textContent || "", 200))
      .filter(Boolean)
      .join(" ");
    if (labelText) {
      return labelText;
    }
  }

  const elementId = readString(element.getAttribute("id"));
  if (elementId) {
    const forLabel = document.querySelector(`label[for="${cssEscape(elementId)}"]`);
    if (forLabel) {
      const text = normalizeText(forLabel.textContent || "", 200);
      if (text) {
        return text;
      }
    }
  }

  const wrappedLabel = element.closest("label");
  if (wrappedLabel) {
    const text = normalizeText(wrappedLabel.textContent || "", 200);
    if (text) {
      return text;
    }
  }

  return "";
}

function renderPopup(payload) {
  ensurePopupStyle();
  removeExistingPopup();

  const popup = document.createElement("section");
  popup.id = "inspect-ax-popup";
  popup.setAttribute("role", "status");
  popup.setAttribute("aria-live", "polite");
  popup.style.visibility = "hidden";

  const header = document.createElement("div");
  header.className = "ia-header";

  const icon = document.createElement("img");
  icon.className = "ia-icon";
  icon.src = chrome.runtime.getURL(
    "icons/iax_icon.svg"
  );
  icon.alt = "";
  icon.setAttribute("aria-hidden", "true");
  header.appendChild(icon);

  const title = document.createElement("h2");
  title.textContent = "Inspect AX";
  header.appendChild(title);

  popup.appendChild(header);

  const body = document.createElement("div");
  body.className = "ia-body";

  const copyStatus = document.createElement("p");
  copyStatus.className = "ia-copy-status";
  copyStatus.setAttribute("aria-live", "polite");
  copyStatus.textContent = "";

  const onCopied = (text) => {
    const preview = normalizeText(text || "", 24);
    copyStatus.textContent = preview ? `Copied: ${preview}` : "Copied";
    copyStatus.classList.add("is-visible");
    clearTimeout(onCopied._timer);
    onCopied._timer = setTimeout(() => {
      copyStatus.classList.remove("is-visible");
    }, 900);
  };

  if (payload.ok) {
    body.appendChild(createInfoRow("Role", payload.role || "-", onCopied));
    body.appendChild(createInfoRow("Name", payload.name || "-", onCopied));
    body.appendChild(copyStatus);
  } else {
    const errorText = document.createElement("p");
    errorText.className = "ia-error";
    errorText.textContent = payload.error || "Unable to inspect AX data.";
    body.appendChild(errorText);
  }

  popup.appendChild(body);
  document.documentElement.appendChild(popup);
  positionPopupNearPointer(popup, payload.pointer);
  registerPopupDismissHandlers(popup);
}

function createInfoRow(label, value, onCopied) {
  const row = document.createElement("div");
  row.className = "ia-row";

  const labelEl = document.createElement("span");
  labelEl.className = "ia-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "ia-value";
  valueEl.textContent = value;
  valueEl.title = "Click or select text to copy";
  makeCopyable(valueEl, value, onCopied);

  row.append(labelEl, valueEl);
  return row;
}

function makeCopyable(node, fallbackValue, onCopied) {
  node.addEventListener("mouseup", async () => {
    const selectedText = getSelectionInside(node);
    if (!selectedText) {
      return;
    }
    const copied = await copyText(selectedText);
    if (copied && typeof onCopied === "function") {
      onCopied(selectedText);
    }
  });

  node.addEventListener("click", async () => {
    if (getSelectionInside(node)) {
      return;
    }
    const copied = await copyText(fallbackValue);
    if (copied && typeof onCopied === "function") {
      onCopied(fallbackValue);
    }
  });
}

function getSelectionInside(node) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return "";
  }

  const text = selection.toString().trim();
  if (!text) {
    return "";
  }

  if (!node.contains(selection.anchorNode) || !node.contains(selection.focusNode)) {
    return "";
  }

  return text;
}

async function copyText(text) {
  if (!text) {
    return false;
  }

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_error) {
    // Fall back to execCommand when clipboard API is blocked.
  }

  return fallbackCopyText(text);
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  const mountNode = document.body || document.documentElement;
  mountNode.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (_error) {
    copied = false;
  }

  textarea.remove();
  return copied;
}

function positionPopupNearPointer(popup, pointer) {
  const margin = 8;
  const offset = 10;
  const popupWidth = popup.offsetWidth;
  const popupHeight = popup.offsetHeight;

  let x = window.innerWidth - popupWidth - margin;
  let y = window.innerHeight - popupHeight - margin;

  if (pointer && Number.isFinite(pointer.x) && Number.isFinite(pointer.y)) {
    x = pointer.x + offset;
    y = pointer.y + offset;
  }

  x = Math.min(Math.max(x, margin), window.innerWidth - popupWidth - margin);
  y = Math.min(Math.max(y, margin), window.innerHeight - popupHeight - margin);

  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  popup.style.visibility = "visible";
}

function registerPopupDismissHandlers(popup) {
  if (typeof clearPopupDismissHandlers === "function") {
    clearPopupDismissHandlers();
  }

  const dismissIfOutside = (event) => {
    if (!popup.isConnected) {
      if (typeof clearPopupDismissHandlers === "function") {
        clearPopupDismissHandlers();
      }
      return;
    }

    if (event.target instanceof Node && popup.contains(event.target)) {
      return;
    }

    popup.remove();
    if (typeof clearPopupDismissHandlers === "function") {
      clearPopupDismissHandlers();
    }
  };

  const dismissOnEscape = (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!popup.isConnected) {
      return;
    }

    popup.remove();
    if (typeof clearPopupDismissHandlers === "function") {
      clearPopupDismissHandlers();
    }
  };

  document.addEventListener("mousedown", dismissIfOutside, true);
  document.addEventListener("contextmenu", dismissIfOutside, true);
  document.addEventListener("keydown", dismissOnEscape, true);

  clearPopupDismissHandlers = () => {
    document.removeEventListener("mousedown", dismissIfOutside, true);
    document.removeEventListener("contextmenu", dismissIfOutside, true);
    document.removeEventListener("keydown", dismissOnEscape, true);
    clearPopupDismissHandlers = null;
  };
}

function ensurePopupStyle() {
  if (document.getElementById("inspect-ax-popup-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "inspect-ax-popup-style";
  style.textContent = `
    #inspect-ax-popup {
      --ia-bg: rgba(255, 255, 255, 0.97);
      --ia-text: #0f172a;
      --ia-muted: #475569;
      --ia-border: rgba(15, 23, 42, 0.2);
      --ia-shadow: 0 8px 22px rgba(15, 23, 42, 0.18);
      --ia-error: #b91c1c;
      --ia-success: #065f46;
      position: fixed;
      width: min(220px, calc(100vw - 12px));
      z-index: 2147483647;
      background: var(--ia-bg);
      color: var(--ia-text);
      border: 1px solid var(--ia-border);
      border-radius: 10px;
      box-shadow: var(--ia-shadow);
      padding: 8px;
      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.3;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }

    @media (prefers-color-scheme: dark) {
      #inspect-ax-popup {
        --ia-bg: rgba(15, 23, 42, 0.97);
        --ia-text: #f8fafc;
        --ia-muted: #94a3b8;
        --ia-border: rgba(148, 163, 184, 0.45);
        --ia-shadow: 0 8px 22px rgba(0, 0, 0, 0.34);
        --ia-error: #fca5a5;
        --ia-success: #6ee7b7;
      }
    }

    #inspect-ax-popup .ia-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    #inspect-ax-popup .ia-icon {
      width: 14px;
      height: 14px;
      flex: 0 0 auto;
      opacity: 0.9;
    }

    #inspect-ax-popup h2 {
      margin: 0;
      font-size: 11.5px;
      font-weight: 700;
      color: var(--ia-text);
      letter-spacing: 0.02em;
    }

    #inspect-ax-popup .ia-body {
      display: grid;
      gap: 5px;
    }

    #inspect-ax-popup .ia-row {
      display: grid;
      grid-template-columns: 38px 1fr;
      gap: 6px;
      font-size: 11.5px;
      align-items: start;
    }

    #inspect-ax-popup .ia-label {
      color: var(--ia-muted);
      font-weight: 600;
      user-select: none;
    }

    #inspect-ax-popup .ia-value {
      color: var(--ia-text);
      overflow-wrap: anywhere;
      white-space: normal;
      cursor: copy;
      user-select: text;
    }

    #inspect-ax-popup .ia-copy-status {
      margin: 2px 0 0;
      font-size: 11px;
      color: var(--ia-success);
      opacity: 0;
      transition: opacity 120ms ease;
      min-height: 14px;
    }

    #inspect-ax-popup .ia-copy-status.is-visible {
      opacity: 1;
    }

    #inspect-ax-popup .ia-error {
      margin: 0;
      font-size: 12px;
      color: var(--ia-error);
      overflow-wrap: anywhere;
    }
  `;

  document.documentElement.appendChild(style);
}

function removeExistingPopup() {
  if (typeof clearPopupDismissHandlers === "function") {
    clearPopupDismissHandlers();
  }

  const existing = document.getElementById("inspect-ax-popup");
  if (existing) {
    existing.remove();
  }
}

function createUniqueSelector(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  if (element.id) {
    return `#${cssEscape(element.id)}`;
  }

  const segments = [];
  let node = element;

  while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body) {
    let segment = node.tagName.toLowerCase();

    if (node.classList.length > 0) {
      segment += `.${cssEscape(node.classList[0])}`;
    }

    const parent = node.parentElement;
    if (parent) {
      const sameTagSiblings = Array.from(parent.children).filter(
        (child) => child.tagName === node.tagName
      );
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(node) + 1;
        segment += `:nth-of-type(${index})`;
      }
    }

    segments.unshift(segment);
    const candidate = segments.join(" > ");

    try {
      if (document.querySelectorAll(candidate).length === 1) {
        return candidate;
      }
    } catch (_error) {
      // Continue building the selector.
    }

    node = parent;
  }

  return segments.join(" > ");
}

function createXPath(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  if (element.id && !element.id.includes('"')) {
    return `//*[@id="${element.id}"]`;
  }

  const segments = [];
  let node = element;

  while (node && node.nodeType === Node.ELEMENT_NODE) {
    const tagName = node.tagName.toLowerCase();
    let index = 1;
    let sibling = node.previousElementSibling;

    while (sibling) {
      if (sibling.tagName === node.tagName) {
        index += 1;
      }
      sibling = sibling.previousElementSibling;
    }

    segments.unshift(`${tagName}[${index}]`);
    node = node.parentElement;
  }

  return `/${segments.join("/")}`;
}

function normalizeText(input, maxLength) {
  return input.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function readString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }

  return String(value).replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}
