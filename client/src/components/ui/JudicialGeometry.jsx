import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const IVORY = '#f3ede0';
const GOLD = '#a9834f';
const GOLD_SOFT = '#d3b17f';
const GOLD_DIM = '#7a6642';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Linear walk across a chain of waypoints, used to move a point "through" the structure.
function pointAlongPath(waypoints, t) {
  const segCount = waypoints.length - 1;
  const scaled = t * segCount;
  const segIdx = Math.max(0, Math.min(segCount - 1, Math.floor(scaled)));
  const localT = scaled - segIdx;
  return waypoints[segIdx].clone().lerp(waypoints[segIdx + 1], localT);
}

// The lattice reads as apex (judgment) -> tiered reasoning chambers -> base (execution),
// with a plumb-line spine tying the two ends together — never a literal building or icon.
function buildLattice(isMobile) {
  const nodesPerTier = isMobile ? 5 : 6;
  const tierY = [1.55, 0, -1.55];
  const tierRadius = [0.8, 1.45, 2.05];

  const tiers = tierY.map((y, ti) => {
    const radius = tierRadius[ti];
    const nodes = [];
    for (let i = 0; i < nodesPerTier; i++) {
      const angle = (i / nodesPerTier) * Math.PI * 2 + ti * 0.36;
      const jitterR = radius * (0.9 + Math.random() * 0.18);
      const jitterZ = (Math.random() - 0.5) * 0.45;
      nodes.push(new THREE.Vector3(Math.cos(angle) * jitterR, y, Math.sin(angle) * jitterR + jitterZ));
    }
    return nodes;
  });

  const apex = new THREE.Vector3(0, 2.55, 0);
  const base = new THREE.Vector3(0, -2.55, 0);
  return { tiers, apex, base, nodesPerTier };
}

function toSegmentArray(pairs) {
  const positions = new Float32Array(pairs.length * 6);
  pairs.forEach(([a, b], i) => {
    positions[i * 6] = a.x; positions[i * 6 + 1] = a.y; positions[i * 6 + 2] = a.z;
    positions[i * 6 + 3] = b.x; positions[i * 6 + 4] = b.y; positions[i * 6 + 5] = b.z;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geo;
}

function makeLineGroup(pairs, color, baseOpacity, start, dur) {
  const geo = toSegmentArray(pairs);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
  const mesh = new THREE.LineSegments(geo, mat);
  mesh.userData = { base: baseOpacity, start, dur };
  return mesh;
}

function initScene(canvas, scrollRef) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 760px)').matches;
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));

  const group = new THREE.Group();
  group.position.set(2.6, 0.15, 0);
  scene.add(group);

  const { tiers, apex, base, nodesPerTier } = buildLattice(isMobile);
  const allNodes = tiers.flat();

  // Spine — the plumb line running from judgment to execution; appears first.
  const spine = makeLineGroup([[apex, base]], IVORY, 0.5, 0.2, 1.5);
  group.add(spine);

  // Radial links — apex fanning down into the top tier, bottom tier converging to base.
  const radialPairs = [
    ...tiers[0].map((n) => [apex, n]),
    ...tiers[2].map((n) => [n, base]),
  ];
  const radialLines = makeLineGroup(radialPairs, GOLD, 0.3, 0.95, 1.6);
  group.add(radialLines);

  // Lattice — ring edges per tier plus a sparse truss between tiers (never a closed cage).
  const latticePairs = [];
  tiers.forEach((ring) => {
    for (let i = 0; i < ring.length; i++) latticePairs.push([ring[i], ring[(i + 1) % ring.length]]);
  });
  for (let t = 0; t < tiers.length - 1; t++) {
    const a = tiers[t], b = tiers[t + 1];
    for (let i = 0; i < a.length; i += 2) {
      latticePairs.push([a[i], b[i % b.length]]);
      latticePairs.push([a[i], b[(i + 1) % b.length]]);
    }
  }
  const latticeLines = makeLineGroup(latticePairs, GOLD_DIM, 0.26, 1.75, 1.8);
  group.add(latticeLines);

  // Chords — a few long cross-references between distant tiers, evoking precedent.
  const chordPairs = [];
  if (!isMobile) {
    for (let i = 0; i < tiers[0].length; i += 2) {
      chordPairs.push([tiers[0][i], tiers[2][(i + 2) % tiers[2].length]]);
    }
  }
  const chordLines = makeLineGroup(chordPairs, GOLD_SOFT, 0.18, 2.75, 1.8);
  group.add(chordLines);

  // Node markers at apex/base — the two poles the whole structure resolves between.
  const markerPositions = new Float32Array([apex.x, apex.y, apex.z, base.x, base.y, base.z]);
  const markerGeo = new THREE.BufferGeometry();
  markerGeo.setAttribute('position', new THREE.BufferAttribute(markerPositions, 3));
  const markerMat = new THREE.PointsMaterial({ color: IVORY, size: 0.05, transparent: true, opacity: 0, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const markers = new THREE.Points(markerGeo, markerMat);
  markers.userData = { base: 0.62, start: 0.2, dur: 1.5 };
  group.add(markers);

  // Ambient particles — ungrouped drift, present from the very first frame.
  const particleCount = isMobile ? 40 : 90;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 7.5;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 7.5;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({ color: GOLD_SOFT, size: 0.022, transparent: true, opacity: 0, sizeAttenuation: true });
  const particles = new THREE.Points(particleGeo, particleMat);
  particles.userData = { base: 0.38, start: 0, dur: 2.2 };
  group.add(particles);

  // Traveling points — reasoning moving through the structure, apex to base and back.
  const mid = Math.floor(nodesPerTier / 2);
  const travelPaths = [
    [apex, base],
    [apex, tiers[0][0], tiers[1][0], tiers[2][0], base],
  ];
  if (!isMobile) travelPaths.push([apex, tiers[0][mid], tiers[1][(mid + 1) % nodesPerTier], tiers[2][mid], base]);
  const travelSpeeds = [0.07, 0.05, 0.06];
  const travelPhases = [0, 0.4, 0.75];

  const travelGeo = new THREE.BufferGeometry();
  const travelPositions = new Float32Array(travelPaths.length * 3);
  travelGeo.setAttribute('position', new THREE.BufferAttribute(travelPositions, 3));
  const travelMat = new THREE.PointsMaterial({ color: IVORY, size: 0.06, transparent: true, opacity: 0, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const travelers = new THREE.Points(travelGeo, travelMat);
  travelers.userData = { base: 0.85, start: 2.6, dur: 1.4 };
  group.add(travelers);
  // Rest each traveler at its path midpoint once, for the reduced-motion static state.
  travelPaths.forEach((path, i) => {
    const p = pointAlongPath(path, 0.5);
    travelPositions[i * 3] = p.x; travelPositions[i * 3 + 1] = p.y; travelPositions[i * 3 + 2] = p.z;
  });

  const revealables = [spine, radialLines, latticeLines, chordLines, markers, particles, travelers];

  if (reduceMotion) {
    group.rotation.set(0.1, 0.42, 0);
  }

  let targetRotX = 0, targetRotY = 0, mouseX = 0, mouseY = 0;

  function onResize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  function onPointerMove(e) {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  window.addEventListener('resize', onResize);
  if (!reduceMotion && !isCoarsePointer) window.addEventListener('pointermove', onPointerMove);
  onResize();

  let raf;
  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    const scrollProgress = clamp01(scrollRef.current || 0);
    const dissolve = smoothstep(0, 0.85, scrollProgress);

    if (!reduceMotion) {
      targetRotY += (mouseX * 0.22 - targetRotY) * 0.025;
      targetRotX += (mouseY * 0.12 - targetRotX) * 0.025;
      group.rotation.y = t * 0.028 + targetRotY + dissolve * t * 0.05;
      group.rotation.x = 0.05 + t * 0.012 + targetRotX;
      particles.rotation.y = t * 0.02;

      travelPaths.forEach((path, i) => {
        const raw = t * travelSpeeds[i] + travelPhases[i];
        const tri = 1 - Math.abs(((raw % 2) + 2) % 2 - 1);
        const p = pointAlongPath(path, tri);
        travelPositions[i * 3] = p.x; travelPositions[i * 3 + 1] = p.y; travelPositions[i * 3 + 2] = p.z;
      });
      travelGeo.attributes.position.needsUpdate = true;
    }

    group.scale.setScalar(1 + dissolve * 0.22);
    particles.scale.setScalar(1 + dissolve * 0.3);

    revealables.forEach((mesh) => {
      const { base: baseOpacity, start, dur } = mesh.userData;
      const reveal = easeOutCubic(clamp01((t - start) / dur));
      mesh.material.opacity = baseOpacity * reveal * (1 - dissolve);
    });

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();
  canvas.classList.add('is-ready');

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointerMove);
    renderer.dispose();
  };
}

export default function JudicialGeometry({ className, scrollRef }) {
  const canvasRef = useRef(null);
  const fallbackScrollRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cleanup;
    try { cleanup = initScene(canvasRef.current, scrollRef || fallbackScrollRef); } catch (e) { console.warn('Judicial geometry disabled:', e); }
    return () => cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}
