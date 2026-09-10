/* ==========================================================================
   SĀLFA — the dallah, in three dimensions.

   A dallah is a body of revolution, so the pot and lid are a lathe built from
   the same silhouette used by the 2D line art in art.js. The spout and handle
   are not revolutions, so they are swept tubes along curves traced from the
   same drawing.

   three.js is loaded from a CDN only when it will actually be used — never on
   mobile, never when the visitor prefers reduced motion, and never if WebGL is
   missing. Every failure path leaves the CSS artwork in place.
   ========================================================================== */

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

/** Silhouette in the same coordinates as art.js: [radius, y] with y downward. */
const PROFILE = [
  [0, 116], [14, 116], [15.5, 115], [21, 110], [26, 100], [28, 90],
  [27, 80], [23, 71], [18.5, 64], [16, 57], [14.5, 50], [14, 48],
  [16.5, 47], [16.5, 43], [12, 42], [12, 38],           // collar step and neck
  [10, 37], [7.5, 30], [4.5, 24], [1.6, 19.5],           // lid cone
];

const SPOUT = [[-14, 52], [-26, 44], [-38, 32], [-45, 22]];
const HANDLE = [[12, 46], [42, 52], [50, 78], [28, 94]];

const SAND = 0x9d7a45;
const BASE_Y = 116;     // the foot, which becomes y = 0
const UNIT = 0.024;     // svg units -> world units

const toWorld = (svgY) => (BASE_Y - svgY) * UNIT;

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

/**
 * Mounts the rotating dallah into `container`.
 * Resolves to a dispose function, or to null if it declined to render.
 */
export async function mountDallah3D(container) {
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

  const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
  camera.position.set(0, 1.45, 6.4);
  camera.lookAt(0, 1.25, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);

  // Warm key light, cool fill, and a low bounce so the brass reads as metal
  // against a cream page rather than going flat.
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7268, 1.15));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.1);
  key.position.set(3.2, 5, 4.2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xd9c3a2, 1.1);
  rim.position.set(-4, 2.4, -3);
  scene.add(rim);

  const brass = new THREE.MeshStandardMaterial({
    color: SAND,
    metalness: 0.72,
    roughness: 0.34,
  });

  const group = new THREE.Group();

  // Pot and lid, spun from the silhouette.
  const lathePoints = PROFILE.map(([r, y]) => new THREE.Vector2(r * UNIT, toWorld(y)));
  const body = new THREE.Mesh(new THREE.LatheGeometry(lathePoints, 96), brass);
  group.add(body);

  // Finial.
  const finial = new THREE.Mesh(new THREE.SphereGeometry(3 * UNIT, 24, 16), brass);
  finial.position.y = toWorld(15.5);
  group.add(finial);

  const sweep = (pts, radius) => {
    const curve = new THREE.CatmullRomCurve3(
      pts.map(([x, y]) => new THREE.Vector3(x * UNIT, toWorld(y), 0))
    );
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 14, false), brass);
  };

  group.add(sweep(SPOUT, 2.4 * UNIT));
  group.add(sweep(HANDLE, 2.2 * UNIT));

  // Centre the pot vertically in frame.
  group.position.y = -0.15;
  group.rotation.y = -0.5;
  scene.add(group);

  let raf = 0;
  let last = performance.now();
  let running = true;

  const frame = (now) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    group.rotation.y += dt * 0.32;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  // Don't burn cycles on a tab nobody is looking at.
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
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    renderer.dispose();
    renderer.domElement.remove();
  };
}
