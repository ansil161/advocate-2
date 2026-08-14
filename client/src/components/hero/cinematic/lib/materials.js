// Shared materials. One instance per surface type, reused across the
// whole world so the renderer batches state changes instead of
// rebinding a new program for every desk and shelf.
import * as THREE from 'three';
import * as T from './textures.js';

function repeat(tex, x, y) {
  const t = tex.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(x, y);
  t.needsUpdate = true;
  return t;
}

export function buildMaterials() {
  const stoneTex = T.stone();
  const woodDark = T.wood('dark');
  const woodMid = T.wood('mid');
  const marbleTex = T.marble();

  const M = {
    // — exterior —
    facade: new THREE.MeshStandardMaterial({
      map: repeat(stoneTex, 6, 3), bumpMap: repeat(stoneTex, 6, 3), bumpScale: 0.035,
      roughness: 0.94, metalness: 0,
    }),
    facadeTall: new THREE.MeshStandardMaterial({
      map: repeat(stoneTex, 3, 4), bumpMap: repeat(stoneTex, 3, 4), bumpScale: 0.03,
      roughness: 0.94, metalness: 0,
    }),
    stone: new THREE.MeshStandardMaterial({
      map: repeat(stoneTex, 1, 1), roughness: 0.9, metalness: 0, color: 0xe8e4da,
    }),
    stoneDark: new THREE.MeshStandardMaterial({
      map: repeat(stoneTex, 2, 1), roughness: 0.88, metalness: 0, color: 0x8f8b82,
    }),
    column: new THREE.MeshStandardMaterial({
      map: repeat(stoneTex, 1, 3), bumpMap: repeat(stoneTex, 1, 3), bumpScale: 0.02,
      roughness: 0.86, metalness: 0, color: 0xf2eee4,
    }),
    pavement: new THREE.MeshStandardMaterial({
      map: repeat(T.pavement(), 26, 26), bumpMap: repeat(T.pavement(), 26, 26), bumpScale: 0.02,
      roughness: 0.97, metalness: 0,
    }),
    road: new THREE.MeshStandardMaterial({ color: 0x1c1c1b, roughness: 0.98, metalness: 0 }),
    distant: new THREE.MeshStandardMaterial({ color: 0x8e8b85, roughness: 1, metalness: 0 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x33352f, roughness: 1, metalness: 0, flatShading: true }),
    bark: new THREE.MeshStandardMaterial({ color: 0x2a2823, roughness: 1, metalness: 0 }),

    // — thresholds and joinery —
    wood: new THREE.MeshStandardMaterial({
      map: repeat(woodDark, 1, 1), bumpMap: repeat(woodDark, 1, 1), bumpScale: 0.02,
      roughness: 0.52, metalness: 0.04,
    }),
    woodPanel: new THREE.MeshStandardMaterial({
      map: repeat(woodDark, 1, 2), roughness: 0.46, metalness: 0.05,
    }),
    // The entrance doors sit in the shade of the portico all day, so
    // they get their own lighter, more polished stock — otherwise the
    // arrival plays out against two black rectangles.
    doorLeaf: new THREE.MeshStandardMaterial({
      map: repeat(woodMid, 1, 2), bumpMap: repeat(woodMid, 1, 2), bumpScale: 0.015,
      roughness: 0.52, metalness: 0.04, color: 0xb6aea0,
    }),
    doorPanel: new THREE.MeshStandardMaterial({
      map: repeat(woodMid, 1, 1), roughness: 0.42, metalness: 0.06, color: 0xa79f92,
    }),
    woodWarm: new THREE.MeshStandardMaterial({
      map: repeat(woodMid, 1, 1), roughness: 0.55, metalness: 0.03,
    }),
    brass: new THREE.MeshStandardMaterial({ color: 0x9a8055, roughness: 0.32, metalness: 0.85 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x4a4a48, roughness: 0.42, metalness: 0.6 }),

    // — interior —
    // Polished, but not a mirror: at 0.24 roughness every lamp threw a
    // hard pool on the floor and the hall read as a nightclub.
    floor: new THREE.MeshStandardMaterial({
      map: repeat(marbleTex, 16, 40), roughness: 0.6, metalness: 0.03, color: 0xaeaaa1,
    }),
    wall: new THREE.MeshStandardMaterial({ color: 0xb4afa4, roughness: 0.94, metalness: 0 }),
    wallDeep: new THREE.MeshStandardMaterial({ color: 0x5c584f, roughness: 0.95, metalness: 0 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0x83807a, roughness: 1, metalness: 0 }),
    // Roughness 0.06 turned each partition into a mirror that caught
    // a lamp and threw a soft white blob into the middle of the hall.
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xdfe1e0, roughness: 0.34, metalness: 0, transparent: true, opacity: 0.1,
      transmission: 0, side: THREE.DoubleSide, depthWrite: false,
    }),
    books: new THREE.MeshStandardMaterial({ map: T.bookRow(), roughness: 0.86, metalness: 0 }),
    paper: new THREE.MeshStandardMaterial({ map: T.paper(), color: 0xb8b3a9, roughness: 0.92, metalness: 0, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 0.9, metalness: 0 }),
    // The building's own glazing: dark, but glossy enough to take a
    // reflection of the sky, which is what stops the upper storeys
    // reading as rows of black holes punched in the stone.
    glazing: new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.14, metalness: 0.55 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x24211d, roughness: 0.72, metalness: 0.05 }),

    // — light-emitting surfaces —
    window: new THREE.MeshBasicMaterial({ map: T.windowPane(), color: 0xb9b7ae, toneMapped: true, fog: true }),
    windowFar: new THREE.MeshBasicMaterial({ map: T.windowPane(), color: 0x9d9b93, toneMapped: true, fog: true }),
    lampShade: new THREE.MeshStandardMaterial({
      color: 0xd9d2c2, roughness: 0.6, emissive: 0xffe9c8, emissiveIntensity: 0.9,
      side: THREE.DoubleSide,
    }),
    signage: new THREE.MeshBasicMaterial({
      map: T.signage(), transparent: true, opacity: 0, depthWrite: false, fog: true,
    }),
    plaque: new THREE.MeshStandardMaterial({ map: T.plaque(), roughness: 0.5, metalness: 0.3 }),
    shadow: new THREE.MeshBasicMaterial({
      map: T.blob(), transparent: true, opacity: 0.5, color: 0x000000,
      depthWrite: false, fog: false,
    }),
  };

  // Anisotropy has to be applied after the textures exist.
  Object.values(M).forEach((m) => {
    if (m.map) m.map.anisotropy = 8;
  });

  return M;
}
