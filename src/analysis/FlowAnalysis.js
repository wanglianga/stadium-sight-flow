import * as THREE from 'three';
import { SCENE_CONFIGS } from '../config/scenes.js';

export class FlowAnalysis {
  constructor(sceneManager, stadiumBuilder, facilityBuilder) {
    this.sceneManager = sceneManager;
    this.stadiumBuilder = stadiumBuilder;
    this.facilityBuilder = facilityBuilder;

    this.flowPathsGroup = new THREE.Group();
    this.flowParticlesGroup = new THREE.Group();

    this.flowPathsVisible = false;
    this.currentMode = 'overview';
    this.currentSceneType = 'concert';
    this.particles = [];

    this.sceneManager.add(this.flowPathsGroup);
    this.sceneManager.add(this.flowParticlesGroup);
  }

  setSceneType(sceneType) {
    this.currentSceneType = sceneType;
    if (this.flowPathsVisible) {
      this.renderFlowPaths();
    }
  }

  _getEntryStrategy() {
    return SCENE_CONFIGS[this.currentSceneType].entryStrategy;
  }

  _getFilteredEntries() {
    const strategy = this._getEntryStrategy();
    const entries = this.facilityBuilder.entries;

    if (strategy === 'all') {
      return entries;
    } else if (strategy === 'south-main') {
      return entries.filter(e => e.direction === 'south');
    }
    return entries;
  }

  _getFilteredSecurityGates() {
    const strategy = this._getEntryStrategy();
    const securityGates = this.facilityBuilder.securityGates;
    const entries = this._getFilteredEntries();

    if (strategy === 'all') {
      return securityGates;
    } else if (strategy === 'south-main') {
      return securityGates.filter(gate => {
        return entries.some(entry => {
          const dist = gate.position.distanceTo(entry.position);
          return dist < 25;
        });
      });
    }
    return securityGates;
  }

  buildEntryPaths() {
    const paths = [];
    const entries = this._getFilteredEntries();
    const securityGates = this._getFilteredSecurityGates();

    entries.forEach((entry, entryIndex) => {
      const entryPos = entry.position.clone();
      entryPos.y = 0.1;

      const nearbyGates = securityGates.filter(gate => {
        const dist = gate.position.distanceTo(entryPos);
        return dist < 25;
      });

      nearbyGates.slice(0, 3).forEach((gate, gateIdx) => {
        const gatePos = gate.position.clone();
        gatePos.y = 0.1;

        const midPoint = new THREE.Vector3().addVectors(entryPos, gatePos).multiplyScalar(0.5);

        const pathPoints = [
          entryPos.clone(),
          midPoint.clone(),
          gatePos.clone()
        ];

        paths.push({
          type: 'entry',
          entryIndex,
          gateIndex: gateIdx,
          points: pathPoints,
          color: 0x22c55e,
          speed: 1.5
        });

        const innerPathPoints = [
          gatePos.clone(),
          new THREE.Vector3(
            gatePos.x * 0.75,
            0.1,
            gatePos.z * 0.75
          )
        ];

        paths.push({
          type: 'channel',
          entryIndex,
          points: innerPathPoints,
          color: 0x3b82f6,
          speed: 2
        });
      });
    });

    return paths;
  }

  buildExitPaths() {
    const paths = [];
    const exits = this.facilityBuilder.exits;

    exits.forEach((exit, exitIndex) => {
      const exitPos = exit.position.clone();
      exitPos.y = 0.1;

      const innerPoint = new THREE.Vector3(
        exitPos.x * 1.3,
        0.1,
        exitPos.z * 1.3
      );

      paths.push({
        type: 'exit',
        exitIndex,
        points: [innerPoint, exitPos.clone()],
        color: 0xef4444,
        speed: 2.5
      });
    });

    return paths;
  }

  buildAccessiblePaths() {
    const paths = [];
    const accessibleAreas = this.facilityBuilder.accessibleAreas;
    const entries = this._getFilteredEntries();

    accessibleAreas.forEach((area, areaIndex) => {
      const areaPos = area.position.clone();
      areaPos.y = 0.1;

      const nearestEntry = entries.reduce((nearest, entry) => {
        const dist = entry.position.distanceTo(areaPos);
        if (!nearest || dist < nearest.dist) {
          return { entry, dist };
        }
        return nearest;
      }, null);

      if (nearestEntry) {
        const entryPos = nearestEntry.entry.position.clone();
        entryPos.y = 0.1;

        paths.push({
          type: 'accessible',
          areaIndex,
          points: [entryPos, areaPos],
          color: 0xa855f7,
          speed: 0.8
        });
      }
    });

    return paths;
  }

  buildSecurityQueuePaths() {
    const paths = [];
    const securityGates = this._getFilteredSecurityGates();

    securityGates.forEach((gate, gateIndex) => {
      const gatePos = gate.position.clone();
      gatePos.y = 0.1;

      const startPoint = new THREE.Vector3(
        gatePos.x + (Math.random() - 0.5) * 2,
        0.1,
        gatePos.z + (Math.random() - 0.5) * 2
      );

      const dir = new THREE.Vector3().subVectors(startPoint, gatePos).normalize();

      const queuePoints = [];
      for (let i = 0; i <= 5; i++) {
        queuePoints.push(new THREE.Vector3(
          startPoint.x + dir.x * i * 1.2,
          0.1,
          startPoint.z + dir.z * i * 1.2
        ));
      }

      paths.push({
        type: 'queue',
        gateIndex,
        points: queuePoints,
        color: 0xf59e0b,
        speed: 0.5,
        loop: true
      });
    });

    return paths;
  }

  renderFlowPaths() {
    this.clearFlowPaths();

    if (!this.flowPathsVisible) return;

    let allPaths = [];

    switch (this.currentMode) {
      case 'ticket':
        allPaths = this.buildEntryPaths();
        break;
      case 'operation':
        allPaths = [
          ...this.buildSecurityQueuePaths(),
          ...this.buildExitPaths()
        ];
        break;
      case 'audience':
        allPaths = [
          ...this.buildEntryPaths(),
          ...this.buildAccessiblePaths(),
          ...this.buildExitPaths()
        ];
        break;
      case 'overview':
      default:
        allPaths = [
          ...this.buildEntryPaths(),
          ...this.buildSecurityQueuePaths(),
          ...this.buildExitPaths(),
          ...this.buildAccessiblePaths()
        ];
    }

    allPaths.forEach(path => {
      const curve = new THREE.CatmullRomCurve3(path.points);
      const points = curve.getPoints(50);
      const geometry = new THREE.BufferGeometry().setFromPoints(points);

      const material = new THREE.LineBasicMaterial({
        color: path.color,
        transparent: true,
        opacity: 0.6
      });

      const line = new THREE.Line(geometry, material);
      line.userData = { pathData: path };
      this.flowPathsGroup.add(line);

      this._createFlowParticles(curve, path);
    });
  }

  _createFlowParticles(curve, pathData) {
    const particleCount = Math.floor(pathData.speed * 3);

    for (let i = 0; i < particleCount; i++) {
      const particleGeometry = new THREE.SphereGeometry(0.15, 8, 8);
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: pathData.color,
        transparent: true,
        opacity: 0.9
      });

      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.userData = {
        curve,
        speed: pathData.speed * 0.001,
        offset: i / particleCount,
        pathType: pathData.type
      };

      this.flowParticlesGroup.add(particle);
      this.particles.push(particle);
    }
  }

  clearFlowPaths() {
    while (this.flowPathsGroup.children.length > 0) {
      const child = this.flowPathsGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.flowPathsGroup.remove(child);
    }

    while (this.flowParticlesGroup.children.length > 0) {
      const child = this.flowParticlesGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.flowParticlesGroup.remove(child);
    }

    this.particles = [];
  }

  toggleFlowPaths(visible) {
    this.flowPathsVisible = visible;
    this.flowPathsGroup.visible = visible;
    this.flowParticlesGroup.visible = visible;

    if (visible) {
      this.renderFlowPaths();
    } else {
      this.clearFlowPaths();
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    if (this.flowPathsVisible) {
      this.renderFlowPaths();
    }
  }

  animate(deltaTime) {
    this.particles.forEach(particle => {
      const { curve, speed, offset } = particle.userData;
      let t = (Date.now() * speed + offset) % 1;

      if (particle.userData.pathType === 'queue') {
        t = (Date.now() * speed * 0.3 + offset) % 1;
      }

      const point = curve.getPointAt(t);
      particle.position.copy(point);
      particle.position.y += 0.5 + Math.sin(Date.now() * 0.003 + offset * Math.PI * 2) * 0.1;
    });
  }
}
