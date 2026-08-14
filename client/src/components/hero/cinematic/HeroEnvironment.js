// ============================================================
//  THE BUILDING
// ------------------------------------------------------------
//  One continuous piece of architecture: pavement, steps,
//  portico, the doorway, and behind it an unbroken run of
//  chambers, library and reading room. Nothing here is a
//  "scene" — it is all standing in the same world at the same
//  time, which is what lets the camera simply walk through it.
// ============================================================
import * as THREE from 'three';
import { W } from './hero.config.js';
import { rng } from './lib/util.js';

const HALL_END = -100;

export function buildEnvironment(M, quality, assets) {
  const group = new THREE.Group();
  // The street and the chambers are never both in shot: one is behind
  // the camera by the time the other is in front of it. Splitting them
  // lets each half be switched off wholesale, which is worth far more
  // than per-object culling — the shadow pass in particular walks every
  // caster in the scene, not just the ones in frame.
  const exterior = new THREE.Group();
  const interior = new THREE.Group();
  group.add(exterior, interior);
  let target = exterior;

  const add = (mesh, cast = true, receive = true) => {
    if (quality.shadows) {
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
    }
    target.add(mesh);
    return mesh;
  };

  const box = (w, h, d, mat, x, y, z, opts = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return add(m, opts.cast ?? true, opts.receive ?? true);
  };

  // ----------------------------------------------------------
  //  I. THE STREET
  // ----------------------------------------------------------
  const pavement = new THREE.Mesh(new THREE.PlaneGeometry(220, 190), M.pavement);
  pavement.rotation.x = -Math.PI / 2;
  pavement.position.set(0, 0, 40);
  add(pavement, false, true);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(140, 30), M.road);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, -0.14, 62);
  add(road, false, true);
  box(140, 0.16, 0.5, M.stone, 0, 0.02, 47, { cast: false }); // kerb

  if (quality.streetProps) {
    // Neighbouring blocks, held back in the haze — they give the
    // street a horizon without ever asking to be looked at.
    const rand = rng(4);
    const blockGeo = new THREE.BoxGeometry(1, 1, 1);
    const blocks = new THREE.InstancedMesh(blockGeo, M.distant, 12);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 12; i += 1) {
      const side = i % 2 ? 1 : -1;
      const w = 9 + rand() * 12;
      const h = 11 + rand() * 16;
      m4.compose(
        new THREE.Vector3(side * (26 + rand() * 26), h / 2 - 0.4, 8 + i * 5.5 + rand() * 6),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 0.3),
        new THREE.Vector3(w, h, 10 + rand() * 10)
      );
      blocks.setMatrixAt(i, m4);
    }
    blocks.instanceMatrix.needsUpdate = true;
    add(blocks, false, false);

    // Trees at the pavement edge, well outside the walk. Three lumps
    // of foliage each, at broken angles — a single sphere on a stick
    // reads as a lollipop, and one lollipop undoes a whole street.
    const tree = (x, z, s, seed) => {
      const r2 = rng(seed);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.19 * s, 4.2 * s, 7), M.bark);
      trunk.position.set(x, 2.1 * s, z);
      trunk.rotation.z = (r2() - 0.5) * 0.08;
      add(trunk, true, false);
      for (let i = 0; i < 3; i += 1) {
        const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35 * s, 1), M.foliage);
        lump.position.set(
          x + (r2() - 0.5) * 1.5 * s,
          (4.4 + i * 0.62) * s + r2() * 0.3,
          z + (r2() - 0.5) * 1.4 * s
        );
        lump.scale.set(1 - i * 0.16, (0.74 - i * 0.08) * (0.9 + r2() * 0.3), 1 - i * 0.12);
        lump.rotation.set(r2() * 3, r2() * 3, r2() * 3);
        add(lump, true, false);
      }
    };
    tree(-16.5, 15, 1.05, 11);
    tree(16.8, 21, 0.95, 23);
    tree(-17.2, 30, 1.1, 37);

    // Street lamps — the reason the pavement has long shadows.
    const lamp = (x, z) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.4, 8), M.steel);
      pole.position.set(x, 2.7, z);
      add(pole, true, false);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.9), M.steel);
      head.position.set(x, 5.4, z + 0.3);
      add(head, true, false);
    };
    lamp(-10.5, 10);
    lamp(10.5, 12);
  }

  // ----------------------------------------------------------
  //  II. THE FACADE
  // ----------------------------------------------------------
  const HW = W.buildingW / 2; // 18
  const DOOR_HALF = W.doorW / 2; // 2.3
  const groundTop = 8.4;
  const wallD = 1.4;

  // Plinth, then the ground storey built around the door opening.
  box(W.buildingW + 1.2, W.floorY, wallD + 1.4, M.stoneDark, 0, W.floorY / 2, -wallD / 2 + 0.4);
  box(HW - DOOR_HALF, groundTop - W.floorY, wallD, M.facade,
    -(DOOR_HALF + (HW - DOOR_HALF) / 2), W.floorY + (groundTop - W.floorY) / 2, -wallD / 2);
  box(HW - DOOR_HALF, groundTop - W.floorY, wallD, M.facade,
    DOOR_HALF + (HW - DOOR_HALF) / 2, W.floorY + (groundTop - W.floorY) / 2, -wallD / 2);
  const lintelY = W.floorY + W.doorH;
  box(W.doorW, groundTop - lintelY, wallD, M.facade, 0, lintelY + (groundTop - lintelY) / 2, -wallD / 2);

  // Door surround — a deep reveal, so the opening reads as cut
  // through a metre of masonry rather than printed on a wall.
  box(0.5, W.doorH + 0.5, 0.34, M.stone, -DOOR_HALF - 0.2, W.floorY + (W.doorH + 0.5) / 2, 0.16);
  box(0.5, W.doorH + 0.5, 0.34, M.stone, DOOR_HALF + 0.2, W.floorY + (W.doorH + 0.5) / 2, 0.16);
  box(W.doorW + 1.4, 0.5, 0.34, M.stone, 0, lintelY + 0.25, 0.16);

  // Cornice band, entablature and the upper storeys.
  box(W.buildingW + 1.6, 0.7, wallD + 0.6, M.stone, 0, groundTop + 0.35, -wallD / 2 + 0.3);
  box(W.buildingW, 7.1, wallD, M.facadeTall, 0, groundTop + 0.7 + 3.55, -wallD / 2);
  box(W.buildingW + 2, 1.1, wallD + 1, M.stone, 0, W.buildingH - 0.55, -wallD / 2 + 0.5);

  // Upper windows.
  const winGeo = new THREE.BoxGeometry(1.9, 3.0, 0.3);
  const wins = new THREE.InstancedMesh(winGeo, M.glazing, 18);
  const sills = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.2, 0.5), M.stone, 18);
  const mm = new THREE.Matrix4();
  let wi = 0;
  [11.2, 14.6].forEach((y) => {
    for (let c = 0; c < 9; c += 1) {
      const x = -14.4 + c * 3.6;
      mm.makeTranslation(x, y, -0.05);
      wins.setMatrixAt(wi, mm);
      mm.makeTranslation(x, y - 1.65, 0.1);
      sills.setMatrixAt(wi, mm);
      wi += 1;
    }
  });
  wins.instanceMatrix.needsUpdate = true;
  sills.instanceMatrix.needsUpdate = true;
  add(wins, false, false);
  add(sills, true, true);

  // Ground-storey windows either side of the portico.
  [-12.6, -8.6, 8.6, 12.6].forEach((x) => {
    box(1.7, 3.4, 0.3, M.glazing, x, 4.3, -0.05, { cast: false });
    box(2.2, 0.22, 0.44, M.stone, x, 2.5, 0.08);
  });

  // The name, on the front face of the portico entablature — which is
  // the only plane on the building that is never occluded by the
  // columns as you walk in. It fades up as the camera closes: the
  // visitor should find the firm, not be handed it.
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.9), M.signage);
  signMesh.position.set(0, groundTop + 0.46, 3.24);
  signMesh.renderOrder = 2;
  target.add(signMesh);

  // Columns across the portico, the inner pair framing the door.
  const colGeo = new THREE.CylinderGeometry(0.46, 0.52, 7.1 - 0.5, 20);
  [-10.1, -6.5, -2.9, 2.9, 6.5, 10.1].forEach((x) => {
    const shaft = new THREE.Mesh(colGeo, M.column);
    shaft.position.set(x, W.floorY + 0.25 + (7.1 - 0.5) / 2, 2.0);
    add(shaft, true, true);
    box(1.35, 0.25, 1.35, M.stone, x, W.floorY + 0.12, 2.0);
    box(1.25, 0.3, 1.25, M.stone, x, W.floorY + 7.1 - 0.15, 2.0);
  });
  // Entablature carried by the columns.
  box(23.6, 0.9, 3.4, M.stone, 0, groundTop + 0.45, 1.5);
  box(24.4, 0.35, 3.8, M.stone, 0, groundTop + 1.05, 1.5);

  // ----------------------------------------------------------
  //  III. THE STEPS
  // ----------------------------------------------------------
  const stepW = 14.4;
  for (let i = 0; i < W.steps; i += 1) {
    const y = (i + 1) * W.stepRise;
    const z = W.stepsFrontZ - i * W.stepDepth;
    box(stepW - i * 0.16, W.stepRise + 0.06, W.stepDepth + 0.06, M.stone, 0, y - W.stepRise / 2, z - W.stepDepth / 2);
  }
  // Landing in front of the door.
  const landingZ0 = W.stepsFrontZ - W.steps * W.stepDepth;
  box(stepW - 1.2, 0.3, landingZ0 + 0.2, M.stone, 0, W.floorY - 0.15, landingZ0 / 2);

  // Cheek walls flanking the flight — and the parapet an advocate
  // stands behind at the top, which hides the cut of his photograph.
  [-1, 1].forEach((s) => {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.05, 5.4), M.stone);
    cheek.position.set(s * (stepW / 2 - 0.1), 0.72, W.stepsFrontZ - 2.5);
    cheek.rotation.x = -Math.atan2(W.floorY, W.steps * W.stepDepth);
    add(cheek);
    box(0.8, 1.02, 2.7, M.stone, s * 6.4, W.floorY + 0.51, landingZ0 - 1.2);
    // Balustrade across the front of the landing, either side of the
    // door — foreground depth on the approach, and the thing the
    // advocate waiting at the top is standing behind.
    box(3.5, 0.94, 0.42, M.stone, s * 4.65, W.floorY + 0.47, 2.55);
    box(3.7, 0.16, 0.6, M.stone, s * 4.65, W.floorY + 1.02, 2.55, { cast: false });
  });

  // ----------------------------------------------------------
  //  IV. THE INTERIOR SHELL — everything past here is interior
  // ----------------------------------------------------------
  target = interior;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 108), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, W.floorY, (0 + HALL_END - 8) / 2);
  add(floor, false, true);

  const hallLen = 79; // threshold → the mouth of the reading room
  [-1, 1].forEach((s) => {
    // Corridor walls run from the threshold to the mouth of the
    // reading room, where the space opens out.
    const wall = box(0.34, W.ceilingY - W.floorY, hallLen, M.wall,
      s * (W.hallHalf + 0.17), (W.floorY + W.ceilingY) / 2, -hallLen / 2 + 0.6);
    wall.receiveShadow = quality.shadows;
    // Reading room, wider, at the far end.
    box(0.34, W.ceilingY - W.floorY, 20, M.wall, s * 9.2, (W.floorY + W.ceilingY) / 2, -88);
    box(4, W.ceilingY - W.floorY, 0.34, M.wall, s * 8, (W.floorY + W.ceilingY) / 2, -78.4);
  });
  box(20, W.ceilingY - W.floorY, 0.4, M.wallDeep, 0, (W.floorY + W.ceilingY) / 2, -98);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(20, 108), M.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, W.ceilingY, -46);
  add(ceiling, false, false);

  // Coffer beams — they give the ceiling a rhythm as you travel
  // under it, which is most of what sells forward motion.
  const beamGeo = new THREE.BoxGeometry(13.6, 0.34, 0.42);
  const beams = new THREE.InstancedMesh(beamGeo, M.wallDeep, 24);
  for (let i = 0; i < 24; i += 1) {
    mm.makeTranslation(0, W.ceilingY - 0.18, -3 - i * 3.4);
    beams.setMatrixAt(i, mm);
  }
  beams.instanceMatrix.needsUpdate = true;
  add(beams, false, false);

  // Daylight down the left-hand side of the chambers.
  const winPanes = [];
  for (let i = 0; i < 5; i += 1) {
    const z = -18 - i * 5;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.4), M.window);
    pane.position.set(-W.hallHalf + 0.02, 3.6, z);
    pane.rotation.y = Math.PI / 2;
    target.add(pane);
    winPanes.push(pane);
    box(3.1, 0.16, 0.5, M.stone, -W.hallHalf + 0.28, 1.78, z, { cast: false });
    box(0.16, 3.8, 0.2, M.wallDeep, -W.hallHalf + 0.28, 3.6, z + 1.4, { cast: false });
    box(0.16, 3.8, 0.2, M.wallDeep, -W.hallHalf + 0.28, 3.6, z - 1.4, { cast: false });
  }
  // The window behind the reading table — the soft ground the final
  // composition sits against.
  const backLight = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 4.6), M.windowFar);
  backLight.position.set(0, 4.1, -97.7);
  target.add(backLight);
  winPanes.push(backLight);

  // ----------------------------------------------------------
  //  V. RECEPTION — under the firm's own signage
  // ----------------------------------------------------------
  const deskTop = W.floorY + 0.76;
  box(3.6, 0.09, 1.15, M.wood, 4.3, deskTop, -12.3);
  box(3.4, 0.72, 0.12, M.woodPanel, 4.3, W.floorY + 0.38, -11.78);
  box(0.12, 0.72, 1.0, M.woodPanel, 2.65, W.floorY + 0.38, -12.3);
  box(3.9, 0.2, 1.2, M.wood, 4.3, deskTop + 0.26, -11.82, { cast: true });

  // The firm's actual signage — photographed off the wall it hangs on,
  // behind the desk it hangs behind.
  if (assets.signWall) {
    const sw = 3.4;
    const signPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(sw, sw * (assets.signWall.image.height / assets.signWall.image.width)),
      new THREE.MeshStandardMaterial({ map: assets.signWall, roughness: 0.62, metalness: 0.1, color: 0x8f8b84 })
    );
    signPanel.position.set(4.4, 3.15, -13.68);
    target.add(signPanel);
    box(4.6, 3.6, 0.22, M.woodPanel, 4.4, 3.05, -13.84, { cast: false });
  }

  // The rest of the entrance hall: a console against the left wall, a
  // waiting bench, and framed enrolments — the furniture of a firm
  // that has been in the same rooms for a decade.
  box(1.9, 0.06, 0.44, M.wood, -5.9, W.floorY + 0.82, -11, { cast: true });
  [-6.7, -5.1].forEach((x) => box(0.08, 0.82, 0.08, M.woodPanel, x, W.floorY + 0.41, -11));
  [[-9.2, 0.44], [-7.4, 0.44]].forEach(([z, h]) => {
    box(0.5, h, 0.04, M.plaque, -W.hallHalf + 0.2, W.floorY + 2.3, z, { cast: false });
  });
  box(1.7, 0.1, 0.5, M.wood, -5.6, W.floorY + 0.42, -15.6);
  [[-6.3, -15.6], [-4.9, -15.6]].forEach(([x, z]) => box(0.1, 0.42, 0.42, M.woodPanel, x, W.floorY + 0.21, z));

  // ----------------------------------------------------------
  //  VI. THE CHAMBERS
  // ----------------------------------------------------------
  const chair = (x, z, yaw) => {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.09, 0.54), M.leather);
    seat.position.y = 0.47;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.68, 0.08), M.leather);
    back.position.set(0, 0.82, -0.24);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.44, 8), M.steel);
    post.position.y = 0.24;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.04, 12), M.steel);
    foot.position.y = 0.03;
    g.add(seat, back, post, foot);
    g.position.set(x, W.floorY, z);
    g.rotation.y = yaw;
    if (quality.shadows) g.traverse((o) => { o.castShadow = true; });
    target.add(g);
    return g;
  };

  const lamp = (x, z, scale = 1) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.04, 14), M.brass);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8), M.brass);
    stem.position.y = 0.19;
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.19, 0.2, 18, 1, true), M.lampShade);
    shade.position.y = 0.44;
    g.add(base, stem, shade);
    g.position.set(x, deskTop + 0.045, z);
    g.scale.setScalar(scale);
    target.add(g);
    return g;
  };

  const paperStack = (x, z, yaw, n = 3) => {
    for (let i = 0; i < n; i += 1) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.008, 0.42), M.paper);
      p.position.set(x + (i % 2) * 0.02, deskTop + 0.05 + i * 0.009, z + i * 0.012);
      p.rotation.y = yaw + i * 0.04;
      add(p, false, true);
    }
  };

  const desk = (x, z, yaw) => {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.0), M.wood);
    top.position.y = 0.76;
    const apron = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.9), M.woodPanel);
    apron.position.y = 0.66;
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.6, 0.08), M.woodPanel);
    front.position.set(0, 0.4, 0.46);
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.66, 0.86), M.woodPanel);
    pedestal.position.set(-0.62, 0.35, 0);
    const pedestal2 = pedestal.clone();
    pedestal2.position.x = 0.62;
    g.add(top, apron, front, pedestal, pedestal2);
    g.position.set(x, W.floorY, z);
    g.rotation.y = yaw;
    if (quality.shadows) g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    target.add(g);
    return g;
  };

  // Four working desks, alternating down the room, each with its
  // advocate seated behind it (HeroCharacters places the people).
  desk(-4.05, -20, 0.62);
  chair(-4.35, -20.6, 0.62);
  lamp(-3.5, -20.4);
  paperStack(-4.4, -19.6, 0.5, 4);

  desk(4.15, -24.2, -0.66);
  chair(4.45, -24.8, -0.66);
  lamp(3.6, -24.6);
  paperStack(4.5, -23.8, -0.6, 3);

  desk(-4.3, -29.5, 0.7);
  chair(-4.6, -30.1, 0.7);
  lamp(-3.75, -29.9);
  paperStack(-4.6, -29.1, 0.7, 5);

  desk(4.1, -33.5, -0.7);
  chair(4.4, -34.1, -0.7);
  paperStack(4.4, -33.0, -0.7, 3);

  // The conference table where two of them are working a file.
  const confTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.09, 1.3), M.wood);
  confTop.position.set(1.3, deskTop, -26.6);
  confTop.rotation.y = -0.2;
  add(confTop);
  [[0.35, -26.1], [2.3, -27.1]].forEach(([x, z]) => {
    box(0.14, 0.72, 0.14, M.woodPanel, x, W.floorY + 0.38, z);
  });
  chair(1.9, -26.9, -0.9);
  paperStack(1.2, -26.5, -0.2, 6);

  // Glazed partitions — depth, reflection, and a sense that the
  // firm keeps going past the edge of the frame.
  [[-30, 1], [-38, -1]].forEach(([z, s]) => {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.2), M.glass);
    glass.position.set(s * 4.6, W.floorY + 1.6, z);
    glass.renderOrder = 3;
    target.add(glass);
    box(0.08, 3.3, 0.08, M.steel, s * 2.8, W.floorY + 1.65, z, { cast: false });
    box(0.08, 3.3, 0.08, M.steel, s * 6.35, W.floorY + 1.65, z, { cast: false });
    box(3.7, 0.08, 0.08, M.steel, s * 4.6, W.floorY + 3.25, z, { cast: false });
  });

  // ----------------------------------------------------------
  //  VII. THE LIBRARY
  // ----------------------------------------------------------
  const shelfCarcasses = [];
  const rowMatrices = [];
  const shelfUnit = (x, z, yaw, h = 3.5) => {
    const carcass = new THREE.Matrix4().compose(
      new THREE.Vector3(x, W.floorY + h / 2, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
      new THREE.Vector3(1.9, h, 0.52)
    );
    shelfCarcasses.push(carcass);
    const rows = Math.round(h / 0.62);
    for (let r = 0; r < rows; r += 1) {
      const y = W.floorY + 0.42 + r * 0.62;
      rowMatrices.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x + Math.sin(yaw) * 0.14, y, z + Math.cos(yaw) * 0.14),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
          new THREE.Vector3(1.72, 0.4, 0.3)
        )
      );
    }
  };

  const units = quality.shelfUnits;
  for (let i = 0; i < units; i += 1) {
    const z = -48 - i * (28 / units);
    shelfUnit(-W.hallHalf + 0.42, z, Math.PI / 2);
    shelfUnit(W.hallHalf - 0.42, z, -Math.PI / 2);
  }
  // Two stacks project into the corridor. The second reaches far enough
  // in that the camera passes within a couple of metres of its end
  // panel: it sweeps across the frame, and the reading room is there
  // when it clears. A physical object doing the work of a cut.
  [[-52.5, 1, 3.4], [-66, -1, 2.15]].forEach(([z, s, inner]) => {
    for (let i = 0; i < 3; i += 1) {
      shelfUnit(s * (5.4 - i * (5.4 - inner - 0.5) / 2.5), z + (i - 1) * 0.02,
        s > 0 ? Math.PI / 2 : -Math.PI / 2, 3.5);
    }
    box(0.5, 3.6, 0.62, M.woodPanel, s * inner, W.floorY + 1.8, z);
  });
  // Shelving in the reading room too, well behind the table.
  for (let i = 0; i < 4; i += 1) {
    shelfUnit(-8.6, -82 - i * 2.4, Math.PI / 2, 3.2);
    shelfUnit(8.6, -82 - i * 2.4, -Math.PI / 2, 3.2);
  }

  const carcassMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.woodPanel, shelfCarcasses.length);
  shelfCarcasses.forEach((m, i) => carcassMesh.setMatrixAt(i, m));
  carcassMesh.instanceMatrix.needsUpdate = true;
  add(carcassMesh, true, true);

  const rowMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.books, rowMatrices.length);
  rowMatrices.forEach((m, i) => rowMesh.setMatrixAt(i, m));
  rowMesh.instanceMatrix.needsUpdate = true;
  add(rowMesh, false, true);

  // A reading chair and side table in the stacks.
  chair(-3.1, -58.6, 0.9);
  box(0.9, 0.06, 0.7, M.wood, -2.6, W.floorY + 0.62, -57.6);
  box(0.1, 0.62, 0.1, M.woodPanel, -2.6, W.floorY + 0.31, -57.6);
  const readerLamp = lamp(-2.6, -57.6, 0.9);
  readerLamp.position.y = W.floorY + 0.68;

  // A rolling ladder against the stacks — quiet, but it says library.
  box(0.08, 3.6, 0.08, M.wood, W.hallHalf - 1.1, W.floorY + 1.8, -62);
  box(0.08, 3.6, 0.08, M.wood, W.hallHalf - 1.1, W.floorY + 1.8, -62.6);
  for (let i = 0; i < 7; i += 1) {
    box(0.07, 0.05, 0.62, M.wood, W.hallHalf - 1.1, W.floorY + 0.5 + i * 0.45, -62.3, { cast: false });
  }

  // ----------------------------------------------------------
  //  VIII. THE READING TABLE
  // ----------------------------------------------------------
  const T_Z = W.tableZ;
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 1.6), M.wood);
  tableTop.position.set(0, W.tableTopY - 0.05, T_Z);
  add(tableTop);
  box(3.3, 0.14, 1.4, M.woodPanel, 0, W.tableTopY - 0.17, T_Z);
  [[-1.5, 0.6], [1.5, 0.6], [-1.5, -0.6], [1.5, -0.6]].forEach(([x, dz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.66, 12), M.wood);
    leg.position.set(x, W.floorY + 0.33, T_Z + dz);
    add(leg);
  });
  // One chair, off to the side. A chair squared up behind the table
  // sits as a black slab directly behind the book in the final frame.
  chair(1.45, T_Z + 0.25, -1.5);
  chair(-1.6, T_Z - 1.15, 2.5);

  // What is on the table besides the book: a stack of papers, a pen,
  // reading glasses, a lamp, and the firm's seal.
  for (let i = 0; i < 6; i += 1) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.008, 0.44), M.paper);
    p.position.set(-1.15 + (i % 2) * 0.01, W.tableTopY + 0.005 + i * 0.009, T_Z + 0.12 + i * 0.008);
    p.rotation.y = 0.18 + i * 0.03;
    add(p, false, true);
  }
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.005, 0.15, 8), M.brass);
  pen.position.set(-0.86, W.tableTopY + 0.012, T_Z - 0.3);
  pen.rotation.set(0, 0.5, Math.PI / 2);
  add(pen);
  [[-0.06, 0], [0.06, 0]].forEach(([dx]) => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.005, 6, 20), M.steel);
    rim.position.set(1.02 + dx, W.tableTopY + 0.012, T_Z + 0.34);
    rim.rotation.x = Math.PI / 2;
    add(rim);
  });
  const tableLamp = lamp(1.32, T_Z - 0.42, 1.25);
  tableLamp.position.y = W.tableTopY + 0.005;
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.012, 32), M.plaque);
  seal.position.set(-0.55, W.tableTopY + 0.012, T_Z + 0.46);
  add(seal);

  // The plaque beside the entrance, and a matching one in the hall.
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), M.plaque);
  plate.position.set(DOOR_HALF + 0.75, W.floorY + 1.85, 0.06);
  target.add(plate);

  return {
    group,
    signMesh,
    winPanes,

    // Both halves are live across the threshold, where the opening
    // doors show one from inside the other.
    setVisibility(progress) {
      interior.visible = progress > 0.5;
      exterior.visible = progress < 0.655;
    },
  };
}
