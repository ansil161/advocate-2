// ============================================================
//  GRADE + DEPTH OF FIELD
// ------------------------------------------------------------
//  The scene is rendered to a float target with its depth
//  attached, blurred once at half resolution, and composited in
//  a single pass that also tone-maps and grades it. Two reasons
//  for hand-rolling this instead of using BokehPass:
//
//   · the advocates are alpha-tested cut-outs. A depth-material
//     override (what BokehPass does) ignores their alpha, so
//     each one would blur as a rectangle. Reading the real depth
//     buffer keeps their silhouettes intact.
//   · one fullscreen pass for defocus, tone map, grade, vignette
//     and grain is considerably cheaper than a chain of them.
//
//  The grade is what turns eleven photographs taken in eleven
//  different rooms — mint, lavender, red — into one continuous
//  black-and-white world.
// ============================================================
import * as THREE from 'three';

const QUAD = new THREE.PlaneGeometry(2, 2);

const BLUR_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;
    sum += texture2D(tDiffuse, vUv + uDir * 1.3846153846) * 0.3162162162;
    sum += texture2D(tDiffuse, vUv - uDir * 1.3846153846) * 0.3162162162;
    sum += texture2D(tDiffuse, vUv + uDir * 3.2307692308) * 0.0702702703;
    sum += texture2D(tDiffuse, vUv - uDir * 3.2307692308) * 0.0702702703;
    gl_FragColor = sum;
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform sampler2D tBlur;
  uniform sampler2D tDepth;
  uniform vec2 uResolution;
  uniform float uNear;
  uniform float uFar;
  uniform float uFocus;
  uniform float uBlur;
  uniform float uTime;
  uniform float uGrain;
  uniform float uVignette;
  uniform float uMono;
  uniform float uExposure;
  uniform float uFade;
  varying vec2 vUv;

  float linearDepth(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    float z = d * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }

  // ACES filmic, fitted — the shoulder is what keeps the daylight on
  // the facade from clipping to paper white.
  vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 sharp = texture2D(tDiffuse, vUv).rgb;
    float depth = linearDepth(vUv);
    float coc = clamp(abs(depth - uFocus) / (uFocus * 0.85 + 0.6) * uBlur, 0.0, 1.0);
    coc = smoothstep(0.06, 0.85, coc);

    vec3 soft = texture2D(tBlur, vUv).rgb;
    vec3 col = mix(sharp, soft, coc);

    col *= uExposure;
    col = aces(col);
    col = pow(col, vec3(1.0 / 2.2));

    // Warm greyscale. A trace of colour is left in so the real
    // photographs keep their life instead of going to tin.
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    vec3 mono = vec3(luma) * vec3(1.012, 0.998, 0.972);
    col = mix(col, mono, uMono);

    // Gentle S-curve with a film-like lifted black.
    col = clamp((col - 0.5) * 1.075 + 0.5, 0.0, 1.0);
    col = col * 0.982 + 0.014;

    vec2 q = vUv - 0.5;
    float vig = 1.0 - dot(q, q) * uVignette;
    col *= clamp(vig, 0.0, 1.0);

    float g = hash(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5;
    col += g * uGrain * (0.55 + 0.9 * (1.0 - luma));

    col *= uFade;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export function createPost(renderer, scene, camera, quality) {
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);

  const sceneRT = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    samples: quality.antialias ? 2 : 0,
  });
  sceneRT.depthTexture = new THREE.DepthTexture(size.x, size.y);
  sceneRT.depthTexture.type = THREE.UnsignedIntType;

  const halfOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const blurA = new THREE.WebGLRenderTarget(size.x / 2, size.y / 2, halfOpts);
  const blurB = new THREE.WebGLRenderTarget(size.x / 2, size.y / 2, halfOpts);

  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: VERT,
    fragmentShader: BLUR_FRAG,
    depthTest: false,
    depthWrite: false,
  });

  const compMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: sceneRT.texture },
      tBlur: { value: blurB.texture },
      tDepth: { value: sceneRT.depthTexture },
      uResolution: { value: new THREE.Vector2(size.x, size.y) },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uFocus: { value: 20 },
      uBlur: { value: quality.dof ? 0.5 : 0 },
      uTime: { value: 0 },
      uGrain: { value: 0.042 },
      uVignette: { value: 0.85 },
      uMono: { value: 0.9 },
      uExposure: { value: 1.05 },
      uFade: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: COMPOSITE_FRAG,
    depthTest: false,
    depthWrite: false,
  });

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(QUAD, compMat);
  quad.frustumCulled = false;
  quadScene.add(quad);

  function blit(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(quadScene, quadCam);
  }

  return {
    uniforms: compMat.uniforms,

    render(time) {
      compMat.uniforms.uTime.value = time;

      renderer.setRenderTarget(sceneRT);
      renderer.clear();
      renderer.render(scene, camera);

      if (quality.dof && compMat.uniforms.uBlur.value > 0.001) {
        // Two separable passes at half resolution. One was not enough
        // for the near field — an advocate crossing a metre from the
        // lens has to dissolve, not merely soften.
        const hx = 1 / (size.x / 2);
        const hy = 1 / (size.y / 2);
        blurMat.uniforms.tDiffuse.value = sceneRT.texture;
        blurMat.uniforms.uDir.value.set(1.7 * hx, 0);
        blit(blurMat, blurA);
        blurMat.uniforms.tDiffuse.value = blurA.texture;
        blurMat.uniforms.uDir.value.set(0, 1.7 * hy);
        blit(blurMat, blurB);
        blurMat.uniforms.tDiffuse.value = blurB.texture;
        blurMat.uniforms.uDir.value.set(3.4 * hx, 0);
        blit(blurMat, blurA);
        blurMat.uniforms.tDiffuse.value = blurA.texture;
        blurMat.uniforms.uDir.value.set(0, 3.4 * hy);
        blit(blurMat, blurB);
      }

      quad.material = compMat;
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCam);
    },

    resize() {
      renderer.getDrawingBufferSize(size);
      sceneRT.setSize(size.x, size.y);
      blurA.setSize(size.x / 2, size.y / 2);
      blurB.setSize(size.x / 2, size.y / 2);
      compMat.uniforms.uResolution.value.set(size.x, size.y);
    },

    dispose() {
      sceneRT.dispose();
      sceneRT.depthTexture.dispose();
      blurA.dispose();
      blurB.dispose();
      blurMat.dispose();
      compMat.dispose();
      QUAD.dispose();
    },
  };
}
