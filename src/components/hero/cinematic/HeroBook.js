// ============================================================
//  THE OPEN BOOK
// ------------------------------------------------------------
//  A physical object on the reading table, not an overlay: the
//  camera has to travel to it, and the spread turns open under
//  scroll. Everything printed on it is sourced from the firm's
//  own material — see src/data/firm.js and practiceAreas.js.
// ============================================================
import * as THREE from 'three';
import { W } from './hero.config.js';
import { easeInOut, clamp, lerp } from './lib/util.js';
import * as T from './lib/textures.js';

const PAGE_W = 0.52;
const PAGE_D = 0.72;

// A page is not flat — it bows away from the spine. Bending the
// geometry once is what stops the spread reading as two cards.
function pageGeometry() {
  const g = new THREE.PlaneGeometry(PAGE_W, PAGE_D, 12, 8);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const u = (pos.getX(i) + PAGE_W / 2) / PAGE_W; // 0 at spine edge
    const v = (pos.getY(i) + PAGE_D / 2) / PAGE_D;
    const bow = Math.sin(u * Math.PI) * 0.012 + Math.sin(v * Math.PI) * 0.006;
    pos.setZ(i, bow);
  }
  g.computeVertexNormals();
  return g;
}

export function buildBook(M, stats) {
  const group = new THREE.Group();
  group.position.set(0, W.tableTopY + 0.012, W.tableZ);

  const boardMat = new THREE.MeshStandardMaterial({ color: 0x1a1714, roughness: 0.62, metalness: 0.05 });
  const edgeMat = new THREE.MeshStandardMaterial({ map: T.paper(), roughness: 0.95 });

  // Cover boards, laid open on the table.
  [-1, 1].forEach((s) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W + 0.06, 0.022, PAGE_D + 0.06), boardMat);
    board.position.set(s * (PAGE_W / 2 + 0.02), 0, 0);
    board.rotation.z = -s * 0.035;
    board.castShadow = true;
    board.receiveShadow = true;
    group.add(board);

    // The block of pages still lying shut on each side.
    const block = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W, 0.03, PAGE_D), edgeMat);
    block.position.set(s * (PAGE_W / 2 + 0.015), 0.026, 0);
    block.rotation.z = -s * 0.03;
    block.receiveShadow = true;
    group.add(block);
  });

  const spine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, PAGE_D + 0.05, 12, 1, false, 0, Math.PI),
    boardMat
  );
  spine.rotation.set(Math.PI / 2, 0, 0);
  spine.position.y = -0.004;
  group.add(spine);

  const geo = pageGeometry();
  const makePage = (side, map) => {
    const pivot = new THREE.Group();
    pivot.position.y = 0.044;
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2; // lie flat, printing facing up
    mesh.position.x = side * (PAGE_W / 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    pivot.add(mesh);
    group.add(pivot);
    return pivot;
  };

  const left = makePage(-1, T.bookLeft());
  const right = makePage(1, T.bookRight(stats));

  return {
    group,
    // 0 → the spread is nearly shut and unreadable; 1 → open and level.
    set(open) {
      const t = easeInOut(clamp(open));
      const a = lerp(1.46, 0.055, t);
      left.rotation.z = -a;
      right.rotation.z = a;
      const lift = lerp(0.03, 0, t);
      left.position.y = 0.044 + lift;
      right.position.y = 0.044 + lift;
    },
  };
}
