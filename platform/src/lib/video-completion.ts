export function isVideoNearEnd(position: number, duration: number) {
  return duration > 0 && position <= duration && position >= duration * 0.9;
}
export function videoIsComplete(watched: number, duration: number, position = 0) {
  void position;
  return duration > 0 && watched / duration >= 0.9;
}
