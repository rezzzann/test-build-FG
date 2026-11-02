
import * as THREE from "three";

/**
 * Pokereza Poker — 3D ALL-IN
 * Отдельный визуальный модуль.
 * Не изменяет игровую логику и тайминги существующей игры.
 *
 * Подключение:
 * import { playAllIn3D } from "./3d-animation/allin.js";
 *
 * Запуск:
 * playAllIn3D({
 *   container: document.querySelector("#game-container")
 * });
 */

export function playAllIn3D({
  container = document.body,
  duration = 3500,
  onComplete = null
} = {}) {
  if (!container || typeof container.appendChild !== "function") {
    throw new TypeError("[Pokereza 3D] Некорректный контейнер.");
  }

  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
  } catch (error) {
    console.warn("[Pokereza 3D] WebGL недоступен.", error);
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.z = 7;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(1, 1);
  renderer.setClearColor(0x000000, 0);

  Object.assign(renderer.domElement.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "30"
  });

  renderer.domElement.setAttribute("aria-hidden", "true");

  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  container.appendChild(renderer.domElement);

  // Золотая металлическая сфера
  const sphereMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd9a83e,
    metalness: 0.92,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    emissive: 0x6b3900,
    emissiveIntensity: 0.45
  });

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.82, 64, 48),
    sphereMaterial
  );
  scene.add(sphere);

  // Светящееся внутреннее ядро
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe5a0,
    transparent: true,
    opacity: 0.28
  });

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.48, 48, 32),
    coreMaterial
  );
  scene.add(core);

  scene.add(new THREE.HemisphereLight(0xffe7b0, 0x211000, 2));

  const keyLight = new THREE.PointLight(0xffd36b, 85, 18, 2);
  keyLight.position.set(-2.5, 3, 4);
  scene.add(keyLight);

  const rimLight = new THREE.PointLight(0xff8b1f, 55, 15, 2);
  rimLight.position.set(2.5, -1.5, -2);
  scene.add(rimLight);

  // Энергетические кольца
  function createRing(radius, tube, color) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(radius, tube, 12, 96),
      material
    );

    mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
    return mesh;
  }

  const ring = createRing(0.9, 0.025, 0xffd36b);
  const secondRing = createRing(0.9, 0.012, 0xfff0bf);
  secondRing.rotation.y = 0.35;

  // Частицы золотой энергии
  const particleCount = 100;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleDirections = [];

  for (let i = 0; i < particleCount; i++) {
    const direction = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();

    particleDirections.push(direction);

    particlePositions[i * 3] = direction.x * 0.6;
    particlePositions[i * 3 + 1] = direction.y * 0.6;
    particlePositions[i * 3 + 2] = direction.z * 0.6;
  }

  const particleGeometry = new THREE.BufferGeometry();

  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(particlePositions, 3)
  );

  const particleMaterial = new THREE.PointsMaterial({
    color: 0xffd878,
    size: 0.055,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const particles = new THREE.Points(
    particleGeometry,
    particleMaterial
  );

  scene.add(particles);

  const clock = new THREE.Clock();
  let frameId = 0;
  let finished = false;

  function resize() {
    const bounds = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  function cleanup() {
    if (finished) return;
    finished = true;

    window.cancelAnimationFrame(frameId);
    window.removeEventListener("resize", resize);

    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();

      if (object.material) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        materials.forEach((material) => material.dispose());
      }
    });

    renderer.dispose();
    renderer.domElement.remove();

    if (typeof onComplete === "function") {
      onComplete();
    }
  }

  function animate() {
    if (finished) return;

    const elapsed = clock.getElapsedTime();
    const progress = Math.min(
      elapsed / Math.max(duration / 1000, 0.5),
      1
    );

    // Фаза 1: сжатие. Фаза 2: энергетический взрыв.
    const contract = Math.min(progress / 0.48, 1);
    const burst = Math.max(
      0,
      Math.min((progress - 0.48) / 0.52, 1)
    );

    const contractionScale =
      1 - 0.62 * easeOutCubic(contract);

    const burstScale =
      1 + 0.3 * easeOutCubic(burst);

    sphere.scale.setScalar(
      progress < 0.48
        ? contractionScale
        : 0.38 * burstScale
    );

    core.scale.setScalar(
      progress < 0.48
        ? 0.55 + contract * 0.9
        : 1.45 + burst * 2.1
    );

    coreMaterial.opacity = progress < 0.48
      ? 0.18 + contract * 0.55
      : Math.max(0, 0.73 * (1 - burst));

    sphere.rotation.y += 0.012;
    sphere.rotation.x += 0.006;

    sphereMaterial.emissiveIntensity =
      0.35 + Math.sin(elapsed * 12) * 0.18;

    ring.scale.setScalar(0.65 + burst * 2.8);
    ring.material.opacity = progress < 0.48
      ? 0
      : Math.max(0, 0.8 * (1 - burst));

    secondRing.scale.setScalar(0.55 + burst * 3.4);
    secondRing.material.opacity = progress < 0.48
      ? 0
      : Math.max(0, 0.55 * (1 - burst));

    particleMaterial.opacity = progress < 0.48
      ? 0
      : Math.max(0, 0.95 * (1 - burst));

    const positions = particleGeometry.attributes.position.array;
    const travel = 0.6 + easeOutCubic(burst) * 3.4;

    for (let i = 0; i < particleCount; i++) {
      const direction = particleDirections[i];
      const wobble = 1 + Math.sin(elapsed * 7 + i) * 0.045;

      positions[i * 3] = direction.x * travel * wobble;
      positions[i * 3 + 1] = direction.y * travel * wobble;
      positions[i * 3 + 2] = direction.z * travel * wobble;
    }

    particleGeometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);

    if (progress >= 1) {
      cleanup();
      return;
    }

    frameId = window.requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener("resize", resize, { passive: true });
  frameId = window.requestAnimationFrame(animate);

  return {
    stop: cleanup,
    renderer,
    scene,
    camera
  };
}

