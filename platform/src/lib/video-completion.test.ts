import { expect, it } from "vitest";
import { isVideoNearEnd, videoIsComplete } from "./video-completion";

it.each([0, 1, 49.99])("não conclui com %s segundos assistidos de 100, mesmo no fim", watched => {
  expect(videoIsComplete(watched, 100, 100)).toBe(false);
});
it("exige metade assistida e chegada ao fim", () => {
  expect(videoIsComplete(50, 100, 100)).toBe(true);
  expect(videoIsComplete(100, 100, 90)).toBe(false);
  expect(videoIsComplete(50, 100, 98.99)).toBe(false);
  expect(videoIsComplete(50, 100, 99)).toBe(true);
});
it("administrador dispensa permanência, mas precisa chegar ao fim", () => {
  expect(videoIsComplete(0, 100, 100, true)).toBe(true);
  expect(videoIsComplete(0, 100, 90, true)).toBe(false);
});
it("tolera até dois segundos no fim sem liberar cedo vídeos curtos", () => {
  expect(isVideoNearEnd(1798, 1800)).toBe(true);
  expect(isVideoNearEnd(1797.99, 1800)).toBe(false);
  expect(isVideoNearEnd(9, 10)).toBe(false);
  expect(isVideoNearEnd(9.9, 10)).toBe(true);
  expect(isVideoNearEnd(1803, 1800)).toBe(false);
});
it.each([0, -1, NaN, Infinity])("recusa duração inválida %s", duration => {
  expect(videoIsComplete(100, duration, duration, true)).toBe(false);
});
it("recusa valores não finitos", () => {
  expect(videoIsComplete(Infinity, 100, 100)).toBe(false);
  expect(videoIsComplete(50, 100, NaN)).toBe(false);
});
