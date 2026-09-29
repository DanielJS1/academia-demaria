export function isVideoNearEnd(position: number, duration: number) {
  return Number.isFinite(duration) && Number.isFinite(position) && duration > 0
    && position <= duration + 2 && position >= duration - Math.min(2, duration * 0.01);
}
export function videoIsComplete(watched: number, duration: number, position = 0, isAdmin = false) {
  return isVideoNearEnd(position, duration) && Number.isFinite(watched) && watched >= 0
    && (isAdmin || watched >= duration * 0.5);
}
