export const BASE_CAMERA_ZOOM = 1.12;
const COVER_ZOOM_EPSILON = 0.004;

/**
 * Computes a uniform camera zoom that keeps the visible world inside the room bounds
 * on all viewport resolutions and aspect ratios (preventing right/bottom black bars
 * without stretching or distorting the arena).
 */
export function computeCameraZoom(
  viewportWidth: number,
  viewportHeight: number,
  roomWidth: number,
  roomHeight: number,
  baseZoom: number = BASE_CAMERA_ZOOM
): number {
  const safeViewportW = Math.max(320, viewportWidth);
  const safeViewportH = Math.max(240, viewportHeight);
  const safeRoomW = Math.max(320, roomWidth);
  const safeRoomH = Math.max(240, roomHeight);

  const minCoverZoom = Math.max(safeViewportW / safeRoomW, safeViewportH / safeRoomH);
  return Math.max(baseZoom, minCoverZoom + COVER_ZOOM_EPSILON);
}
