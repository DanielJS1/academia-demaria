import { expect, it } from "vitest";
import { isVideoNearEnd, videoIsComplete } from "./video-completion";

it("does not count a seek near the end as watched time", () => {
  expect(videoIsComplete(1,1800,1779)).toBe(false);
  expect(videoIsComplete(1,1800,1780)).toBe(false);
  expect(videoIsComplete(0,1800,1800)).toBe(false);
});
it("keeps 90% watched completion and handles short or invalid durations", () => {
  expect(videoIsComplete(1620,1800)).toBe(true);
  expect(videoIsComplete(0,0,0)).toBe(false);
  expect(isVideoNearEnd(0,10)).toBe(false);
  expect(isVideoNearEnd(9,10)).toBe(true);
  expect(isVideoNearEnd(1801,1800)).toBe(false);
});
