import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ClothSimulator } from './cloth.js';
import { ImGuiController } from './imgui.js';

// ============================================================================
// 1. Scene, Camera, Renderer Setup
// ============================================================================

const container = document.body;
const canvas = document.getElementById('webgl-canvas');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0f14);
scene.fog = new THREE.FogExp2(0x0e0f14, 0.025);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 2, 14);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 0, 0);

// ============================================================================
// 2. Lighting & Studio Environment
// ============================================================================

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
dirLight.position.set(8, 12, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 40;
const d = 10;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

const rimLight = new THREE.DirectionalLight(0x00b4d8, 0.6);
rimLight.position.set(-8, 5, -8);
scene.add(rimLight);

// Studio Ground Floor
const floorGeo = new THREE.PlaneGeometry(50, 50);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x14161f,
  roughness: 0.8,
  metalness: 0.2
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -6;
floor.receiveShadow = true;
scene.add(floor);

// Grid Helper on floor
const gridHelper = new THREE.GridHelper(30, 30, 0x00b4d8, 0x222536);
gridHelper.position.y = -5.99;
scene.add(gridHelper);

// ============================================================================
// 3. Cloth Physics Engine Initialization & Dynamic Buffer Mesh
// ============================================================================

const clothSim = new ClothSimulator(8, 8, 28, 28);

const numParticles = clothSim.particles.length;
const posArray = new Float32Array(numParticles * 3);
const normArray = new Float32Array(numParticles * 3);
const uvArray = new Float32Array(clothSim.uvs);
const indexArray = new Uint16Array(clothSim.indices);

clothSim.updatePositionBuffer(posArray);
clothSim.updateNormalBuffer(posArray, normArray);

const clothGeometry = new THREE.BufferGeometry();
clothGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
clothGeometry.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
clothGeometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
clothGeometry.setIndex(new THREE.BufferAttribute(indexArray, 1));

// Procedural Checkered Canvas Texture Generator for realistic fabric details
function createFabricTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle grid pattern
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 4;
  const step = 32;
  for (let x = 0; x <= 512; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

const clothTexture = createFabricTexture();

const clothMaterial = new THREE.MeshStandardMaterial({
  color: 0x3a86ff,
  map: clothTexture,
  roughness: 0.4,
  metalness: 0.1,
  side: THREE.DoubleSide,
  wireframe: false
});

const clothMesh = new THREE.Mesh(clothGeometry, clothMaterial);
clothMesh.castShadow = true;
clothMesh.receiveShadow = true;
scene.add(clothMesh);

// Pinned Corner Visual Indicators (Top Stand Balls)
const pinGeo = new THREE.SphereGeometry(0.15, 16, 16);
const pinMat = new THREE.MeshStandardMaterial({ color: 0x00b4d8, metalness: 0.9, roughness: 0.1 });

const pinMeshLeft = new THREE.Mesh(pinGeo, pinMat);
const pinMeshRight = new THREE.Mesh(pinGeo, pinMat);
scene.add(pinMeshLeft);
scene.add(pinMeshRight);

function updatePinVisuals() {
  const numCols = clothSim.segmentsX + 1;
  const pLeft = clothSim.particles[0];
  const pRight = clothSim.particles[clothSim.segmentsX];

  if (pLeft) pinMeshLeft.position.set(pLeft.x, pLeft.y, pLeft.z);
  if (pRight) pinMeshRight.position.set(pRight.x, pRight.y, pRight.z);
}
updatePinVisuals();

// ============================================================================
// 4. Sphere Collider Setup & Mouse Dragging
// ============================================================================

const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({
  color: 0xff0055,
  roughness: 0.15,
  metalness: 0.8,
  emissive: 0x330011
});
const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
sphereMesh.castShadow = true;
sphereMesh.receiveShadow = true;
scene.add(sphereMesh);

// Point light inside sphere for vibrant glow effect
const sphereLight = new THREE.PointLight(0xff0055, 1.5, 8);
sphereMesh.add(sphereLight);

let sphereAutoAnimate = true;

function updateSphereScale(radius) {
  sphereMesh.scale.set(radius, radius, radius);
}
updateSphereScale(clothSim.sphereRadius);

// Raycasting for Sphere Mouse Drag Interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const planeIntersection = new THREE.Vector3();
let isDraggingSphere = false;

window.addEventListener('pointerdown', (e) => {
  if (e.target !== canvas) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(sphereMesh);

  if (intersects.length > 0) {
    isDraggingSphere = true;
    controls.enabled = false; // Disable orbit camera while dragging sphere
    dragPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()).negate(),
      sphereMesh.position
    );
  }
});

window.addEventListener('pointermove', (e) => {
  if (!isDraggingSphere) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  if (raycaster.ray.intersectPlane(dragPlane, planeIntersection)) {
    sphereMesh.position.copy(planeIntersection);
    clothSim.spherePos.x = sphereMesh.position.x;
    clothSim.spherePos.y = sphereMesh.position.y;
    clothSim.spherePos.z = sphereMesh.position.z;

    if (imguiController) {
      imguiController.syncSpherePosUI(clothSim.spherePos);
    }
  }
});

window.addEventListener('pointerup', () => {
  if (isDraggingSphere) {
    isDraggingSphere = false;
    controls.enabled = true;
  }
});

// ============================================================================
// 5. ImGui Controller Integration
// ============================================================================

const imguiController = new ImGuiController(clothSim, {
  setSphereVisible: (visible) => {
    sphereMesh.visible = visible;
  },
  setSphereAutoAnimate: (animate) => {
    sphereAutoAnimate = animate;
  },
  updateSphereScale: (radius) => {
    updateSphereScale(radius);
  },
  updateSpherePos: (pos) => {
    sphereMesh.position.set(pos.x, pos.y, pos.z);
  },
  setRenderMode: (mode) => {
    if (mode === 'solid') {
      clothMaterial.wireframe = false;
      clothMesh.visible = true;
    } else if (mode === 'wireframe') {
      clothMaterial.wireframe = true;
      clothMesh.visible = true;
    } else if (mode === 'points') {
      clothMaterial.wireframe = true;
      clothMesh.visible = true;
    }
  },
  setClothColor: (hexColor) => {
    clothMaterial.color.set(hexColor);
  },
  setShadowsEnabled: (enabled) => {
    renderer.shadowMap.enabled = enabled;
    dirLight.castShadow = enabled;
  }
});

// Sync initial position
clothSim.spherePos.x = sphereMesh.position.x;
clothSim.spherePos.y = sphereMesh.position.y;
clothSim.spherePos.z = sphereMesh.position.z;

// ============================================================================
// 6. Animation & Simulation Loop
// ============================================================================

const clock = new THREE.Clock();
const fixedDeltaTime = 1 / 60; // 60 FPS fixed physics timestep

function animate() {
  requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();

  // 1. Auto Orbit Sphere Motion (If Enabled & Not Being Dragged)
  if (sphereAutoAnimate && !isDraggingSphere && clothSim.sphereEnabled) {
    const radius = 2.5;
    const speed = 1.2;
    const x = Math.sin(elapsedTime * speed) * radius;
    const z = Math.cos(elapsedTime * speed) * radius;
    const y = Math.sin(elapsedTime * 2.0) * 0.8;

    sphereMesh.position.set(x, y, z);
    clothSim.spherePos.x = x;
    clothSim.spherePos.y = y;
    clothSim.spherePos.z = z;

    imguiController.syncSpherePosUI(clothSim.spherePos);
  }

  // 2. Step Cloth Physics Simulator (If not paused)
  if (!imguiController.isPaused) {
    // Perform sub-stepping for smooth physics stability
    const subSteps = 2;
    const subDt = fixedDeltaTime / subSteps;
    for (let i = 0; i < subSteps; i++) {
      clothSim.step(subDt, elapsedTime);
    }
  }

  // 3. Update WebGL Buffers
  const positions = clothGeometry.attributes.position.array;
  const normals = clothGeometry.attributes.normal.array;

  clothSim.updatePositionBuffer(positions);
  clothSim.updateNormalBuffer(positions, normals);

  clothGeometry.attributes.position.needsUpdate = true;
  clothGeometry.attributes.normal.needsUpdate = true;

  updatePinVisuals();

  // 4. Update Camera Controls & ImGui FPS Counter
  controls.update();
  imguiController.updateFps();

  // 5. Render Scene
  renderer.render(scene, camera);
}

// Window Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start loop
animate();
