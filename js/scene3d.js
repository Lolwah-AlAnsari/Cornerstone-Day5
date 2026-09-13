/* ==========================================================================
   SĀLFA — the hero scene in three dimensions.

   A dallah and a glass of iced coffee. Bodies of revolution (the pot, its
   lid, the tumbler) are lathes; the spout and handle are flat shapes extruded
   from curves, because on a real dallah they are cut from sheet; the straw and
   ice are a cylinder and boxes.

   Both objects turn on their own axis, and the pair can be dragged to spin
   with a little momentum. three.js is fetched from a CDN only when it will be used:
   never on mobile, never with reduced motion, never without WebGL. Every
   failure path leaves the flat CSS artwork in place.
   ========================================================================== */

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

/* Shared coordinate space for the dala: y runs downward, as in art.js. */
const POT_BASE = 116;
const POT_UNIT = 0.024;

/* --- the Arabic dala out front, modelled on a real one ---
   Two bulges with a pinched waist between them, an onion lid under a
   bulb-and-spike finial, a broad flat crescent blade for a spout, and an
   angular strap handle. The spout and handle are extruded flat shapes rather
   than swept tubes, because on a real dallah they are cut from sheet. */
const DALA_PROFILE = [
  [0, 116], [24, 116], [28, 113], [31, 106], [31, 98], [29, 89],
  [25, 81], [20, 75], [18, 71],                     // waist
  [19, 66], [22, 60], [25, 55], [26, 50],           // upper bulge
  [25, 46], [24, 43],                               // collar
  [25, 41], [24, 38], [21, 34], [15, 28], [8, 22], [4.5, 18],
];

/**
 * The crescent blade, drawn with curves rather than a point list — straight
 * segments between points turn the crescent into a wedge. Coordinates are in
 * the same space as the profiles; `p` maps them into the scene.
 */
function drawDalaSpout(shape, p) {
  // Wide where it meets the body, tapering to an actual point at the tip.
  // The first attempt ran the two edges nearly parallel, which made the blade
  // thicker at the tip than the base and read as a wedge rather than a crescent.
  shape.moveTo(...p(-17, 37));
  shape.bezierCurveTo(...p(-40, 21), ...p(-61, 19), ...p(-73, 29));  // top edge to the point
  shape.bezierCurveTo(...p(-57, 40), ...p(-37, 49), ...p(-17, 56));  // concave underside
  shape.closePath();
}

/** The strap handle: angular outside, angular hole, like the reference. */
function drawDalaHandle(shape, p) {
  shape.moveTo(...p(23, 45));
  shape.lineTo(...p(45, 54));
  shape.lineTo(...p(48, 90));
  shape.lineTo(...p(24, 97));
  shape.closePath();
}
function drawDalaHandleHole(path, p) {
  path.moveTo(...p(28, 53));
  path.lineTo(...p(40, 60));
  path.lineTo(...p(42, 84));
  path.lineTo(...p(28, 90));
  path.closePath();
}

/* --- iced coffee, from the 60×60 glyph --- */
const GLASS_PROFILE = [
  [0, 53], [8.6, 53], [10.6, 42], [12, 19],   // up the outside
  [11.2, 19], [9.8, 42], [7.8, 51.4], [0, 51.4], // and back down the inside
];
const GLASS_BASE = 53;
const GLASS_UNIT = 0.043;

const SAND = 0x9d7a45;
const COFFEE = 0x5b3418;

export function canRender3D() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.innerWidth < 900) return false;
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export async function mountHeroScene(container) {
  if (!canRender3D()) return null;

  let THREE;
  try {
    THREE = await import(/* @vite-ignore */ THREE_URL);
  } catch (error) {
    console.warn("[salfa] three.js unavailable, keeping the flat artwork:", error);
    return null;
  }

  const width = container.clientWidth || 460;
  const height = container.clientHeight || width;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
  camera.position.set(0, 1.15, 7.1);
  camera.lookAt(0, 0.95, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);

  /* A metal surface shows its surroundings, so without an environment to
     reflect a high-metalness material renders almost black. Rather than
     download an HDRI, paint a small sky-to-ground gradient and use that:
     bright above, warm cream at the horizon, dusk below. */
  const envCanvas = document.createElement("canvas");
  envCanvas.width = 128;              // equirectangular wants 2:1
  envCanvas.height = 64;
  const ectx = envCanvas.getContext("2d");
  const grad = ectx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.40, "#fdf6ea");
  grad.addColorStop(0.53, "#d6c2a2");
  grad.addColorStop(1, "#4b3d2e");
  ectx.fillStyle = grad;
  ectx.fillRect(0, 0, 128, 64);

  const envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;

  // Prefilter it. A raw equirect texture is not a usable reflection source for
  // roughness-based shading, which is why an unfiltered one leaves metal black.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromEquirectangular(envTex);
  scene.environment = envRT.texture;
  envTex.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7268, 1.1));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.1);
  key.position.set(3.2, 5, 4.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd9c3a2, 1.2);
  rim.position.set(-4, 2.4, -3);
  scene.add(rim);

  // Only the straw is left in the deeper sand tone.
  const brass = new THREE.MeshStandardMaterial({ color: SAND, metalness: 0.72, roughness: 0.34 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.08,
    transparent: true, opacity: 0.15, side: THREE.DoubleSide,
    clearcoat: 1, clearcoatRoughness: 0.06,
  });
  const coffee = new THREE.MeshStandardMaterial({ color: COFFEE, metalness: 0.05, roughness: 0.42 });
  const ice = new THREE.MeshPhysicalMaterial({
    color: 0xeaf2f6, roughness: 0.1, transparent: true, opacity: 0.62, clearcoat: 1,
  });

  const world = new THREE.Group();
  scene.add(world);

  const potY = (y) => (POT_BASE - y) * POT_UNIT;

  /* --------------------------- the iced coffee --------------------------- */
  const glassY = (y) => (GLASS_BASE - y) * GLASS_UNIT;
  const iced = new THREE.Group();

  iced.add(new THREE.Mesh(
    new THREE.LatheGeometry(GLASS_PROFILE.map(([r, y]) => new THREE.Vector2(r * GLASS_UNIT, glassY(y))), 72),
    glass
  ));

  // Liquid: a tapered cylinder sitting just inside the walls.
  const liquidTop = glassY(29), liquidBottom = glassY(51);
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(10.2 * GLASS_UNIT, 8 * GLASS_UNIT, liquidTop - liquidBottom, 48),
    coffee
  );
  liquid.position.y = (liquidTop + liquidBottom) / 2;
  iced.add(liquid);

  // Ice: a few cubes tumbled at different angles, mostly submerged.
  const cube = new THREE.BoxGeometry(5 * GLASS_UNIT, 5 * GLASS_UNIT, 5 * GLASS_UNIT);
  // Liquid surface is at y=29; these straddle it so the ice is visible.
  [
    [-3.4, 32, 1.5, 0.5, 0.3],
    [2.8, 37, -1.2, -0.4, 0.9],
    [0.2, 28, -2.4, 0.9, -0.5],
  ].forEach(([x, y, z, rx, ry]) => {
    const c = new THREE.Mesh(cube, ice);
    c.position.set(x * GLASS_UNIT, glassY(y), z * GLASS_UNIT);
    c.rotation.set(rx, ry, 0.3);
    iced.add(c);
  });

  // Straw, leaning out of the glass.
  const straw = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1 * GLASS_UNIT, 1.1 * GLASS_UNIT, 30 * GLASS_UNIT, 20),
    brass
  );
  straw.position.set(4 * GLASS_UNIT, glassY(24), -1 * GLASS_UNIT);
  straw.rotation.z = -0.32;
  iced.add(straw);

  // Same depth and same rendered height as the dala. The glass is naturally
  // shorter (about 1.86 units against the dala's 2.65), so it takes the larger
  // scale to finish the same size on screen.
  iced.position.set(0.92, 0, 0.2);
  iced.scale.setScalar(0.83);
  world.add(iced);

  /* ------------------------ the Arabic dala, in front ------------------------ */
  // Polished, but warmed towards the sand accent so it belongs to the palette
  // rather than reading as cold kitchen steel.
  const steel = new THREE.MeshStandardMaterial({
    color: 0xe8d9bd, metalness: 0.94, roughness: 0.09,
  });

  const dala = new THREE.Group();

  dala.add(new THREE.Mesh(
    new THREE.LatheGeometry(DALA_PROFILE.map(([r, y]) => new THREE.Vector2(r * POT_UNIT, potY(y))), 96),
    steel
  ));

  // Finial: a small bulb under a spike, the way the reference is topped.
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(4.4 * POT_UNIT, 24, 18), steel);
  bulb.position.y = potY(13);
  bulb.scale.y = 1.25;
  dala.add(bulb);

  const spike = new THREE.Mesh(
    new THREE.ConeGeometry(1.7 * POT_UNIT, 7 * POT_UNIT, 18),
    steel
  );
  spike.position.y = potY(5.5);
  dala.add(spike);

  // Flat parts are extruded shapes, not swept tubes: on a real dallah the
  // spout and handle are cut from sheet, and a round tube reads as a spigot.
  const flat = (draw, depth, drawHole) => {
    const p = (x, y) => [x * POT_UNIT, potY(y)];
    const shape = new THREE.Shape();
    draw(shape, p);
    if (drawHole) {
      const hole = new THREE.Path();
      drawHole(hole, p);
      shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: depth * 0.14,
      bevelSize: depth * 0.12,
      bevelSegments: 3,
      curveSegments: 24,
    });
    geo.translate(0, 0, -depth / 2);   // centre the thickness on the body
    return new THREE.Mesh(geo, steel);
  };

  dala.add(flat(drawDalaSpout, 4.2 * POT_UNIT));
  dala.add(flat(drawDalaHandle, 2.6 * POT_UNIT, drawDalaHandleHole));

  // Forward on Z, so perspective gives it presence without needing extra scale.
  dala.position.set(-0.92, 0, 0.2);
  dala.scale.setScalar(0.645);
  world.add(dala);

  /* --------------------------- motion + dragging --------------------------- */
  // Centre the pair in frame.
  world.position.y = -0.12;

  // Drag spins each object on its own axis. Rotating the parent group instead
  // would make the two orbit each other and swap sides, which wrecks the layout.
  let autoGlass = 0, autoDala = 0.3;   // the idle turn of each object
  let userSpin = 0;                    // what the visitor has added by dragging
  let spinVelocity = 0;                // momentum, eased back to rest
  let dragging = false;
  let lastX = 0, lastY = 0;
  let tilt = 0;

  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";

  const onDown = (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = "grabbing";
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    userSpin += dx * 0.008;
    tilt = Math.max(-0.42, Math.min(0.42, tilt + dy * 0.005));
    spinVelocity = dx * 0.0022;
  };
  const onUp = (e) => {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = "grab";
    canvas.releasePointerCapture?.(e.pointerId);
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onUp);

  let raf = 0;
  let last = performance.now();
  let running = true;

  const frame = (now) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    // Each object turns at its own pace, so the pair is never static.
    autoGlass += dt * 0.42;
    autoDala += dt * 0.24;   // slowest, so the nearest object is the calmest

    // Momentum from a drag decays back to the idle turn.
    if (!dragging) {
      userSpin += spinVelocity;
      spinVelocity *= 0.94;
      if (Math.abs(spinVelocity) < 0.00002) spinVelocity = 0;
    }

    iced.rotation.y = autoGlass + userSpin;
    dala.rotation.y = autoDala + userSpin;
    iced.rotation.x += (tilt - iced.rotation.x) * 0.08;
    dala.rotation.x += (tilt - dala.rotation.x) * 0.08;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const onVisibility = () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (!running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onResize = () => {
    const w = container.clientWidth || width;
    const h = container.clientHeight || w;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  return function dispose() {
    running = false;
    cancelAnimationFrame(raf);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("resize", onResize);
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "pointerleave"]) {
      canvas.removeEventListener(type, type === "pointerdown" ? onDown : type === "pointermove" ? onMove : onUp);
    }
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    renderer.dispose();
    canvas.remove();
  };
}
