import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function initScene(canvas) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const gold = new THREE.Color('#c8a769');
  const goldDim = new THREE.Color('#7a6642');

  const group = new THREE.Group();
  const coreGeo = new THREE.IcosahedronGeometry(2.15, 1);
  const edges = new THREE.EdgesGeometry(coreGeo);
  const coreLines = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: gold, transparent: true, opacity: 0.55 }));
  group.add(coreLines);

  const fill = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: '#0c0c0d', transparent: true, opacity: 0.55 }));
  group.add(fill);

  const ringGeo = new THREE.TorusGeometry(3.1, 0.004, 8, 120);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: goldDim, transparent: true, opacity: 0.5 }));
  ring.rotation.x = Math.PI / 2.3;
  group.add(ring);

  const ring2 = new THREE.Mesh(ringGeo.clone(), new THREE.MeshBasicMaterial({ color: goldDim, transparent: true, opacity: 0.28 }));
  ring2.rotation.x = Math.PI / 1.6;
  ring2.rotation.y = 0.4;
  group.add(ring2);

  group.position.set(2.6, 0.2, 0);
  scene.add(group);

  const particleCount = 140;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 16;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 2;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(particleGeo, new THREE.PointsMaterial({ color: '#d8bb85', size: 0.028, transparent: true, opacity: 0.45 }));
  scene.add(particles);

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
  if (!reduceMotion) window.addEventListener('pointermove', onPointerMove);
  onResize();

  let raf;
  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    if (!reduceMotion) {
      targetRotY += (mouseX * 0.35 - targetRotY) * 0.03;
      targetRotX += (mouseY * 0.2 - targetRotX) * 0.03;
      group.rotation.y = t * 0.12 + targetRotY;
      group.rotation.x = t * 0.05 + targetRotX;
      ring.rotation.z = t * 0.08;
      ring2.rotation.z = -t * 0.06;
      particles.rotation.y = t * 0.015;
    }
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

export default function Hero3D({ className }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cleanup;
    try { cleanup = initScene(canvasRef.current); } catch (e) { console.warn('Hero 3D disabled:', e); }
    return () => cleanup?.();
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}
