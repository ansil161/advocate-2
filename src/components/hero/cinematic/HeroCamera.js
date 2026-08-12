// ============================================================
//  THE CAMERA
// ------------------------------------------------------------
//  Scroll does not translate the camera; it moves it along a
//  path a cinematographer laid out — establishing shot, walk-in,
//  arrival, threshold, exploration, and a final close-up. The
//  pacing lives in the spacing of the keyframes, so the camera
//  slows where it should look and never snaps.
// ============================================================
import * as THREE from 'three';
import { CAMERA_PATH } from './hero.config.js';
import { sampleTrack, lerp, clamp } from './lib/util.js';

export function createCamera(aspect, reduceMotion) {
  const camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 260);
  const look = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const smoothPos = new THREE.Vector3();
  const smoothLook = new THREE.Vector3();
  let started = false;

  return {
    camera,
    lookTarget: look,

    // `progress` is the scroll position, `time` only feeds the drift.
    update(progress, time, dt) {
      const t = clamp(progress);
      const p = sampleTrack(CAMERA_PATH, t, (k) => k.pos);
      const l = sampleTrack(CAMERA_PATH, t, (k) => k.look);
      const fov = sampleTrack(CAMERA_PATH, t, (k) => [k.fov])[0];

      // A breath of hand-held drift, strongest out on the street and
      // gone by the time the book fills the frame.
      const settle = 1 - clamp((t - 0.9) / 0.1);
      const drift = reduceMotion ? 0 : 0.035 * settle;
      pos.set(
        p[0] + Math.sin(time * 0.31) * drift,
        p[1] + Math.sin(time * 0.43 + 1.7) * drift * 0.8,
        p[2] + Math.cos(time * 0.27) * drift * 0.6
      );
      look.set(
        l[0] + Math.sin(time * 0.23 + 0.6) * drift * 1.6,
        l[1] + Math.cos(time * 0.19) * drift * 1.2,
        l[2]
      );

      // Critically-damped follow, so a flicked scroll wheel arrives as
      // a move rather than a jump.
      if (!started) {
        smoothPos.copy(pos);
        smoothLook.copy(look);
        started = true;
      } else {
        const k = 1 - Math.exp(-dt * 9);
        smoothPos.lerp(pos, k);
        smoothLook.lerp(look, k);
      }

      camera.position.copy(smoothPos);
      camera.lookAt(smoothLook);
      if (Math.abs(camera.fov - fov) > 0.001) {
        camera.fov = lerp(camera.fov, fov, 0.35);
        camera.updateProjectionMatrix();
      }
    },

    resize(aspectRatio) {
      camera.aspect = aspectRatio;
      camera.updateProjectionMatrix();
    },
  };
}
