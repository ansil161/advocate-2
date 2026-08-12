// ============================================================
//  LIGHT
// ------------------------------------------------------------
//  Outside: soft daylight and long architectural shadows.
//  The threshold: darker, the way a deep doorway always is.
//  Inside: window light down one side, lamps on the desks, and
//  at the very end a single pool of light on the book.
//  Nothing here is dramatic — a firm should read as calm and
//  authoritative, not haunted.
//
//  The interior is lit by a small rig that travels with the
//  camera rather than by a fixture at every position. Three.js
//  is a forward renderer: every light in the scene is evaluated
//  by every lit fragment whether or not its intensity is zero,
//  so a corridor with a lamp every eight metres costs the same
//  at the door as it does in the stacks. Moving four lights is
//  indistinguishable on screen and roughly half the frame time
//  on integrated graphics.
// ============================================================
import * as THREE from 'three';
import { W, CUE } from './hero.config.js';
import { span, lerp, smoothstep, clamp } from './lib/util.js';

// The practical lamps that exist as objects in the world. Only the two
// nearest the camera are ever actually lit.
const LAMPS = [
  [-3.5, W.floorY + 1.24, -20.4],
  [3.6, W.floorY + 1.24, -24.6],
  [-3.75, W.floorY + 1.24, -29.9],
  [-2.6, W.floorY + 1.16, -57.6],
  [1.32, W.tableTopY + 0.55, -88.42],
];

export function buildLighting(scene, quality) {
  const group = new THREE.Group();

  const hemi = new THREE.HemisphereLight(0xdfe3e6, 0x4a463e, 1.05);
  const ambient = new THREE.AmbientLight(0xece7dc, 0.22);
  group.add(hemi, ambient);

  // The sun: a low, raking key that gives the facade its shadows.
  const sun = new THREE.DirectionalLight(0xfff4e2, 2.1);
  sun.position.set(-26, 26, 30);
  sun.target.position.set(0, 4, 2);
  if (quality.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    const c = sun.shadow.camera;
    c.left = -26; c.right = 26; c.top = 24; c.bottom = -8;
    c.near = 1; c.far = 95;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.035;
  }
  group.add(sun, sun.target);

  // One travelling light for the entrance: under the portico on the way
  // in, then just inside the threshold. Without it the arrival plays
  // out on a black slab and the hall behind the doors is a hole.
  const threshold = new THREE.PointLight(0xf6e8cf, 0, 28, 1.5);
  threshold.position.set(0, 5.0, 3.1);
  group.add(threshold);

  // The travelling interior rig: a pool where the camera stands and two
  // more down the corridor ahead of it.
  const hall = [0, 1, 2].map(() => {
    const l = new THREE.PointLight(0xf0e6d6, 0, 26, 1.35);
    group.add(l);
    return l;
  });
  const windowFill = new THREE.PointLight(0xe8ecf2, 0, 34, 1.3);
  group.add(windowFill);

  const practicals = [0, 1].map(() => {
    const l = new THREE.PointLight(0xffd9a6, 0, 9, 2);
    group.add(l);
    return l;
  });

  // The reading room: one shaft over the table.
  const tableKey = new THREE.SpotLight(0xfff0d8, 0, 16, 0.52, 0.85, 1.6);
  tableKey.position.set(0.6, W.floorY + 4.4, W.tableZ + 0.8);
  tableKey.target.position.set(0, W.tableTopY, W.tableZ);
  if (quality.shadows) {
    const s = Math.min(1024, quality.shadowSize);
    tableKey.castShadow = true;
    tableKey.shadow.mapSize.set(s, s);
    tableKey.shadow.bias = -0.0009;
    tableKey.shadow.normalBias = 0.02;
    tableKey.shadow.camera.near = 0.6;
    tableKey.shadow.camera.far = 14;
  }
  group.add(tableKey, tableKey.target);

  scene.add(group);

  const order = [];

  return {
    group,
    // Zone levels are also what the photographs of the advocates are
    // tinted by, so the people darken with the rooms they stand in.
    levels: { street: 1, interior: 0.6 },

    update(progress, camera) {
      // Daylight falls away as the doorway swallows the frame, and the
      // interior takes over — one continuous hand-off, no cut.
      const inside = smoothstep(span(progress, CUE.interior));
      const atDoor = smoothstep(span(progress, [CUE.door[0] - 0.06, CUE.door[1]]));
      const library = smoothstep(span(progress, CUE.library));
      const finale = smoothstep(span(progress, [0.93, 0.995]));

      hemi.intensity = lerp(1.05, 0.42, inside);
      ambient.intensity = lerp(0.2, 0.34, inside);
      sun.intensity = lerp(2.0, 0.05, Math.max(inside, atDoor * 0.5));

      // The entrance light walks in with the visitor.
      const cross = smoothstep(span(progress, [0.55, 0.68]));
      threshold.position.z = lerp(3.1, -6, cross);
      threshold.position.y = lerp(5.0, 4.2, cross);
      threshold.intensity = smoothstep(span(progress, [0.28, 0.5])) * 8
        + lerp(0, 7, atDoor) * (1 - inside * 0.55);

      // The hall rig rides along with the camera.
      const cz = camera.position.z;
      const deep = lerp(1, 0.62, library);
      hall.forEach((l, i) => {
        l.position.set(0, W.ceilingY - 0.6, clamp(cz - 2 - i * 11, -94, -3));
        l.intensity = lerp(0, (i === 0 ? 13 : 10) * deep, inside);
      });

      // Daylight from the window wall, held inside the glazed stretch.
      windowFill.position.set(-4.2, 3.9, clamp(cz - 4, -38, -17));
      windowFill.intensity = lerp(0, 24, inside) * (1 - library * 0.92);

      // Only the two nearest practicals are lit; every other lamp in
      // the world is geometry with a glowing shade and no light at all.
      order.length = 0;
      for (let i = 0; i < LAMPS.length; i += 1) order.push(i);
      order.sort((a, b) => Math.abs(LAMPS[a][2] - cz) - Math.abs(LAMPS[b][2] - cz));
      practicals.forEach((l, i) => {
        const lamp = LAMPS[order[i]];
        l.position.set(lamp[0], lamp[1], lamp[2]);
        const fade = 1 - clamp((Math.abs(lamp[2] - cz) - 8) / 22);
        l.intensity = lerp(0.6, 5.4, inside) * fade * lerp(1, 1.4, library);
      });

      tableKey.intensity = lerp(0, 11, smoothstep(span(progress, [0.9, 0.99])));

      // What the character billboards are tinted to. The photographs
      // carry their own baked light, so this is the only thing keeping
      // them from floating on top of the rooms they stand in.
      this.levels.street = lerp(0.7, 0.46, atDoor);
      this.levels.interior = lerp(0.34, 0.78, inside) * lerp(1, 0.74, library) * lerp(1, 1.1, finale);
      this.levels.interior = clamp(this.levels.interior, 0.2, 0.95);
    },
  };
}
