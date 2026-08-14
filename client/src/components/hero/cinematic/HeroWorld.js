// ============================================================
//  THE WORLD
// ------------------------------------------------------------
//  Assembles the environment, the people, the door, the book,
//  the light and the camera into one object with a single input:
//  scroll progress, 0 → 1. Everything the visitor sees is a
//  function of that one number, which is what keeps the journey
//  continuous instead of a run of separate scenes.
// ============================================================
import * as THREE from 'three';
import { W, CUE, FOCUS_PATH, readQuality } from './hero.config.js';
import { buildMaterials } from './lib/materials.js';
import { buildEnvironment } from './HeroEnvironment.js';
import { buildDoor } from './HeroDoor.js';
import { buildBook } from './HeroBook.js';
import { buildCharacters, CUTOUTS } from './HeroCharacters.js';
import { buildLighting } from './HeroLighting.js';
import { createCamera } from './HeroCamera.js';
import { createPost } from './HeroPost.js';
import { sampleTrack, span, smoothstep, lerp, clamp } from './lib/util.js';
import { disposeTextures } from './lib/textures.js';
import signWallUrl from '../../../assets/journey/signage.webp';

const SKY_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const SKY_FRAG = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  varying vec3 vPos;
  void main() {
    float h = clamp(normalize(vPos).y * 1.6 + 0.14, 0.0, 1.0);
    gl_FragColor = vec4(mix(uHorizon, uZenith, pow(h, 0.75)), 1.0);
  }
`;

const FOG = {
  street: { color: new THREE.Color(0xc2c0b8), near: 28, far: 132 },
  interior: { color: new THREE.Color(0x1a1815), near: 7, far: 78 },
  library: { color: new THREE.Color(0x100f0d), near: 5, far: 56 },
};

export function createWorld({ canvas, stats, onProgress }) {
  const quality = readQuality();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false, // resolved by the multisampled render target instead
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.setSize(canvas.clientWidth || 1, canvas.clientHeight || 1, false);
  renderer.shadowMap.enabled = quality.shadows;
  // PCF rather than PCFSoft: nine taps per fragment for the sun's
  // shadow is not worth it once film grain is over the top of it.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // The sun is fixed and the architecture it shadows never moves, so
  // the shadow pass — which walks every caster in the scene, in frame
  // or not — is re-run only when something that casts one has actually
  // changed: the first frame after build, and while the book is
  // turning open under the lamp.
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  const fog = new THREE.Fog(FOG.street.color.clone(), FOG.street.near, FOG.street.far);
  scene.fog = fog;
  scene.background = fog.color;

  const rig = createCamera((canvas.clientWidth || 16) / (canvas.clientHeight || 9), reduceMotion);

  // ---- sky --------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(220, 24, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        uHorizon: { value: new THREE.Color(0xcecac0) },
        uZenith: { value: new THREE.Color(0x848a92) },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // An environment map baked from that same sky. Without one, every
  // glossy surface in the world — the brass, the glazing, the polished
  // floor — has nothing to reflect and reads as flat plastic. Its
  // intensity is pulled down on the way in, because a building's
  // interior does not see the sky.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(sky.geometry, sky.material);
  envScene.add(envSky);
  const envRT = pmrem.fromScene(envScene, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 1;
  pmrem.dispose();

  // ---- assets ------------------------------------------------
  const manager = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(manager);
  const portraits = {};
  const assets = {};

  Object.entries(CUTOUTS).forEach(([id, url]) => {
    portraits[id] = loader.load(url);
    portraits[id].colorSpace = THREE.SRGBColorSpace;
    portraits[id].anisotropy = 8;
  });
  assets.signWall = loader.load(signWallUrl);
  assets.signWall.colorSpace = THREE.SRGBColorSpace;

  let materials = null;
  let env = null;
  let door = null;
  let book = null;
  let cast = null;
  let lighting = null;
  let post = null;
  let ready = false;

  manager.onProgress = (_url, loaded, total) => onProgress?.(loaded / Math.max(1, total) * 0.8);

  const built = new Promise((resolve) => {
    manager.onLoad = () => {
      materials = buildMaterials();
      onProgress?.(0.88);

      env = buildEnvironment(materials, quality, assets);
      scene.add(env.group);

      door = buildDoor(materials, quality);
      scene.add(door.group);

      book = buildBook(materials, stats);
      scene.add(book.group);

      cast = buildCharacters(materials, quality, portraits);
      scene.add(cast.group);

      lighting = buildLighting(scene, quality);
      post = createPost(renderer, scene, rig.camera, quality);
      post.uniforms.uNear.value = rig.camera.near;
      post.uniforms.uFar.value = rig.camera.far;

      ready = true;
      onProgress?.(1);
      resolve();
    };
  });

  let progress = 0;
  let elapsed = 0;
  let shadowPhase = -1;
  const fogColor = new THREE.Color();

  function applyProgress(p, time) {
    // --- fog and sky hand over from daylight to interior ---
    const inside = smoothstep(span(p, CUE.interior));
    const deep = smoothstep(span(p, CUE.library));
    fogColor.copy(FOG.street.color).lerp(FOG.interior.color, inside).lerp(FOG.library.color, deep);
    fog.color.copy(fogColor);
    fog.near = lerp(lerp(FOG.street.near, FOG.interior.near, inside), FOG.library.near, deep);
    fog.far = lerp(lerp(FOG.street.far, FOG.interior.far, inside), FOG.library.far, deep);
    sky.visible = p < 0.7;
    env.setVisibility(p);
    scene.environmentIntensity = lerp(1, 0.16, inside) * lerp(1, 0.6, deep);

    // Re-bake shadows only when the set of casters changes: crossing
    // the threshold swaps half the world in and out, and the book
    // turning open moves a shadow under the reading lamp.
    const phase = p > 0.88 ? 2 : p > 0.45 ? 1 : 0;
    if (quality.shadows && (phase !== shadowPhase || phase === 2)) {
      shadowPhase = phase;
      renderer.shadowMap.needsUpdate = true;
    }

    // --- the name resolves on the entablature ---
    materials.signage.opacity = smoothstep(span(p, CUE.signage)) * (1 - inside);

    // --- the door, and the book ---
    door.set(span(p, CUE.door));
    book.set(span(p, CUE.book));

    lighting.update(p, rig.camera);
    cast.tint(lighting.levels.street, lighting.levels.interior);
    cast.update(p, time, rig.camera);

    // --- where the lens is focused, and how hard it falls away ---
    const f = sampleTrack(FOCUS_PATH, p, (k) => [k.focus, k.blur]);
    post.uniforms.uFocus.value = f[0];
    post.uniforms.uBlur.value = quality.dof ? f[1] : 0;
    // The frame settles as the spread opens: less grain, deeper corners.
    const close = smoothstep(span(p, CUE.close));
    post.uniforms.uVignette.value = lerp(0.8, 1.3, close);
    post.uniforms.uGrain.value = lerp(0.045, 0.028, close);
    post.uniforms.uExposure.value = lerp(0.88, 1.12, inside) * lerp(1, 0.94, deep) * lerp(1, 0.74, close);
  }

  return {
    quality,
    reduceMotion,
    ready: built,

    get isReady() {
      return ready;
    },

    setProgress(p) {
      progress = clamp(p);
    },

    // A single still, for the reduced-motion and no-scroll cases.
    renderStill(p) {
      if (!ready) return;
      progress = clamp(p);
      applyProgress(progress, 0);
      rig.update(progress, 0, 1);
      applyProgress(progress, 0);
      post.render(0);
    },

    tick(dt) {
      if (!ready) return;
      elapsed += dt;
      rig.update(progress, elapsed, dt);
      applyProgress(progress, elapsed);
      post.render(elapsed);
    },

    resize() {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
      renderer.setSize(w, h, false);
      rig.resize(w / h);
      post?.resize();
    },

    // Teardown only — nothing here runs while the hero is on screen, so none of
    // it can affect what is rendered.
    //
    // Order matters: every GPU resource is released *before* the renderer, because
    // a texture's dispose() works by notifying the renderer to free its binding.
    // Disposing the renderer first leaves those calls with nothing listening, and
    // the memory sits there until the context is eventually lost.
    dispose() {
      post?.dispose();

      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => m.dispose());
      });

      // The photographs, which are loaded rather than drawn.
      Object.values(portraits).forEach((t) => t.dispose());
      assets.signWall?.dispose();

      // The procedural surfaces. These live in a module-level cache shared by
      // every material in the world, so a material's dispose() does not reach
      // them — traversing the scene frees the materials, not their maps. The
      // cache is cleared with them, so a later mount redraws rather than reusing
      // a texture whose GPU allocation has gone.
      disposeTextures();

      // The environment map: a render target that is reachable from
      // scene.environment but not from any object, so the traversal above cannot
      // see it. The scene's reference is dropped first so nothing holds it.
      scene.environment = null;
      envRT.dispose();

      renderer.dispose();
    },
  };
}

export { W, CUE };
