(function initializeSoopCommentFilter() {
  "use strict";

  const classifier = globalThis.SoopNotificationClassifier;
  if (!classifier) return;

  const TOOLBAR_CLASS = "soop-comment-filter";
  const HIDDEN_CLASS = "soop-comment-filter-hidden";
  const EMPTY_DATE_CLASS = "soop-comment-filter-empty-date";
  const PANEL_MARKER = "data-soop-comment-filter-panel";
  const ITEM_MARKER = "data-soop-comment-filter-kind";
  const DATE_MARKER = "data-soop-comment-filter-date";
  const LIST_SELECTOR = "ul[class*='notification-module_list__' i]";

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

  function findPanels() {
    // Current SOOP markup (CSS-module hash suffix may change):
    // <ul class="notification-module_list__…"><li>…</li></ul>
    const soopLists = [...document.querySelectorAll(LIST_SELECTOR)];
    // SOOP creates one list per date section. Use one controller for the first
    // list and let it control every date list instead of adding repeated tools.
    return soopLists.length > 0 ? [soopLists[0]] : [];
  }

  function findItems(panel) {
    if (!panel.matches(LIST_SELECTOR)) return [];

    return [...document.querySelectorAll(LIST_SELECTOR)]
      .flatMap((list) => [...list.children])
      .filter((element) => element.matches("li"));
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

    updateDateSections();
  }

  function findDateHeading(list) {
    let candidate = list.previousElementSibling;

    // The global filter is inserted immediately before the first date list, so
    // skip it while looking backwards for that list's date label.
    for (let steps = 0; candidate && steps < 5; steps += 1) {
      if (!candidate.classList.contains(TOOLBAR_CLASS)) {
        const text = classifier.normalizeText(candidate.textContent);
        if (/^(?:오늘|어제|\d{1,2}월\s*\d{1,2}일)$/.test(text)) return candidate;
      }
      candidate = candidate.previousElementSibling;
    }

    return null;
  }

  function updateDateSections() {
    document.querySelectorAll(LIST_SELECTOR)
      .forEach((list) => {
        const notificationItems = [...list.children].filter((element) => element.matches("li"));
        const hasVisibleItem = notificationItems.some((item) =>
          !item.classList.contains(HIDDEN_CLASS)
        );
        const heading = findDateHeading(list);

        list.classList.toggle(EMPTY_DATE_CLASS, !hasVisibleItem);
        if (heading) {
          heading.setAttribute(DATE_MARKER, "true");
          heading.classList.toggle(EMPTY_DATE_CLASS, !hasVisibleItem);
        }
      });
  }

  function createToolbar(panel) {
    const isCurrentSoopList = panel.matches(LIST_SELECTOR);
    if (isCurrentSoopList) {
      // Remove a controller left beside a date list replaced by React.
      document.querySelectorAll(`.${TOOLBAR_CLASS}`).forEach((element) => element.remove());
    }
    const toolbar = document.createElement("div");
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

    if (isCurrentSoopList) {
      // Keep the controller outside the date-specific UL. This avoids inheriting
      // SOOP's notification LI styles and makes the filter global to all dates.
      panel.before(toolbar);
    } else {
      panel.prepend(toolbar);
    }
    panel.setAttribute(PANEL_MARKER, "true");
    panelStates.set(panel, { mode: "comments", toolbar, wasVisible: false });
    return toolbar;
  }

  function processPanel(panel) {
    let state = panelStates.get(panel);
    const isCurrentSoopList = panel.matches(LIST_SELECTOR);
    const existingToolbar = isCurrentSoopList
      ? state?.toolbar?.isConnected && state.toolbar
      : panel.querySelector(`:scope > .${TOOLBAR_CLASS}`);

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
    observer.takeRecords();
  }

  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }

  function isExtensionOwnedNode(node) {
    if (!(node instanceof Element)) return false;
    return Boolean(
      node.closest(`.${TOOLBAR_CLASS}`) ||
      node.hasAttribute(ITEM_MARKER) ||
      node.hasAttribute(DATE_MARKER) ||
      node.classList.contains(HIDDEN_CLASS) ||
      node.classList.contains(EMPTY_DATE_CLASS)
    );
  }

  function shouldScanForMutation(mutation) {
    const addedElements = [...mutation.addedNodes]
      .filter((node) => node.nodeType === Node.ELEMENT_NODE);
    const removedElements = [...mutation.removedNodes]
      .filter((node) => node.nodeType === Node.ELEMENT_NODE);
    const changedNodes = [...addedElements, ...removedElements];

    if (changedNodes.length === 0) return false;

    // New notifications are normally appended inside an existing date list.
    if (mutation.target instanceof Element && mutation.target.closest(LIST_SELECTOR)) {
      return changedNodes.some((node) => !isExtensionOwnedNode(node));
    }

    // Date lists themselves can be mounted or replaced by React. Only inspect
    // the changed subtree instead of rescanning after unrelated page updates.
    const listChanged = changedNodes.some((node) => {
      if (isExtensionOwnedNode(node)) return false;
      if (node.matches(LIST_SELECTOR)) return true;
      return Boolean(node.querySelector(LIST_SELECTOR));
    });

    if (listChanged) return true;

    // Recreate the controller if SOOP removed only that part of the panel.
    return removedElements.some((node) =>
      node.matches(`.${TOOLBAR_CLASS}`) || Boolean(node.querySelector(`.${TOOLBAR_CLASS}`))
    );
  }

  function handleMutations(mutations) {
    if (mutations.some(shouldScanForMutation)) queueScan();
  }

  function cleanup() {
    document.querySelectorAll(`.${TOOLBAR_CLASS}`).forEach((element) => element.remove());
    document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach((element) => element.classList.remove(HIDDEN_CLASS));
    document.querySelectorAll(`.${EMPTY_DATE_CLASS}`).forEach((element) => element.classList.remove(EMPTY_DATE_CLASS));
    document.querySelectorAll(`[${PANEL_MARKER}]`).forEach((element) => element.removeAttribute(PANEL_MARKER));
    document.querySelectorAll(`[${ITEM_MARKER}]`).forEach((element) => element.removeAttribute(ITEM_MARKER));
    document.querySelectorAll(`[${DATE_MARKER}]`).forEach((element) => element.removeAttribute(DATE_MARKER));
  }

  const observer = new MutationObserver(handleMutations);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener("pagehide", () => {
    observer.disconnect();
    cleanup();
  }, { once: true });

  queueScan();
})();
