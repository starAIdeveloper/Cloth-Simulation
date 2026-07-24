import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ClothSimulator } from './cloth.js';
import { UIController } from './ui.js';

const canvas = document.getElementById('webgl-canvas');
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2d313b);
scene.fog = new THREE.FogExp2(0x2d313b, 0.012);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.5, 13);

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
controls.target.set(0, -0.5, 0);

controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.NONE
};
controls.enablePan = false;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(12, 22, 16);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096;
dirLight.shadow.mapSize.height = 4096;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 80;

const shadowBounds = 35;
dirLight.shadow.camera.left = -shadowBounds;
dirLight.shadow.camera.right = shadowBounds;
dirLight.shadow.camera.top = shadowBounds;
dirLight.shadow.camera.bottom = -shadowBounds;
dirLight.shadow.bias = -0.0003;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.4);
fillLight.position.set(-12, 8, -10);
scene.add(fillLight);

const floorY = -4.0;
const floorGeo = new THREE.PlaneGeometry(100, 100);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0xc8d0e0,
  roughness: 0.6,
  metalness: 0.1,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = floorY;
floor.receiveShadow = true;
scene.add(floor);

const clothSim = new ClothSimulator(8, 8, 28, 28);
clothSim.floorY = floorY;

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

function createFabricTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
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
  color: 0x4361ee,
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

const pinGeo = new THREE.SphereGeometry(0.14, 16, 16);
const pinMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 });

const pinMeshLeft = new THREE.Mesh(pinGeo, pinMat);
const pinMeshRight = new THREE.Mesh(pinGeo, pinMat);
scene.add(pinMeshLeft);
scene.add(pinMeshRight);

function updatePinVisuals() {
  const pLeft = clothSim.particles[0];
  const pRight = clothSim.particles[clothSim.segmentsX];

  if (pLeft) pinMeshLeft.position.set(pLeft.x, pLeft.y, pLeft.z);
  if (pRight) pinMeshRight.position.set(pRight.x, pRight.y, pRight.z);
}
updatePinVisuals();

const sphereGeo = new THREE.SphereGeometry(1.8, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({
  color: 0xe11d48,
  roughness: 0.2,
  metalness: 0.7
});
const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
sphereMesh.position.set(0, -1.2, 0.8);
sphereMesh.castShadow = true;
sphereMesh.receiveShadow = true;
scene.add(sphereMesh);

clothSim.sphereRadius = 1.8;
clothSim.spherePos.x = sphereMesh.position.x;
clothSim.spherePos.y = sphereMesh.position.y;
clothSim.spherePos.z = sphereMesh.position.z;

// 3D Wind Vector Arrow Indicator Helper
const windArrowDir = new THREE.Vector3(
  Math.cos((clothSim.windAngle * Math.PI) / 180),
  0,
  Math.sin((clothSim.windAngle * Math.PI) / 180)
);
const windArrowOrigin = new THREE.Vector3(-5.5, 2.5, 0);
const windArrowHelper = new THREE.ArrowHelper(
  windArrowDir,
  windArrowOrigin,
  2.5,
  0xef4444,
  0.7,
  0.4
);
scene.add(windArrowHelper);

function updateWindArrowVisual() {
  const rad = (clothSim.windAngle * Math.PI) / 180;
  const dir = new THREE.Vector3(Math.cos(rad), 0, Math.sin(rad)).normalize();
  windArrowHelper.setDirection(dir);
  windArrowHelper.visible = true;
}
updateWindArrowVisual();

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const planeIntersection = new THREE.Vector3();

let isDraggingSphere = false;
let isRightMouseWind = false;
let lastRightMousePos = { x: 0, y: 0 };

window.addEventListener('pointerdown', (e) => {
  if (e.target !== canvas) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  if (e.button === 0) {
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sphereMesh);

    if (intersects.length > 0) {
      isDraggingSphere = true;
      controls.enabled = false;
      dragPlane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        sphereMesh.position
      );
    }
  } else if (e.button === 2) {
    isRightMouseWind = true;
    lastRightMousePos = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  if (isDraggingSphere) {
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(dragPlane, planeIntersection)) {
      sphereMesh.position.x = planeIntersection.x;
      sphereMesh.position.z = planeIntersection.z;

      clothSim.spherePos.x = sphereMesh.position.x;
      clothSim.spherePos.z = sphereMesh.position.z;
    }
  } else if (isRightMouseWind) {
    const dx = e.clientX - lastRightMousePos.x;
    const dy = e.clientY - lastRightMousePos.y;

    const angleRad = Math.atan2(-dy, dx);
    let angleDeg = Math.round((angleRad * 180) / Math.PI);
    if (angleDeg < 0) angleDeg += 360;

    clothSim.windAngle = angleDeg;
    clothSim.windEnabled = true;

    // Gentle natural mouse wind push
    const windScale = 0.18;
    clothSim.mouseWind.x += Math.cos(angleRad) * Math.abs(dx + dy) * windScale;
    clothSim.mouseWind.z += Math.sin(angleRad) * Math.abs(dx + dy) * windScale;

    updateWindArrowVisual();

    if (uiController) {
      uiController.syncWindAngleUI(clothSim.windAngle);
      const chkWind = document.getElementById('chk-wind-enable');
      if (chkWind) chkWind.checked = true;
    }

    lastRightMousePos = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('pointerup', (e) => {
  if (e.button === 0 && isDraggingSphere) {
    isDraggingSphere = false;
    controls.enabled = true;
  } else if (e.button === 2) {
    isRightMouseWind = false;
  }
});

const uiController = new UIController(clothSim, {
  updateWindAngleUI: (angle) => {
    updateWindArrowVisual();
  },
  setRenderMode: (mode) => {
    if (mode === 'solid') {
      clothMaterial.wireframe = false;
      clothMesh.visible = true;
    } else if (mode === 'wireframe') {
      clothMaterial.wireframe = true;
      clothMesh.visible = true;
    }
  },
  setShadowsEnabled: (enabled) => {
    renderer.shadowMap.enabled = enabled;
    dirLight.castShadow = enabled;
  }
});

const clock = new THREE.Clock();
const fixedDeltaTime = 1 / 60;

function animate() {
  requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();

  if (!uiController.isPaused) {
    const subSteps = 3;
    const subDt = fixedDeltaTime / subSteps;
    for (let i = 0; i < subSteps; i++) {
      clothSim.step(subDt, elapsedTime);
    }
  }

  const positions = clothGeometry.attributes.position.array;
  const normals = clothGeometry.attributes.normal.array;

  clothSim.updatePositionBuffer(positions);
  clothSim.updateNormalBuffer(positions, normals);

  clothGeometry.attributes.position.needsUpdate = true;
  clothGeometry.attributes.normal.needsUpdate = true;

  updatePinVisuals();
  updateWindArrowVisual();

  controls.update();
  uiController.updateFps();

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
