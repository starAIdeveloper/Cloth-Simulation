import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ClothSimulator } from './cloth.js';
import { UIController } from './ui.js';

const canvas = document.getElementById('webgl-canvas');
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2d313b);
scene.fog = new THREE.FogExp2(0x2d313b, 0.015);

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
dirLight.position.set(10, 18, 14);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 60;

const shadowBounds = 18;
dirLight.shadow.camera.left = -shadowBounds;
dirLight.shadow.camera.right = shadowBounds;
dirLight.shadow.camera.top = shadowBounds;
dirLight.shadow.camera.bottom = -shadowBounds;
dirLight.shadow.bias = -0.0003;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.4);
fillLight.position.set(-10, 6, -8);
scene.add(fillLight);

const floorY = -4.0;
const floorGeo = new THREE.PlaneGeometry(28, 28);
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

const clothSim = new ClothSimulator(8, 8, 32, 32);
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

const pinMeshTopLeft = new THREE.Mesh(pinGeo, pinMat);
const pinMeshTopRight = new THREE.Mesh(pinGeo, pinMat);
const pinMeshBottomLeft = new THREE.Mesh(pinGeo, pinMat);
const pinMeshBottomRight = new THREE.Mesh(pinGeo, pinMat);
scene.add(pinMeshTopLeft);
scene.add(pinMeshTopRight);
scene.add(pinMeshBottomLeft);
scene.add(pinMeshBottomRight);

const topBarGeo = new THREE.CylinderGeometry(0.09, 0.09, clothSim.width + 0.4, 16);
topBarGeo.rotateZ(Math.PI / 2);
const topBarMesh = new THREE.Mesh(topBarGeo, pinMat);
topBarMesh.visible = false;
scene.add(topBarMesh);

function updatePinVisuals() {
  const getIdx = (c, r) => r * (clothSim.segmentsX + 1) + c;
  const pTopLeft = clothSim.particles[getIdx(0, 0)];
  const pTopRight = clothSim.particles[getIdx(clothSim.segmentsX, 0)];
  const pBottomLeft = clothSim.particles[getIdx(0, clothSim.segmentsY)];
  const pBottomRight = clothSim.particles[getIdx(clothSim.segmentsX, clothSim.segmentsY)];

  if (clothSim.pinMode === 'top-edge') {
    pinMeshTopLeft.visible = false;
    pinMeshTopRight.visible = false;
    pinMeshBottomLeft.visible = false;
    pinMeshBottomRight.visible = false;

    topBarMesh.visible = true;
    topBarMesh.position.set(0, 4.0, 0);
  } else if (clothSim.pinMode === 'top-4-corners') {
    topBarMesh.visible = false;
    pinMeshTopLeft.visible = true;
    pinMeshTopRight.visible = true;
    pinMeshBottomLeft.visible = true;
    pinMeshBottomRight.visible = true;

    if (pTopLeft) pinMeshTopLeft.position.set(pTopLeft.x, pTopLeft.y, pTopLeft.z);
    if (pTopRight) pinMeshTopRight.position.set(pTopRight.x, pTopRight.y, pTopRight.z);
    if (pBottomLeft) pinMeshBottomLeft.position.set(pBottomLeft.x, pBottomLeft.y, pBottomLeft.z);
    if (pBottomRight) pinMeshBottomRight.position.set(pBottomRight.x, pBottomRight.y, pBottomRight.z);
  } else if (clothSim.pinMode === 'top-2-corners') {
    topBarMesh.visible = false;
    pinMeshTopLeft.visible = true;
    pinMeshTopRight.visible = true;
    pinMeshBottomLeft.visible = false;
    pinMeshBottomRight.visible = false;

    if (pTopLeft) pinMeshTopLeft.position.set(pTopLeft.x, pTopLeft.y, pTopLeft.z);
    if (pTopRight) pinMeshTopRight.position.set(pTopRight.x, pTopRight.y, pTopRight.z);
  } else {
    topBarMesh.visible = false;
    pinMeshTopLeft.visible = false;
    pinMeshTopRight.visible = false;
    pinMeshBottomLeft.visible = false;
    pinMeshBottomRight.visible = false;
  }
}
updatePinVisuals();

const sphereGeo = new THREE.SphereGeometry(1.8, 32, 32);
const sphereMat = new THREE.MeshStandardMaterial({
  color: 0xe11d48,
  roughness: 0.2,
  metalness: 0.7
});
const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
sphereMesh.position.set(0, -1.2, 1.2);
sphereMesh.castShadow = true;
sphereMesh.receiveShadow = true;
scene.add(sphereMesh);

clothSim.sphereRadius = 1.8;
clothSim.spherePos.x = sphereMesh.position.x;
clothSim.spherePos.y = sphereMesh.position.y;
clothSim.spherePos.z = sphereMesh.position.z;
clothSim.onSphereMoved = (pos) => {
  sphereMesh.position.set(pos.x, pos.y, pos.z);
};

// Thick 3D Drag Wind Arrow Mesh (Shaft + Cone Tip)
const arrowMaterial = new THREE.MeshStandardMaterial({
  color: 0xef4444,
  metalness: 0.6,
  roughness: 0.2,
  emissive: 0x440000
});

const shaftGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 16);
shaftGeo.translate(0, 0.5, 0);

const coneGeo = new THREE.ConeGeometry(0.35, 0.7, 16);
coneGeo.translate(0, 0.35, 0);

const shaftMesh = new THREE.Mesh(shaftGeo, arrowMaterial);
const coneMesh = new THREE.Mesh(coneGeo, arrowMaterial);

const windArrowGroup = new THREE.Group();
windArrowGroup.add(shaftMesh);
windArrowGroup.add(coneMesh);
windArrowGroup.visible = false;
scene.add(windArrowGroup);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const windRayPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const planeIntersection = new THREE.Vector3();

let isDraggingSphere = false;
let isRightMouseWind = false;
const dragStart3D = new THREE.Vector3();
const dragCurrent3D = new THREE.Vector3();

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
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(windRayPlane, planeIntersection)) {
      dragStart3D.copy(planeIntersection);
    } else {
      dragStart3D.set(0, 0, 0);
    }
    windArrowGroup.visible = true;
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
      clothSim.spherePos.y = sphereMesh.position.y;
      clothSim.spherePos.z = sphereMesh.position.z;
    }
  } else if (isRightMouseWind) {
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(windRayPlane, planeIntersection)) {
      dragCurrent3D.copy(planeIntersection);

      const dirVec = new THREE.Vector3().subVectors(dragCurrent3D, dragStart3D);
      const len = dirVec.length();

      if (len > 0.1) {
        dirVec.normalize();

        windArrowGroup.position.copy(dragStart3D);

        const up = new THREE.Vector3(0, 1, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(up, dirVec);
        windArrowGroup.setRotationFromQuaternion(q);

        const shaftLen = Math.max(0.5, Math.min(3.5, len));
        shaftMesh.scale.set(1, shaftLen, 1);
        coneMesh.position.set(0, shaftLen, 0);

        const angleRad = Math.atan2(dirVec.z, dirVec.x);
        let angleDeg = Math.round((angleRad * 180) / Math.PI);
        if (angleDeg < 0) angleDeg += 360;

        clothSim.windAngle = angleDeg;
        clothSim.windEnabled = true;

        const windForceMag = Math.min(len * 2.0, 12.0);
        clothSim.mouseWind.x = dirVec.x * windForceMag;
        clothSim.mouseWind.y = dirVec.y * windForceMag;
        clothSim.mouseWind.z = dirVec.z * windForceMag;

        if (uiController) {
          uiController.syncWindAngleUI(clothSim.windAngle);
          const chkWind = document.getElementById('chk-wind-enable');
          if (chkWind) chkWind.checked = true;
        }
      }
    }
  }
});

window.addEventListener('pointerup', (e) => {
  if (e.button === 0 && isDraggingSphere) {
    isDraggingSphere = false;
    controls.enabled = true;
  } else if (e.button === 2) {
    isRightMouseWind = false;
    windArrowGroup.visible = false;
  }
});

const uiController = new UIController(clothSim, {
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
    const subSteps = 6;
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
