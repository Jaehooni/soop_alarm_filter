(function initializeSoopCommentFilter() {
  "use strict";

  const classifier = globalThis.SoopNotificationClassifier;
  if (!classifier) return;

  const TOOLBAR_CLASS = "soop-comment-filter";
  const HIDDEN_CLASS = "soop-comment-filter-hidden";
  const PANEL_MARKER = "data-soop-comment-filter-panel";
  const ITEM_MARKER = "data-soop-comment-filter-kind";

  const PANEL_SELECTORS = [
    "ul[class*='notification-module_list__' i]",
    "[data-type*='notification' i]",
    "[data-testid*='notification' i]",
    "[aria-label*='알림']",
    "[class*='notification' i]",
    "[class*='alarm' i]",
    "[id*='notification' i]",
    "[id*='alarm' i]"
  ];

  const ITEM_SELECTORS = [
    "[data-type*='notification-item' i]",
    "[data-testid*='notification-item' i]",
    "[class*='notification-item' i]",
    "[class*='alarm-item' i]",
    "[role='listitem']",
    "li"
  ];

  const panelStates = new WeakMap();
  let scanQueued = false;

  function isSemanticallyVisible(element) {
    if (!element.isConnected || element.hidden) return false;
    if (element.getAttribute("aria-hidden") === "true") return false;

    let current = element;
    while (current && current !== document.documentElement) {
      const style = current.style;
      if (style && (style.display === "none" || style.visibility === "hidden")) return false;
      current = current.parentElement;
    }
    return true;
  }

  function elementText(element) {
    const labelledText = [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.textContent
    ].filter(Boolean).join(" ");
    return classifier.normalizeText(labelledText);
  }

  function looksLikePanel(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.closest(`.${TOOLBAR_CLASS}`)) return false;
    if (element.matches("button, a, [role='button'], [role='listitem']")) return false;
    if (element.matches("[class*='notification-item' i], [class*='alarm-item' i]")) return false;
    if (element.childElementCount === 0) return false;

    const identifyingText = classifier.normalizeText([
      element.getAttribute("aria-label"),
      element.getAttribute("data-testid"),
      element.id,
      element.className,
      element.querySelector("h1, h2, h3, [role='heading']")?.textContent
    ].filter((value) => typeof value === "string").join(" "));

    return /알림|notification|alarm/i.test(identifyingText);
  }

  function findPanels() {
    // Current SOOP markup (CSS-module hash suffix may change):
    // <ul class="notification-module_list__…"><li>…</li></ul>
    const soopLists = [...document.querySelectorAll(
      "ul[class*='notification-module_list__' i]"
    )];
    if (soopLists.length > 0) return soopLists;

    const matches = new Set();
    document.querySelectorAll(PANEL_SELECTORS.join(",")).forEach((element) => {
      if (looksLikePanel(element)) matches.add(element);
    });

    // Prefer the innermost matching container. Parent wrappers frequently share
    // the same "notification" class and would otherwise receive a second toolbar.
    return [...matches].filter((candidate) =>
      ![...matches].some((other) => other !== candidate && candidate.contains(other))
    );
  }

  function findItems(panel) {
    if (panel.matches("ul[class*='notification-module_list__' i]")) {
      return [...panel.children].filter((element) =>
        element.matches("li") && !element.classList.contains(TOOLBAR_CLASS)
      );
    }

    const candidates = [...panel.querySelectorAll(ITEM_SELECTORS.join(","))]
      .filter((element) => !element.closest(`.${TOOLBAR_CLASS}`))
      .filter((element) => elementText(element).length > 0);

    // Nested list markup can match both the outer and inner node. Keep the
    // smallest meaningful item to avoid hiding an entire list accidentally.
    return candidates.filter((candidate) =>
      !candidates.some((other) => other !== candidate && candidate.contains(other))
    );
  }

  function setMode(panel, mode) {
    const state = panelStates.get(panel);
    if (!state) return;
    state.mode = mode;

    state.toolbar.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    });

    filterItems(panel, mode);
  }

  function filterItems(panel, mode) {
    findItems(panel).forEach((item) => {
      const kind = classifier.classifyNotification(elementText(item));
      item.setAttribute(ITEM_MARKER, kind);
      const shouldHide = mode === "comments" && kind === "non-comment";
      item.classList.toggle(HIDDEN_CLASS, shouldHide);
    });
  }

  function createToolbar(panel) {
    // A list panel must receive an LI child to keep its markup valid.
    const toolbar = document.createElement(panel.matches("ul, ol") ? "li" : "div");
    toolbar.className = TOOLBAR_CLASS;
    toolbar.setAttribute("role", "group");
    toolbar.setAttribute("aria-label", "알림 종류 필터");

    [{ mode: "comments", label: "댓글만" }, { mode: "all", label: "전체" }]
      .forEach(({ mode, label }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `${TOOLBAR_CLASS}__button`;
        button.dataset.mode = mode;
        button.textContent = label;
        button.addEventListener("click", () => setMode(panel, mode));
        toolbar.append(button);
      });

    panel.prepend(toolbar);
    panel.setAttribute(PANEL_MARKER, "true");
    panelStates.set(panel, { mode: "comments", toolbar, wasVisible: false });
    return toolbar;
  }

  function processPanel(panel) {
    let state = panelStates.get(panel);
    const existingToolbar = panel.querySelector(`:scope > .${TOOLBAR_CLASS}`);

    if (!state || !existingToolbar) {
      if (existingToolbar) existingToolbar.remove();
      createToolbar(panel);
      state = panelStates.get(panel);
    }

    const visible = isSemanticallyVisible(panel);
    if (visible && !state.wasVisible) {
      setMode(panel, "comments");
    } else if (visible) {
      filterItems(panel, state.mode);
    }
    state.wasVisible = visible;
  }

  function scan() {
    scanQueued = false;
    findPanels().forEach(processPanel);
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }

  function cleanup() {
    document.querySelectorAll(`.${TOOLBAR_CLASS}`).forEach((element) => element.remove());
    document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach((element) => element.classList.remove(HIDDEN_CLASS));
    document.querySelectorAll(`[${PANEL_MARKER}]`).forEach((element) => element.removeAttribute(PANEL_MARKER));
    document.querySelectorAll(`[${ITEM_MARKER}]`).forEach((element) => element.removeAttribute(ITEM_MARKER));
  }

  const observer = new MutationObserver(queueScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "aria-hidden"]
  });

  window.addEventListener("pagehide", () => {
    observer.disconnect();
    cleanup();
  }, { once: true });

  queueScan();
})();
