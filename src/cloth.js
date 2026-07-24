export class ClothParticle {
  constructor(x, y, z, mass = 0.1) {
    this.x = x;
    this.y = y;
    this.z = z;

    this.oldX = x;
    this.oldY = y;
    this.oldZ = z;

    this.accX = 0;
    this.accY = 0;
    this.accZ = 0;

    this.mass = mass;
    this.pinned = false;
    this.pinPosition = { x, y, z };
  }

  addForce(fx, fy, fz) {
    if (this.pinned) return;
    this.accX += fx / this.mass;
    this.accY += fy / this.mass;
    this.accZ += fz / this.mass;
  }

  update(dt, damping) {
    if (this.pinned) {
      this.x = this.pinPosition.x;
      this.y = this.pinPosition.y;
      this.z = this.pinPosition.z;
      return;
    }

    const vx = (this.x - this.oldX) * damping;
    const vy = (this.y - this.oldY) * damping;
    const vz = (this.z - this.oldZ) * damping;

    this.oldX = this.x;
    this.oldY = this.y;
    this.oldZ = this.z;

    const dt2 = dt * dt;
    this.x += vx + this.accX * dt2;
    this.y += vy + this.accY * dt2;
    this.z += vz + this.accZ * dt2;

    this.accX = 0;
    this.accY = 0;
    this.accZ = 0;
  }
}

export class ClothConstraint {
  constructor(p1, p2, stiffness = 1.0) {
    this.p1 = p1;
    this.p2 = p2;
    this.stiffness = stiffness;

    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    this.restLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  resolve() {
    const dx = this.p2.x - this.p1.x;
    const dy = this.p2.y - this.p1.y;
    const dz = this.p2.z - this.p1.z;

    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist === 0) return;

    const diff = (dist - this.restLength) / dist;
    const offsetX = dx * 0.5 * diff * this.stiffness;
    const offsetY = dy * 0.5 * diff * this.stiffness;
    const offsetZ = dz * 0.5 * diff * this.stiffness;

    if (!this.p1.pinned && !this.p2.pinned) {
      this.p1.x += offsetX;
      this.p1.y += offsetY;
      this.p1.z += offsetZ;

      this.p2.x -= offsetX;
      this.p2.y -= offsetY;
      this.p2.z -= offsetZ;
    } else if (!this.p1.pinned && this.p2.pinned) {
      this.p1.x += offsetX * 2.0;
      this.p1.y += offsetY * 2.0;
      this.p1.z += offsetZ * 2.0;
    } else if (this.p1.pinned && !this.p2.pinned) {
      this.p2.x -= offsetX * 2.0;
      this.p2.y -= offsetY * 2.0;
      this.p2.z -= offsetZ * 2.0;
    }
  }
}

export class ClothSimulator {
  constructor(width = 8, height = 8, segmentsX = 32, segmentsY = 32) {
    this.width = width;
    this.height = height;
    this.segmentsX = segmentsX;
    this.segmentsY = segmentsY;

    this.particles = [];
    this.constraints = [];
    this.indices = [];
    this.uvs = [];

    this.gravity = -9.8;
    this.damping = 0.98;
    this.solverIterations = 24;

    this.windEnabled = false;
    this.windStrength = 12.0;
    this.windAngle = 45;
    this.windTurbulence = true;

    this.mouseWind = { x: 0, y: 0, z: 0 };

    this.sphereEnabled = true;
    this.sphereRadius = 1.8;
    this.spherePos = { x: 0, y: -1.2, z: 0.8 };

    this.floorEnabled = true;
    this.floorY = -4.0;

    this.pinMode = 'top-2-corners';

    this.initGrid();
  }

  initGrid() {
    this.particles = [];
    this.constraints = [];
    this.indices = [];
    this.uvs = [];

    const numCols = this.segmentsX + 1;
    const numRows = this.segmentsY + 1;
    const dx = this.width / this.segmentsX;
    const dy = this.height / this.segmentsY;

    const startX = -this.width / 2;
    const startY = this.height / 2;

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const x = startX + c * dx;
        const y = startY - r * dy;
        const z = 0;

        const particle = new ClothParticle(x, y, z);
        this.particles.push(particle);

        const u = c / this.segmentsX;
        const v = 1.0 - r / this.segmentsY;
        this.uvs.push(u, v);
      }
    }

    const getIdx = (c, r) => r * numCols + c;

    this.applyPinning();

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const pCurrent = this.particles[getIdx(c, r)];

        if (c < this.segmentsX) {
          const pRight = this.particles[getIdx(c + 1, r)];
          this.constraints.push(new ClothConstraint(pCurrent, pRight));
        }
        if (r < this.segmentsY) {
          const pDown = this.particles[getIdx(c, r + 1)];
          this.constraints.push(new ClothConstraint(pCurrent, pDown));
        }

        if (c < this.segmentsX && r < this.segmentsY) {
          const pDiagonal1 = this.particles[getIdx(c + 1, r + 1)];
          this.constraints.push(new ClothConstraint(pCurrent, pDiagonal1));
        }
        if (c > 0 && r < this.segmentsY) {
          const pLeft = this.particles[getIdx(c, r)];
          const pDiagonal2 = this.particles[getIdx(c - 1, r + 1)];
          this.constraints.push(new ClothConstraint(pLeft, pDiagonal2));
        }

        if (c < this.segmentsX - 1) {
          const p2Right = this.particles[getIdx(c + 2, r)];
          this.constraints.push(new ClothConstraint(pCurrent, p2Right));
        }
        if (r < this.segmentsY - 1) {
          const p2Down = this.particles[getIdx(c, r + 2)];
          this.constraints.push(new ClothConstraint(pCurrent, p2Down));
        }
      }
    }

    for (let r = 0; r < this.segmentsY; r++) {
      for (let c = 0; c < this.segmentsX; c++) {
        const i0 = getIdx(c, r);
        const i1 = getIdx(c + 1, r);
        const i2 = getIdx(c, r + 1);
        const i3 = getIdx(c + 1, r + 1);

        this.indices.push(i0, i2, i1);
        this.indices.push(i1, i2, i3);
      }
    }
  }

  setPinMode(mode) {
    this.pinMode = mode;
    this.applyPinning();
  }

  applyPinning() {
    const numCols = this.segmentsX + 1;
    const numRows = this.segmentsY + 1;
    const getIdx = (c, r) => r * numCols + c;
    const startX = -this.width / 2;
    const startY = this.height / 2;
    const dx = this.width / this.segmentsX;

    for (let p of this.particles) {
      p.pinned = false;
    }

    if (this.pinMode === 'top-2-corners') {
      const p1 = this.particles[getIdx(0, 0)];
      const p2 = this.particles[getIdx(this.segmentsX, 0)];
      p1.pinned = true;
      p2.pinned = true;
      p1.pinPosition = { x: startX, y: startY, z: 0 };
      p2.pinPosition = { x: startX + this.width, y: startY, z: 0 };
    } else if (this.pinMode === 'top-edge') {
      for (let c = 0; c <= this.segmentsX; c++) {
        const p = this.particles[getIdx(c, 0)];
        p.x = startX + c * dx;
        p.y = startY;
        p.z = 0;
        p.oldX = p.x;
        p.oldY = p.y;
        p.oldZ = p.z;
        p.pinned = true;
        p.pinPosition = { x: p.x, y: startY, z: 0 };
      }
    } else if (this.pinMode === 'top-4-corners') {
      const p1 = this.particles[getIdx(0, 0)];
      const p2 = this.particles[getIdx(this.segmentsX, 0)];
      const p3 = this.particles[getIdx(0, this.segmentsY)];
      const p4 = this.particles[getIdx(this.segmentsX, this.segmentsY)];

      p1.pinned = true;
      p2.pinned = true;
      p3.pinned = true;
      p4.pinned = true;

      p1.pinPosition = { x: startX, y: startY, z: 0 };
      p2.pinPosition = { x: startX + this.width, y: startY, z: 0 };
      p3.pinPosition = { x: startX, y: -startY, z: 0 };
      p4.pinPosition = { x: startX + this.width, y: -startY, z: 0 };
    }
  }

  applySphereCollision(particle, effectiveRadius, currentSpherePos) {
    if (particle.pinned) return;

    const dx = particle.x - currentSpherePos.x;
    const dy = particle.y - currentSpherePos.y;
    const dz = particle.z - currentSpherePos.z;

    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < effectiveRadius * effectiveRadius) {
      const dist = Math.sqrt(distSq);
      let nx = 0, ny = 0, nz = 1;

      if (dist > 0.0001) {
        nx = dx / dist;
        ny = dy / dist;
        nz = dz / dist;
      }

      particle.x = currentSpherePos.x + nx * effectiveRadius;
      particle.y = currentSpherePos.y + ny * effectiveRadius;
      particle.z = currentSpherePos.z + nz * effectiveRadius;

      const vx = particle.x - particle.oldX;
      const vy = particle.y - particle.oldY;
      const vz = particle.z - particle.oldZ;
      const inwardDot = vx * nx + vy * ny + vz * nz;

      if (inwardDot < 0) {
        particle.oldX = particle.x;
        particle.oldY = particle.y;
        particle.oldZ = particle.z;
      }
    }
  }

  applyFloorCollision(particle) {
    if (particle.pinned || !this.floorEnabled) return;

    const floorMargin = 0.03;
    const targetY = this.floorY + floorMargin;

    if (particle.y < targetY) {
      particle.y = targetY;
      particle.oldY = targetY;

      particle.oldX = particle.x - (particle.x - particle.oldX) * 0.65;
      particle.oldZ = particle.z - (particle.z - particle.oldZ) * 0.65;
    }
  }

  step(dt, timeSec = 0) {
    const rad = (this.windAngle * Math.PI) / 180;
    const windDirX = Math.cos(rad);
    const windDirZ = Math.sin(rad);

    // Limit maximum mouse wind force to prevent physical instability
    const maxWind = 12.0;
    this.mouseWind.x = Math.max(-maxWind, Math.min(maxWind, this.mouseWind.x));
    this.mouseWind.y = Math.max(-maxWind, Math.min(maxWind, this.mouseWind.y));
    this.mouseWind.z = Math.max(-maxWind, Math.min(maxWind, this.mouseWind.z));

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      p.addForce(0, this.gravity * p.mass, 0);

      if (this.windEnabled) {
        let windMultiplier = 1.0;
        let waveX = 0;
        let waveY = 0;

        if (this.windTurbulence) {
          const gust = 0.5 + 0.5 * Math.sin(timeSec * 5.0);
          const ripple1 = Math.sin(timeSec * 8.0 + p.x * 1.2 + p.y * 0.8);
          const ripple2 = Math.cos(timeSec * 12.0 + p.x * 0.5 - p.y * 1.5);

          windMultiplier = 0.4 + 0.8 * gust;
          waveX = (ripple1 + ripple2) * 0.5;
          waveY = Math.sin(timeSec * 6.0 + p.x * 2.0) * 0.6;
        }

        const windForceMag = this.windStrength * windMultiplier * 0.12;
        p.addForce(
          windDirX * windForceMag + waveX * windForceMag * 0.3,
          waveY * windForceMag * 0.3,
          windDirZ * windForceMag
        );
      }

      if (this.mouseWind.x !== 0 || this.mouseWind.y !== 0 || this.mouseWind.z !== 0) {
        p.addForce(this.mouseWind.x, this.mouseWind.y, this.mouseWind.z);
      }
    }

    this.mouseWind.x *= 0.85;
    this.mouseWind.y *= 0.85;
    this.mouseWind.z *= 0.85;

    for (let p of this.particles) {
      p.update(dt, this.damping);
    }

    const colliderMargin = 0.05;
    const effectiveRadius = this.sphereRadius + colliderMargin;

    for (let iter = 0; iter < this.solverIterations; iter++) {
      for (let c of this.constraints) {
        c.resolve();
      }

      if (this.sphereEnabled) {
        for (let p of this.particles) {
          this.applySphereCollision(p, effectiveRadius, this.spherePos);
        }
      }

      for (let p of this.particles) {
        this.applyFloorCollision(p);
      }
    }

    if (this.sphereEnabled) {
      for (let p of this.particles) {
        this.applySphereCollision(p, effectiveRadius, this.spherePos);
      }
    }
  }

  updatePositionBuffer(positions) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
  }

  updateNormalBuffer(positions, normals) {
    normals.fill(0);

    for (let i = 0; i < this.indices.length; i += 3) {
      const idxA = this.indices[i];
      const idxB = this.indices[i + 1];
      const idxC = this.indices[i + 2];

      const ax = positions[idxA * 3];
      const ay = positions[idxA * 3 + 1];
      const az = positions[idxA * 3 + 2];

      const bx = positions[idxB * 3];
      const by = positions[idxB * 3 + 1];
      const bz = positions[idxB * 3 + 2];

      const cx = positions[idxC * 3];
      const cy = positions[idxC * 3 + 1];
      const cz = positions[idxC * 3 + 2];

      const v1x = bx - ax;
      const v1y = by - ay;
      const v1z = bz - az;

      const v2x = cx - ax;
      const v2y = cy - ay;
      const v2z = cz - az;

      const nx = v1y * v2z - v1z * v2y;
      const ny = v1z * v2x - v1x * v2z;
      const nz = v1x * v2y - v1y * v2x;

      normals[idxA * 3] += nx;
      normals[idxA * 3 + 1] += ny;
      normals[idxA * 3 + 2] += nz;

      normals[idxB * 3] += nx;
      normals[idxB * 3 + 1] += ny;
      normals[idxB * 3 + 2] += nz;

      normals[idxC * 3] += nx;
      normals[idxC * 3 + 1] += ny;
      normals[idxC * 3 + 2] += nz;
    }

    for (let i = 0; i < this.particles.length; i++) {
      const nx = normals[i * 3];
      const ny = normals[i * 3 + 1];
      const nz = normals[i * 3 + 2];

      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 0.00001) {
        normals[i * 3] = nx / len;
        normals[i * 3 + 1] = ny / len;
        normals[i * 3 + 2] = len > 0 ? nz / len : 1;
      } else {
        normals[i * 3 + 2] = 1.0;
      }
    }
  }
}
