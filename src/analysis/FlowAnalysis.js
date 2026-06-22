import * as THREE from 'three';
import { SCENE_CONFIGS, QUEUE_SIMULATION_CONFIG, STADIUM_CONFIG } from '../config/scenes.js';
import { getQueueHeatColor, getQueueHeatLevel } from '../utils/three-utils.js';

export class FlowAnalysis {
  constructor(sceneManager, stadiumBuilder, facilityBuilder) {
    this.sceneManager = sceneManager;
    this.stadiumBuilder = stadiumBuilder;
    this.facilityBuilder = facilityBuilder;

    this.flowPathsGroup = new THREE.Group();
    this.flowParticlesGroup = new THREE.Group();
    this.heatZonesGroup = new THREE.Group();
    this.flowLinesGroup = new THREE.Group();
    this.operatorsGroup = new THREE.Group();

    this.flowPathsVisible = false;
    this.heatZonesVisible = false;
    this.currentMode = 'overview';
    this.currentSceneType = 'concert';
    this.particles = [];
    
    this.gateStates = {};
    this.volunteerPositions = [];
    this.fencePositions = [];
    
    this.queueData = {};
    this.simulationTime = 0;
    this.simulationRunning = false;

    this.sceneManager.add(this.flowPathsGroup);
    this.sceneManager.add(this.flowParticlesGroup);
    this.sceneManager.add(this.heatZonesGroup);
    this.sceneManager.add(this.flowLinesGroup);
    this.sceneManager.add(this.operatorsGroup);
    
    this._initGateStates();
    this._initQueueData();
  }

  _initGateStates() {
    const gates = this.facilityBuilder.securityGates;
    gates.forEach(gate => {
      this.gateStates[gate.id] = {
        open: true,
        accessible: false,
        closedReason: null
      };
    });
  }

  _initQueueData() {
    const entries = this.facilityBuilder.entries;
    const gates = this.facilityBuilder.securityGates;
    
    this.queueData = {
      entries: entries.map(entry => ({
        id: entry.id,
        name: entry.name,
        direction: entry.direction,
        position: entry.position.clone(),
        queueLength: Math.floor(Math.random() * 40) + 10,
        arrivalRate: QUEUE_SIMULATION_CONFIG.baseArrivalRate,
        peakArrivalRate: QUEUE_SIMULATION_CONFIG.baseArrivalRate * QUEUE_SIMULATION_CONFIG.peakMultiplier
      })),
      gates: gates.map(gate => ({
        id: gate.id,
        position: gate.position.clone(),
        processingTime: QUEUE_SIMULATION_CONFIG.gateProcessingTime,
        open: true,
        accessible: false,
        queueLength: Math.floor(Math.random() * 20) + 5,
        throughput: 0
      }))
    };
  }

  setSceneType(sceneType) {
    this.currentSceneType = sceneType;
    this._initGateStates();
    this._initQueueData();
    if (this.flowPathsVisible) {
      this.renderFlowPaths();
    }
    if (this.heatZonesVisible) {
      this.renderHeatZones();
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

  toggleGate(gateId, open) {
    if (this.gateStates[gateId]) {
      this.gateStates[gateId].open = open;
      if (!open) {
        this.gateStates[gateId].closedReason = 'manual';
      } else {
        this.gateStates[gateId].closedReason = null;
      }
      
      const gate = this.queueData.gates.find(g => g.id === gateId);
      if (gate) {
        gate.open = open;
      }
      
      this._updateGateVisual(gateId);
      this._redistributeQueues();
      
      if (this.heatZonesVisible) {
        this.renderHeatZones();
      }
      if (this.flowPathsVisible) {
        this.renderFlowPaths();
      }
    }
  }

  setGateAccessible(gateId, accessible) {
    if (this.gateStates[gateId]) {
      this.gateStates[gateId].accessible = accessible;
      const gate = this.queueData.gates.find(g => g.id === gateId);
      if (gate) {
        gate.accessible = accessible;
        gate.processingTime = accessible ? 
          QUEUE_SIMULATION_CONFIG.accessibleProcessingTime : 
          QUEUE_SIMULATION_CONFIG.gateProcessingTime;
      }
      if (this.heatZonesVisible) {
        this.renderHeatZones();
      }
    }
  }

  addVolunteer(position) {
    const volunteer = {
      id: `volunteer-${this.volunteerPositions.length}`,
      position: position.clone(),
      efficiency: QUEUE_SIMULATION_CONFIG.volunteerEfficiency
    };
    this.volunteerPositions.push(volunteer);
    this._renderVolunteers();
    this._redistributeQueues();
    if (this.heatZonesVisible) {
      this.renderHeatZones();
    }
  }

  removeVolunteer(volunteerId) {
    this.volunteerPositions = this.volunteerPositions.filter(v => v.id !== volunteerId);
    this._renderVolunteers();
    this._redistributeQueues();
    if (this.heatZonesVisible) {
      this.renderHeatZones();
    }
  }

  addFence(start, end) {
    const fence = {
      id: `fence-${this.fencePositions.length}`,
      start: start.clone(),
      end: end.clone()
    };
    this.fencePositions.push(fence);
    this._renderFences();
    this._redistributeQueues();
    if (this.heatZonesVisible) {
      this.renderHeatZones();
    }
  }

  removeFence(fenceId) {
    this.fencePositions = this.fencePositions.filter(f => f.id !== fenceId);
    this._renderFences();
    this._redistributeQueues();
    if (this.heatZonesVisible) {
      this.renderHeatZones();
    }
  }

  _updateGateVisual(gateId) {
    const gate = this.facilityBuilder.securityGates.find(g => g.id === gateId);
    if (!gate || !gate.object) return;
    
    const isOpen = this.gateStates[gateId]?.open ?? true;
    
    gate.object.traverse(child => {
      if (child.isMesh) {
        if (child.material) {
          child.material = child.material.clone();
          if (!isOpen) {
            child.material.color.setHex(0xef4444);
            child.material.emissive = new THREE.Color(0x991b1b);
            child.material.emissiveIntensity = 0.3;
          } else {
            const isAccessible = this.gateStates[gateId]?.accessible;
            child.material.color.setHex(isAccessible ? 0xa855f7 : 0x22c55e);
            child.material.emissive = new THREE.Color(isAccessible ? 0x6b21a8 : 0x166534);
            child.material.emissiveIntensity = 0.3;
          }
        }
      }
    });
  }

  _redistributeQueues() {
    const openGates = this.queueData.gates.filter(g => g.open);
    const totalPeople = this.queueData.entries.reduce((sum, e) => sum + e.queueLength, 0);
    const gatesPerEntry = Math.max(1, Math.floor(openGates.length / this.queueData.entries.length));
    
    this.queueData.entries.forEach(entry => {
      const nearbyOpenGates = openGates.filter(gate => 
        gate.position.distanceTo(entry.position) < 30
      );
      
      if (nearbyOpenGates.length === 0) {
        entry.queueLength = Math.min(150, entry.queueLength + 20);
        return;
      }
      
      const gateCapacity = nearbyOpenGates.reduce((sum, gate) => {
        let capacity = 1 / gate.processingTime;
        if (gate.accessible) capacity *= 0.7;
        return sum + capacity;
      }, 0);
      
      nearbyOpenGates.forEach(gate => {
        let capacity = 1 / gate.processingTime;
        if (gate.accessible) capacity *= 0.7;
        const proportion = capacity / gateCapacity;
        gate.queueLength = Math.floor(entry.queueLength * proportion / nearbyOpenGates.length * gatesPerEntry);
      });
      
      const volunteerNearby = this.volunteerPositions.filter(v => 
        v.position.distanceTo(entry.position) < 20
      );
      
      if (volunteerNearby.length > 0) {
        entry.queueLength = Math.max(5, Math.floor(entry.queueLength * (1 - volunteerNearby.length * QUEUE_SIMULATION_CONFIG.volunteerEfficiency)));
      }
    });
  }

  simulateStep(deltaTime) {
    if (!this.simulationRunning) return;
    
    this.simulationTime += deltaTime;
    
    this.queueData.entries.forEach(entry => {
      const timeFactor = Math.sin(this.simulationTime * 0.1) * 0.5 + 0.5;
      const arrivalRate = entry.arrivalRate + (entry.peakArrivalRate - entry.arrivalRate) * timeFactor;
      entry.queueLength = Math.max(0, Math.floor(entry.queueLength + arrivalRate * deltaTime));
      
      const nearbyOpenGates = this.queueData.gates.filter(gate => 
        gate.open && gate.position.distanceTo(entry.position) < 30
      );
      
      const totalProcessing = nearbyOpenGates.reduce((sum, gate) => {
        return sum + (1 / gate.processingTime) * deltaTime * 60;
      }, 0);
      
      entry.queueLength = Math.max(0, Math.floor(entry.queueLength - totalProcessing));
    });
    
    this.queueData.gates.forEach(gate => {
      if (!gate.open) {
        gate.queueLength = 0;
        return;
      }
      gate.throughput += (1 / gate.processingTime) * deltaTime * 60;
    });
  }

  renderHeatZones() {
    this.clearHeatZones();
    
    if (!this.heatZonesVisible) return;
    
    const thresholds = QUEUE_SIMULATION_CONFIG.heatThresholds;
    
    this.queueData.entries.forEach(entry => {
      const heatColor = getQueueHeatColor(entry.queueLength, thresholds);
      const heatLevel = getQueueHeatLevel(entry.queueLength, thresholds);
      
      const radiusMap = { low: 5, medium: 8, high: 12, critical: 16 };
      const radius = radiusMap[heatLevel] || 8;
      
      const circleGeometry = new THREE.CircleGeometry(radius, 32);
      const circleMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(heatColor),
        transparent: true,
        opacity: heatLevel === 'critical' ? 0.4 : heatLevel === 'high' ? 0.3 : 0.2,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      
      const circle = new THREE.Mesh(circleGeometry, circleMaterial);
      circle.position.copy(entry.position);
      circle.position.y = 0.15;
      circle.rotation.x = -Math.PI / 2;
      this.heatZonesGroup.add(circle);
      
      const outerGeometry = new THREE.RingGeometry(radius - 0.3, radius, 32);
      const outerMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(heatColor),
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const outer = new THREE.Mesh(outerGeometry, outerMaterial);
      outer.position.copy(entry.position);
      outer.position.y = 0.16;
      outer.rotation.x = -Math.PI / 2;
      this.heatZonesGroup.add(outer);
      
      const pulseGeometry = new THREE.RingGeometry(radius, radius + 1, 32);
      const pulseMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(heatColor),
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      pulse.position.copy(entry.position);
      pulse.position.y = 0.14;
      pulse.rotation.x = -Math.PI / 2;
      pulse.userData.pulseBase = radius;
      pulse.userData.pulseSpeed = heatLevel === 'critical' ? 2 : 1;
      this.heatZonesGroup.add(pulse);
    });
    
    this.queueData.gates.forEach(gate => {
      if (!gate.open) return;
      
      const heatColor = getQueueHeatColor(gate.queueLength, thresholds);
      const ringGeometry = new THREE.RingGeometry(1.5, 2.5, 16);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(heatColor),
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.copy(gate.position);
      ring.position.y = 0.2;
      ring.rotation.x = -Math.PI / 2;
      this.heatZonesGroup.add(ring);
    });
    
    this._renderFlowLines();
  }

  _renderFlowLines() {
    while (this.flowLinesGroup.children.length > 0) {
      const child = this.flowLinesGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.flowLinesGroup.remove(child);
    }
    
    const entries = this.queueData.entries;
    const gates = this.queueData.gates.filter(g => g.open);
    
    entries.forEach(entry => {
      const nearbyGates = gates.filter(gate => 
        gate.position.distanceTo(entry.position) < 30
      );
      
      nearbyGates.forEach(gate => {
        const intensity = Math.min(1, (entry.queueLength + gate.queueLength) / 80);
        
        const points = [];
        const start = entry.position.clone();
        start.y = 0.3;
        const end = gate.position.clone();
        end.y = 0.3;
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mid.y = 0.3;
        
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const curvePoints = curve.getPoints(30);
        
        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const color = new THREE.Color().lerpColors(
          new THREE.Color(0x22c55e),
          new THREE.Color(0xef4444),
          intensity
        );
        const material = new THREE.LineBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.3 + intensity * 0.4,
          linewidth: 1 + intensity * 2
        });
        
        const line = new THREE.Line(geometry, material);
        this.flowLinesGroup.add(line);
      });
    });
  }

  _renderVolunteers() {
    while (this.operatorsGroup.children.length > 0) {
      const child = this.operatorsGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.operatorsGroup.remove(child);
    }
    
    this.volunteerPositions.forEach(vol => {
      const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.25, 1.6, 8);
      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x0891b2,
        emissiveIntensity: 0.3,
        roughness: 0.5
      });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.position.copy(vol.position);
      body.position.y = 0.8;
      body.castShadow = true;
      this.operatorsGroup.add(body);
      
      const headGeometry = new THREE.SphereGeometry(0.2, 16, 16);
      const headMaterial = new THREE.MeshStandardMaterial({
        color: 0xfed7aa,
        roughness: 0.7
      });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.copy(vol.position);
      head.position.y = 1.8;
      this.operatorsGroup.add(head);
      
      const vestGeometry = new THREE.BoxGeometry(0.5, 0.4, 0.05);
      const vestMaterial = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.5
      });
      const vest = new THREE.Mesh(vestGeometry, vestMaterial);
      vest.position.copy(vol.position);
      vest.position.y = 1.1;
      vest.position.z += 0.2;
      this.operatorsGroup.add(vest);
    });
  }

  _renderFences() {
    this.operatorsGroup.children
      .filter(c => c.userData.isFence)
      .forEach(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
        this.operatorsGroup.remove(c);
      });
    
    this.fencePositions.forEach(fence => {
      const direction = new THREE.Vector3().subVectors(fence.end, fence.start);
      const length = direction.length();
      direction.normalize();
      
      const segmentCount = Math.ceil(length / 2);
      
      for (let i = 0; i < segmentCount; i++) {
        const t = (i + 0.5) / segmentCount;
        const pos = new THREE.Vector3().lerpVectors(fence.start, fence.end, t);
        
        const postGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6);
        const postMaterial = new THREE.MeshStandardMaterial({
          color: 0xd4d4d8,
          roughness: 0.5,
          metalness: 0.3
        });
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.copy(pos);
        post.position.y = 0.6;
        post.userData.isFence = true;
        this.operatorsGroup.add(post);
      }
      
      const barGeometry = new THREE.CylinderGeometry(0.03, 0.03, length, 8);
      const barMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4d4d8,
        roughness: 0.5,
        metalness: 0.3
      });
      
      [0.3, 0.7, 1.1].forEach(barY => {
        const bar = new THREE.Mesh(barGeometry, barMaterial);
        bar.position.lerpVectors(fence.start, fence.end, 0.5);
        bar.position.y = barY;
        bar.rotation.z = Math.PI / 2;
        const angle = Math.atan2(direction.z, direction.x);
        bar.rotation.y = -angle;
        bar.rotation.z = 0;
        bar.lookAt(new THREE.Vector3(fence.end.x, barY, fence.end.z));
        bar.userData.isFence = true;
        this.operatorsGroup.add(bar);
      });
    });
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
      const gateState = this.gateStates[gate.id];
      if (gateState && !gateState.open) return;
      
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
        color: gateState?.accessible ? 0xa855f7 : 0xf59e0b,
        speed: gateState?.accessible ? 0.3 : 0.5,
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

  clearHeatZones() {
    while (this.heatZonesGroup.children.length > 0) {
      const child = this.heatZonesGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.heatZonesGroup.remove(child);
    }
    
    while (this.flowLinesGroup.children.length > 0) {
      const child = this.flowLinesGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.flowLinesGroup.remove(child);
    }
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

  toggleHeatZones(visible) {
    this.heatZonesVisible = visible;
    this.heatZonesGroup.visible = visible;
    this.flowLinesGroup.visible = visible;

    if (visible) {
      this.renderHeatZones();
    } else {
      this.clearHeatZones();
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    if (this.flowPathsVisible) {
      this.renderFlowPaths();
    }
    if (this.heatZonesVisible) {
      this.renderHeatZones();
    }
  }

  startSimulation() {
    this.simulationRunning = true;
  }

  stopSimulation() {
    this.simulationRunning = false;
  }

  isSimulating() {
    return this.simulationRunning;
  }

  getQueueData() {
    return this.queueData;
  }

  getGateStates() {
    return this.gateStates;
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
    
    this.simulateStep(deltaTime);
    
    if (this.heatZonesVisible && this.simulationRunning) {
      this.heatZonesGroup.children.forEach(child => {
        if (child.userData.pulseBase !== undefined) {
          const scale = 1 + Math.sin(Date.now() * 0.002 * child.userData.pulseSpeed) * 0.15;
          child.scale.set(scale, scale, 1);
        }
      });
    }
  }
}
