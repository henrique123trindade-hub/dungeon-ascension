import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_CAMERA_ZOOM, computeCameraZoom } from './viewportCamera';

test('keeps base zoom on standard viewports where room already covers viewport', () => {
  const z1280 = computeCameraZoom(1280, 720, 1536, 1088);
  const z1440 = computeCameraZoom(1440, 900, 1536, 1088);
  assert.equal(z1280, BASE_CAMERA_ZOOM);
  assert.equal(z1440, BASE_CAMERA_ZOOM);
});

test('scales zoom up on 1080p, 1440p, and ultrawide viewports so no right or bottom black bar appears', () => {
  const cases: Array<[number, number, number, number]> = [
    [1920, 1080, 1536, 1088],
    [1920, 1080, 1664, 1152],
    [2560, 1440, 1536, 1088],
    [2560, 1080, 1536, 1088],
    [1440, 1400, 1536, 1088],
  ];

  for (const [vw, vh, rw, rh] of cases) {
    const zoom = computeCameraZoom(vw, vh, rw, rh);
    const visibleWorldW = vw / zoom;
    const visibleWorldH = vh / zoom;
    assert.ok(
      visibleWorldW <= rw,
      `Expected visible world width (${visibleWorldW}) <= roomWidth (${rw}) for ${vw}x${vh}`
    );
    assert.ok(
      visibleWorldH <= rh,
      `Expected visible world height (${visibleWorldH}) <= roomHeight (${rh}) for ${vw}x${vh}`
    );
  }
});
