// ============================================================
//  THE PEOPLE
// ------------------------------------------------------------
//  The advocates are the firm's own photographs, matted and
//  stood up in the world as depth cards — real faces, never
//  invented ones. Clients and passers-by are drawn silhouettes
//  for the same reason: at that distance a made-up face would
//  only be a lie you cannot quite see.
//
//  Motion is deliberately small. This is a law firm at work,
//  not a crowd simulation: a shift of weight, a turn of the
//  head, someone crossing the room with a file.
// ============================================================
import * as THREE from 'three';
import { ADVOCATES, CROSSING, FIGURES, W } from './hero.config.js';
import { clamp, lerp, span, smoothstep } from './lib/util.js';
import * as T from './lib/textures.js';

import sridhar from '../../../assets/team/cutout/sridhar.webp';
import lakshman from '../../../assets/team/cutout/lakshman.webp';
import aravind from '../../../assets/team/cutout/aravind.webp';
import manjula from '../../../assets/team/cutout/manjula.webp';
import ashok from '../../../assets/team/cutout/ashok.webp';
import vinesh from '../../../assets/team/cutout/vinesh.webp';
import karupak from '../../../assets/team/cutout/karupak.webp';
import akshay from '../../../assets/team/cutout/akshay.webp';
import pawan from '../../../assets/team/cutout/pawan.webp';
import karthik from '../../../assets/team/cutout/karthik.webp';
import bharath from '../../../assets/team/cutout/bharath.webp';

export const CUTOUTS = {
  sridhar, lakshman, aravind, manjula, ashok, vinesh,
  karupak, akshay, pawan, karthik, bharath,
};

const PLANE = new THREE.PlaneGeometry(1, 1);
const SHADOW = new THREE.PlaneGeometry(1, 1);

export function buildCharacters(M, quality, textures) {
  const group = new THREE.Group();
  const people = [];

  const shadowFor = (width, x, y, z) => {
    const s = new THREE.Mesh(SHADOW, M.shadow.clone());
    s.rotation.x = -Math.PI / 2;
    s.scale.set(width * 2.1, width * 1.5, 1);
    s.position.set(x, y + 0.012, z);
    s.renderOrder = 1;
    group.add(s);
    return s;
  };

  const billboard = (map, cfg) => {
    const aspect = map.image ? map.image.width / map.image.height : 0.5;
    const width = cfg.h * aspect;
    const mat = new THREE.MeshBasicMaterial({
      map, transparent: true, alphaTest: 0.32, depthWrite: true,
      color: 0xffffff, fog: true, side: THREE.FrontSide,
    });
    const mesh = new THREE.Mesh(PLANE, mat);
    mesh.scale.set(width, cfg.h, 1);
    const ground = cfg.pos[1];
    mesh.position.set(cfg.pos[0], ground + cfg.base + cfg.h / 2, cfg.pos[2]);
    mesh.rotation.y = cfg.yaw || 0;
    if (quality.shadows) mesh.castShadow = false;
    group.add(mesh);

    const rec = {
      mesh, mat, cfg, width,
      home: mesh.position.clone(),
      restYaw: cfg.yaw || 0,
      phase: Math.random() * Math.PI * 2,
      shadow: null,
      mirror: null,
    };

    // Contact shadow — only where the figure meets a floor we can see.
    if (cfg.base < 0.5) rec.shadow = shadowFor(width, cfg.pos[0], ground, cfg.pos[2]);

    // A soft reflection in the polished interior floor.
    if (quality.reflections && cfg.zone !== 'street') {
      // DoubleSide: the negative Y scale that flips the image also
      // flips the winding, so a front-facing plane would vanish.
      const mirror = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({
        map, transparent: true, opacity: 0.14, depthWrite: false,
        alphaTest: 0.32, fog: true, side: THREE.DoubleSide,
      }));
      mirror.scale.set(width, -cfg.h, 1);
      mirror.position.set(cfg.pos[0], ground - cfg.base - cfg.h / 2 + 0.002, cfg.pos[2]);
      mirror.rotation.y = cfg.yaw || 0;
      mirror.renderOrder = 1;
      group.add(mirror);
      rec.mirror = mirror;
    }

    people.push(rec);
    return rec;
  };

  ADVOCATES.forEach((cfg) => {
    const map = textures[cfg.id];
    if (map) billboard(map, cfg);
  });

  // The advocate who walks across the lens inside the chambers.
  let crossing = null;
  if (textures[CROSSING.id]) {
    // He stays square to the lens as he crosses. A photograph turned
    // side-on has nothing behind it — the illusion only survives while
    // the figure faces the camera, so the crossing sells itself on
    // travel and defocus instead of on rotation.
    crossing = billboard(textures[CROSSING.id], {
      ...CROSSING, pos: CROSSING.from, zone: 'interior', yaw: 0, face: 0.9, motion: 'cross',
    });
  }

  // Clients and passers-by. The tier trims the crowd on the street; the
  // two interior figures always stay, because losing them would empty
  // rooms the story needs to look occupied.
  const figs = [
    ...FIGURES.filter((f) => !f.interior).slice(0, quality.silhouettes),
    ...FIGURES.filter((f) => f.interior),
  ];
  figs.forEach((f) => {
    const map = T.silhouette(f.v);
    const aspect = map.image.width / map.image.height;
    const width = f.h * aspect;
    const mat = new THREE.MeshBasicMaterial({
      map, transparent: true, alphaTest: 0.12, depthWrite: true,
      color: 0x4a463f, fog: true, opacity: 0.95,
    });
    const mesh = new THREE.Mesh(PLANE, mat);
    mesh.scale.set(width, f.h, 1);
    mesh.position.set(f.pos[0], f.pos[1] + f.h / 2, f.pos[2]);
    mesh.rotation.y = f.yaw || 0;
    group.add(mesh);
    people.push({
      mesh, mat, width, cfg: { ...f, motion: f.walk ? 'walk' : 'idle', face: 0.15, base: 0 },
      home: mesh.position.clone(), restYaw: f.yaw || 0, phase: Math.random() * 6.28,
      shadow: shadowFor(width * 0.8, f.pos[0], f.pos[1], f.pos[2]),
      mirror: null, silhouette: true,
    });
  });

  // Scratch vectors, hoisted: nothing in the tick loop allocates.
  const camDir = new THREE.Vector3();

  return {
    group,
    people,

    // Tint every figure to the light of the room they are standing in,
    // so the photographs sit inside the scene instead of on top of it.
    tint(streetLevel, interiorLevel) {
      people.forEach((p) => {
        if (p.silhouette) return;
        const zone = p.cfg.zone;
        const v = zone === 'street' ? streetLevel : interiorLevel * (zone === 'library' ? 0.82 : 1);
        p.mat.color.setScalar(v);
        if (p.mirror) p.mirror.material.color.setScalar(v);
      });
    },

    update(progress, time, camera) {
      camera.getWorldDirection(camDir);
      const camYaw = Math.atan2(-camDir.x, -camDir.z);

      people.forEach((p) => {
        const { cfg } = p;
        const t = time + p.phase;
        let { x, z } = p.home;
        let y = p.home.y;
        let yaw = p.restYaw;

        if (cfg.motion === 'walk' && cfg.walk) {
          const to = Array.isArray(cfg.walk) ? cfg.walk : cfg.walk.to;
          const range = Array.isArray(cfg.walk) ? cfg.span : cfg.walk.span;
          const k = smoothstep(span(progress, range));
          x = lerp(cfg.pos[0], to[0], k);
          z = lerp(cfg.pos[2], to[2], k);
          y = p.home.y + Math.sin(t * 5.2) * 0.014;
          yaw = Math.atan2(to[0] - cfg.pos[0], to[2] - cfg.pos[2]);
        } else if (cfg.motion === 'cross') {
          // Staged relative to the lens, not to the room: the camera
          // covers fifteen metres inside this window, so a figure
          // parked at a fixed z would be behind it before he arrived.
          // Held a metre and a half in front, he wipes the frame — the
          // physical object that carries the cut the sequence never makes.
          const k = clamp(span(progress, CROSSING.span));
          x = camera.position.x + camDir.x * CROSSING.ahead + lerp(-3.4, 3.4, k);
          z = camera.position.z + camDir.z * CROSSING.ahead;
          y = (cfg.pos[1] ?? W.floorY) + cfg.h / 2 + Math.sin(k * 34) * 0.018;
          p.mesh.visible = k > 0.002 && k < 0.998;
        } else if (cfg.motion === 'talk') {
          yaw += Math.sin(t * 0.42) * 0.055;
          y += Math.sin(t * 1.1) * 0.006;
        } else if (cfg.motion === 'read' || cfg.motion === 'desk') {
          yaw += Math.sin(t * 0.32) * 0.03;
          y += Math.sin(t * 0.9) * 0.004;
        } else {
          y += Math.sin(t * 0.7) * 0.004;
        }

        // Turn toward the lens, but only as far as the figure is allowed:
        // a standing photograph that always squares up reads as cardboard.
        const face = cfg.face ?? 0.3;
        if (face > 0) {
          const toCam = Math.atan2(camera.position.x - x, camera.position.z - z);
          let d = toCam - yaw;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          yaw += d * face;
        } else {
          yaw = lerp(yaw, camYaw, 0.05);
        }

        p.mesh.position.set(x, y, z);
        p.mesh.rotation.y = yaw;
        if (p.shadow) {
          p.shadow.position.x = x;
          p.shadow.position.z = z;
          p.shadow.visible = p.mesh.visible;
        }
        if (p.mirror) {
          p.mirror.position.set(x, 2 * (cfg.pos[1] ?? W.floorY) - y, z);
          p.mirror.rotation.y = yaw;
        }
      });
    },
  };
}
