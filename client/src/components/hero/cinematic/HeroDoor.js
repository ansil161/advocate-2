// ============================================================
//  THE DOOR
// ------------------------------------------------------------
//  Two leaves on real hinges. The camera does not cut through
//  them and nothing fades: they swing inward, the interior
//  widens between them, and the lens crosses the threshold.
// ============================================================
import * as THREE from 'three';
import { W } from './hero.config.js';
import { easeInOut, clamp } from './lib/util.js';

const OPEN_ANGLE = 1.42;

export function buildDoor(M, quality) {
  const group = new THREE.Group();
  const half = W.doorW / 2;
  const leafW = half - 0.04;

  const leaf = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * half, W.floorY, -0.34);

    const slab = new THREE.Mesh(new THREE.BoxGeometry(leafW, W.doorH, 0.1), M.doorLeaf);
    slab.position.set((-side * leafW) / 2, W.doorH / 2, 0);
    pivot.add(slab);

    // Raised panels — three per leaf, in the way a heavy door is made.
    [0.78, 1.98, 3.06].forEach((y, i) => {
      const h = i === 2 ? 1.3 : 0.98;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.34, h, 0.04), M.doorPanel);
      panel.position.set((-side * leafW) / 2, y, 0.06);
      pivot.add(panel);
      const back = panel.clone();
      back.position.z = -0.06;
      pivot.add(back);
    });

    // Brass furniture.
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 10), M.brass);
    handle.position.set(-side * (leafW - 0.22), 1.62, 0.1);
    pivot.add(handle);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.02), M.brass);
    plate.position.set(-side * (leafW - 0.22), 1.62, 0.06);
    pivot.add(plate);

    if (quality.shadows) {
      pivot.traverse((o) => {
        o.castShadow = true;
        o.receiveShadow = true;
      });
    }
    group.add(pivot);
    return pivot;
  };

  const left = leaf(-1);
  const right = leaf(1);

  // Threshold strip and the dark reveal behind the leaves.
  const sill = new THREE.Mesh(new THREE.BoxGeometry(W.doorW + 0.6, 0.06, 0.5), M.stoneDark);
  sill.position.set(0, W.floorY - 0.02, -0.2);
  group.add(sill);

  return {
    group,
    // 0 → shut, 1 → fully open. Eased so the leaves lead heavily and
    // settle rather than arriving at a stop.
    set(open) {
      const a = easeInOut(clamp(open)) * OPEN_ANGLE;
      left.rotation.y = a;
      right.rotation.y = -a;
    },
  };
}
