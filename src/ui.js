export class UIController {
  constructor(clothSim, sceneCallbacks = {}) {
    this.clothSim = clothSim;
    this.sceneCallbacks = sceneCallbacks;

    this.fpsElement = document.getElementById('ui-fps');
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.currentFps = 60.0;

    this.isPaused = false;

    this.initUI();
    this.initEvents();
  }

  updateFps() {
    this.frameCount++;
    const now = performance.now();
    const delta = now - this.lastFpsTime;

    if (delta >= 500) {
      this.currentFps = (this.frameCount * 1000) / delta;
      if (this.fpsElement) {
        this.fpsElement.textContent = `${this.currentFps.toFixed(1)} FPS`;
      }
      this.frameCount = 0;
      this.lastFpsTime = now;
    }
  }

  initUI() {
    const panel = document.getElementById('ui-panel');
    const closeBtn = document.getElementById('ui-close-btn');
    const hamburgerBtn = document.getElementById('ui-toggle-btn');

    closeBtn.addEventListener('click', () => {
      panel.classList.add('collapsed');
      hamburgerBtn.classList.remove('hidden');
    });

    hamburgerBtn.addEventListener('click', () => {
      panel.classList.remove('collapsed');
      hamburgerBtn.classList.add('hidden');
    });

    const pauseBtn = document.getElementById('btn-pause');
    const resetBtn = document.getElementById('btn-reset');

    pauseBtn.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
      pauseBtn.classList.toggle('ui-btn-accent', this.isPaused);
    });

    resetBtn.addEventListener('click', () => {
      this.clothSim.initGrid();
    });

    const pinSelect = document.getElementById('sel-pin-mode');
    pinSelect.addEventListener('change', (e) => {
      this.clothSim.setPinMode(e.target.value);
    });

    this.bindSlider('sld-gravity', 'val-gravity', (val) => {
      this.clothSim.gravity = parseFloat(val);
    }, (v) => parseFloat(v).toFixed(1));

    this.bindSlider('sld-damping', 'val-damping', (val) => {
      this.clothSim.damping = parseFloat(val);
    }, (v) => parseFloat(v).toFixed(3));

    this.bindSlider('sld-stiffness', 'val-stiffness', (val) => {
      this.clothSim.solverIterations = parseInt(val, 10);
    }, (v) => v);

    const chkWind = document.getElementById('chk-wind-enable');
    chkWind.addEventListener('change', (e) => {
      this.clothSim.windEnabled = e.target.checked;
    });

    this.bindSlider('sld-wind-strength', 'val-wind-strength', (val) => {
      this.clothSim.windStrength = parseFloat(val);
    }, (v) => parseFloat(v).toFixed(1));

    this.bindSlider('sld-wind-angle', 'val-wind-angle', (val) => {
      this.clothSim.windAngle = parseFloat(val);
    }, (v) => `${v}°`);

    const chkTurbulence = document.getElementById('chk-wind-turbulence');
    chkTurbulence.addEventListener('change', (e) => {
      this.clothSim.windTurbulence = e.target.checked;
    });

    this.bindSlider('sld-sphere-radius', 'val-sphere-radius', (val) => {
      const r = parseFloat(val);
      this.clothSim.sphereRadius = r;
      if (this.sceneCallbacks.updateSphereScale) {
        this.sceneCallbacks.updateSphereScale(r);
      }
    }, (v) => parseFloat(v).toFixed(1));

    this.bindSlider('sld-sphere-pos-x', 'val-sphere-pos-x', (val) => {
      const x = parseFloat(val);
      this.clothSim.spherePos.x = x;
      if (this.sceneCallbacks.updateSpherePos) {
        this.sceneCallbacks.updateSpherePos(this.clothSim.spherePos);
      }
    }, (v) => parseFloat(v).toFixed(1));

    this.bindSlider('sld-sphere-pos-z', 'val-sphere-pos-z', (val) => {
      const z = parseFloat(val);
      this.clothSim.spherePos.z = z;
      if (this.sceneCallbacks.updateSpherePos) {
        this.sceneCallbacks.updateSpherePos(this.clothSim.spherePos);
      }
    }, (v) => parseFloat(v).toFixed(1));

    const selRender = document.getElementById('sel-render-mode');
    selRender.addEventListener('change', (e) => {
      if (this.sceneCallbacks.setRenderMode) {
        this.sceneCallbacks.setRenderMode(e.target.value);
      }
    });

    const colCloth = document.getElementById('col-cloth');
    colCloth.addEventListener('input', (e) => {
      if (this.sceneCallbacks.setClothColor) {
        this.sceneCallbacks.setClothColor(e.target.value);
      }
    });

    const chkShadows = document.getElementById('chk-shadows');
    chkShadows.addEventListener('change', (e) => {
      if (this.sceneCallbacks.setShadowsEnabled) {
        this.sceneCallbacks.setShadowsEnabled(e.target.checked);
      }
    });
  }

  bindSlider(sliderId, valueId, onChange, formatFn) {
    const slider = document.getElementById(sliderId);
    const valueSpan = document.getElementById(valueId);

    if (!slider || !valueSpan) return;

    slider.addEventListener('input', (e) => {
      const val = e.target.value;
      valueSpan.textContent = formatFn ? formatFn(val) : val;
      onChange(val);
    });
  }

  syncSpherePosUI(pos) {
    const sldX = document.getElementById('sld-sphere-pos-x');
    const valX = document.getElementById('val-sphere-pos-x');
    const sldZ = document.getElementById('sld-sphere-pos-z');
    const valZ = document.getElementById('val-sphere-pos-z');

    if (sldX && valX) {
      sldX.value = pos.x;
      valX.textContent = pos.x.toFixed(1);
    }
    if (sldZ && valZ) {
      sldZ.value = pos.z;
      valZ.textContent = pos.z.toFixed(1);
    }
  }

  initEvents() {
    const panel = document.getElementById('ui-panel');
    ['mousedown', 'mouseup', 'mousemove', 'wheel', 'touchstart', 'touchend'].forEach((evt) => {
      panel.addEventListener(evt, (e) => {
        e.stopPropagation();
      });
    });
  }
}
