/* ==========================================================================
   SĀLFA — the hero scene in three dimensions.

   A brass dallah and a glass of iced coffee, both built from the same
   silhouettes the 2D line art uses in art.js. Bodies of revolution (the pot,
   the lid, the tumbler) are lathes; the spout, handle, straw and ice are
   swept tubes and boxes.

   Each object turns on its own axis, and the pair can be dragged to spin with
   a little momentum. three.js is fetched from a CDN only when it will be used:
   never on mobile, never with reduced motion, never without WebGL. Every
   failure path leaves the flat CSS artwork in place.
   ========================================================================== */

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

/* --- dallah, in the coordinates art.js draws with (y downward) --- */
const POT_PROFILE = [
  [0, 116], [14, 116], [15.5, 115], [21, 110], [26, 100], [28, 90],
  [27, 80], [23, 71], [18.5, 64], [16, 57], [14.5, 50], [14, 48],
  [16.5, 47], [16.5, 43], [12, 42], [12, 38],
  [10, 37], [7.5, 30], [4.5, 24], [1.6, 19.5],
];
const SPOUT = [[-14, 52], [-26, 44], [-38, 32], [-45, 22]];
const HANDLE = [[12, 46], [42, 52], [50, 78], [28, 94]];
const POT_BASE = 116;
const POT_UNIT = 0.024;

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

  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7268, 1.1));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.1);
  key.position.set(3.2, 5, 4.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd9c3a2, 1.2);
  rim.position.set(-4, 2.4, -3);
  scene.add(rim);

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

  /* ------------------------------ the dallah ------------------------------ */
  const potY = (y) => (POT_BASE - y) * POT_UNIT;
  const dallah = new THREE.Group();

  dallah.add(new THREE.Mesh(
    new THREE.LatheGeometry(POT_PROFILE.map(([r, y]) => new THREE.Vector2(r * POT_UNIT, potY(y))), 96),
    brass
  ));

  const finial = new THREE.Mesh(new THREE.SphereGeometry(3 * POT_UNIT, 24, 16), brass);
  finial.position.y = potY(15.5);
  dallah.add(finial);

  const sweep = (pts, radius) => new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x * POT_UNIT, potY(y), 0))),
      48, radius, 14, false
    ),
    brass
  );
  dallah.add(sweep(SPOUT, 2.4 * POT_UNIT));
  dallah.add(sweep(HANDLE, 2.2 * POT_UNIT));

  dallah.position.set(-1.05, 0, 0);
  world.add(dallah);

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

  iced.position.set(1.15, 0.06, 0);
  world.add(iced);

  /* --------------------------- motion + dragging --------------------------- */
  // Centre the pair in frame.
  world.position.y = -0.55;

  // Drag spins each object on its own axis. Rotating the parent group instead
  // would make the two orbit each other and swap sides, which wrecks the layout.
  let autoPot = -0.5, autoGlass = 0;   // the idle turn of each object
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
    autoPot += dt * 0.30;
    autoGlass += dt * 0.42;

    // Momentum from a drag decays back to the idle turn.
    if (!dragging) {
      userSpin += spinVelocity;
      spinVelocity *= 0.94;
      if (Math.abs(spinVelocity) < 0.00002) spinVelocity = 0;
    }

    dallah.rotation.y = autoPot + userSpin;
    iced.rotation.y = autoGlass + userSpin;
    dallah.rotation.x += (tilt - dallah.rotation.x) * 0.08;
    iced.rotation.x += (tilt - iced.rotation.x) * 0.08;

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
