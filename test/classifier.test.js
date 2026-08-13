"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeText, classifyNotification } = require("../src/classifier.js");

test("normalizes whitespace, compatibility characters, and invisible characters", () => {
  assert.equal(normalizeText("  새\u200B  댓글이\n달렸습니다  "), "새 댓글이 달렸습니다");
});

test("classifies Korean comments and replies", () => {
  assert.equal(classifyNotification("회원님의 게시물에 댓글을 남겼습니다"), "comment");
  assert.equal(classifyNotification("내 댓글에 새로운 답글이 달렸습니다"), "comment");
});

test("comment wording takes precedence over other keywords", () => {
  assert.equal(classifyNotification("공지 게시물에 댓글이 달렸습니다"), "comment");
  assert.equal(classifyNotification("VOD에 댓글을 남겼습니다"), "comment");
});

test("classifies explicit non-comment notifications", () => {
  const messages = [
    "즐겨찾기한 스트리머가 방송을 시작했습니다",
    "캬루♥님의 신규 게시글 : 7월 4주차 일정표",
    "새로운 공지사항이 등록되었습니다",
    "구독 갱신 안내",
    "이벤트 당첨 안내",
    "새로운 VOD가 업로드되었습니다"
  ];

  messages.forEach((message) => {
    assert.equal(classifyNotification(message), "non-comment", message);
  });
});

test("keeps ambiguous and empty notifications as unknown", () => {
  assert.equal(classifyNotification("회원님을 언급했습니다"), "unknown");
  assert.equal(classifyNotification(""), "unknown");
});

test("sample notification list follows comments-mode visibility policy", () => {
  const sampleItems = [
    "내 게시물에 댓글이 달렸습니다",
    "내 댓글에 답글을 남겼습니다",
    "즐겨찾기한 방송이 시작되었습니다",
    "회원님을 언급했습니다"
  ];

  const visibleInCommentsMode = sampleItems.filter((message) =>
    classifyNotification(message) !== "non-comment"
  );

  assert.deepEqual(visibleInCommentsMode, [
    "내 게시물에 댓글이 달렸습니다",
    "내 댓글에 답글을 남겼습니다",
    "회원님을 언급했습니다"
  ]);
});
