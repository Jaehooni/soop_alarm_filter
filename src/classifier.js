(function exposeClassifier(root, factory) {
  const api = factory();
  root.SoopNotificationClassifier = api;

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createClassifier() {
  "use strict";

  // Keep these rules text-based and independent from SOOP's DOM so they are
  // straightforward to update when notification wording changes.
  const COMMENT_PATTERNS = [
    /댓글/,
    /답글/,
    /comment/i,
    /repl(?:y|ied)/i
  ];

  const NON_COMMENT_PATTERNS = [
    /방송\s*(?:을\s*)?(?:시작|종료)/,
    /라이브\s*(?:가\s*)?(?:시작|종료)/,
    /방송\s*중입니다/,
    /새로운\s*(?:방송|라이브)/,
    /공지(?:사항)?/,
    /신규\s*게시글/,
    /새로운\s*게시글/,
    /구독/,
    /이벤트/,
    /선물/,
    /별풍선/,
    /애드벌룬/,
    /스티커/,
    /팔로우/,
    /즐겨찾기/,
    /업로드/,
    /새로운\s*(?:vod|영상|클립)/i,
    /vod|클립/i
  ];

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function classifyNotification(value) {
    const text = normalizeText(value);

    if (!text) return "unknown";
    if (COMMENT_PATTERNS.some((pattern) => pattern.test(text))) return "comment";
    if (NON_COMMENT_PATTERNS.some((pattern) => pattern.test(text))) return "non-comment";
    return "unknown";
  }

  return Object.freeze({ normalizeText, classifyNotification });
});
