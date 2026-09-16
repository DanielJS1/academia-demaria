// Temporary pilot rule. Set false to require 90% watched again.
export const ALLOW_END_SEEK_COMPLETION = true;
export function isVideoNearEnd(position: number, duration: number) {
  return duration > 0 && position <= duration && position >= (duration > 20 ? duration - 20 : duration * 0.9);
}
export function videoIsComplete(watched: number, duration: number, position = 0) {
  return duration > 0 && (watched / duration >= 0.9 || (ALLOW_END_SEEK_COMPLETION && isVideoNearEnd(position, duration)));
}
