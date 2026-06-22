import * as THREE from 'three';
import { SCENE_CONFIGS, OBSTRUCTION_GRADES } from '../config/scenes.js';
import { getSightQualityColor, getSightQualityLabel, getSightQualityClass, getObstructionGrade, getObstructionGradeInfo } from '../utils/three-utils.js';

export class SightAnalysis {
  constructor(sceneManager, stadiumBuilder) {
    this.sceneManager = sceneManager;
    this.stadiumBuilder = stadiumBuilder;
    
    this.sightLinesGroup = new THREE.Group();
    this.heatmapGroup = new THREE.Group();
    this.coneGroup = new THREE.Group();
    this.obstructionMarkersGroup = new THREE.Group();
    
    this.currentSeat = null;
    this.currentSceneType = 'concert';
    this.sightLinesVisible = false;
    this.heatmapVisible = false;
    this.coneVisible = false;
    this.obstructionMarkersVisible = false;
    
    this.detectedObstructions = [];
    
    this.sceneManager.add(this.sightLinesGroup);
    this.sceneManager.add(this.heatmapGroup);
    this.sceneManager.add(this.coneGroup);
    this.sceneManager.add(this.obstructionMarkersGroup);
  }

  setSceneType(sceneType) {
    this.currentSceneType = sceneType;
  }

  _getStageCenter() {
    const config = SCENE_CONFIGS[this.currentSceneType];
    const stagePos = config.stagePosition;
    const stageHeight = config.stageSize.height;
    return new THREE.Vector3(stagePos.x, stageHeight + 1, stagePos.z);
  }

  _getStageTargetPoints() {
    const config = SCENE_CONFIGS[this.currentSceneType];
    const stagePos = config.stagePosition;
    const stageSize = config.stageSize;
    const stageHeight = stageSize.height;
    const halfWidth = stageSize.width / 2;
    const halfDepth = stageSize.depth / 2;

    return [
      new THREE.Vector3(stagePos.x - halfWidth, stageHeight + 0.5, stagePos.z),
      new THREE.Vector3(stagePos.x, stageHeight + 1, stagePos.z),
      new THREE.Vector3(stagePos.x + halfWidth, stageHeight + 0.5, stagePos.z),
      new THREE.Vector3(stagePos.x, stageHeight + 3, stagePos.z),
      new THREE.Vector3(stagePos.x, stageHeight + 0.1, stagePos.z - halfDepth),
      new THREE.Vector3(stagePos.x, stageHeight + 0.1, stagePos.z + halfDepth)
    ];
  }

  _getStageAngle() {
    const config = SCENE_CONFIGS[this.currentSceneType];
    const stagePos = config.stagePosition;
    return Math.atan2(stagePos.z, stagePos.x);
  }

  analyzeSeat(seatData) {
    this.currentSeat = seatData;
    
    const stageCenter = this._getStageCenter();
    const seatPos = seatData.position.clone();
    seatPos.y += 1.2;
    
    const direction = new THREE.Vector3().subVectors(stageCenter, seatPos);
    const distance = direction.length();
    direction.normalize();
    
    const obstructionResults = this._detectObstructions(seatPos, stageCenter, seatData);
    
    let obstructionFactor = 1.0;
    obstructionResults.forEach(obs => {
      switch (obs.severity) {
        case 'major': obstructionFactor -= 0.25; break;
        case 'moderate': obstructionFactor -= 0.15; break;
        case 'minor': obstructionFactor -= 0.05; break;
      }
    });
    obstructionFactor = Math.max(0.1, obstructionFactor);
    
    const distanceFactor = Math.max(0.5, 1 - distance / 150);
    const angleFactor = this._calculateAngleFactor(seatData);
    const elevationFactor = this._calculateElevationFactor(seatData);
    const frontRowFactor = this._calculateFrontRowFactor(seatData);
    
    const quality = Math.min(1, Math.max(0, 
      obstructionFactor * 0.4 + 
      distanceFactor * 0.25 + 
      angleFactor * 0.15 +
      elevationFactor * 0.1 +
      frontRowFactor * 0.1
    ));
    
    const obstructionScore = obstructionFactor * 0.5 + frontRowFactor * 0.3 + distanceFactor * 0.2;
    const grade = getObstructionGrade(obstructionScore);
    const gradeInfo = getObstructionGradeInfo(grade);
    
    this.detectedObstructions = obstructionResults;
    
    return {
      quality,
      distance: distance.toFixed(1),
      obstruction: obstructionResults.length > 0,
      obstructionCount: obstructionResults.length,
      obstructionDetails: obstructionResults,
      angle: angleFactor.toFixed(2),
      qualityLabel: getSightQualityLabel(quality),
      qualityColor: getSightQualityColor(quality),
      qualityClass: getSightQualityClass(quality),
      grade: grade,
      gradeInfo: gradeInfo,
      frontRowFactor: frontRowFactor,
      obstructionScore: obstructionScore
    };
  }

  _detectObstructions(seatPos, stageCenter, seatData) {
    const obstructions = [];
    const obstructionObjects = this.stadiumBuilder.getObstructionObjects();
    
    const ray = new THREE.Raycaster();
    const direction = new THREE.Vector3().subVectors(stageCenter, seatPos).normalize();
    ray.set(seatPos, direction);
    
    obstructionObjects.forEach(obs => {
      if (obs.type === 'railing') {
        if (this._checkRailingObstruction(seatPos, stageCenter, obs, seatData)) {
          obstructions.push({
            type: 'railing',
            label: obs.label,
            severity: obs.severity,
            zone: obs.zone,
            row: obs.row
          });
        }
      } else if (obs.boundingBox) {
        if (this._checkBoundingBoxObstruction(seatPos, stageCenter, obs)) {
          obstructions.push({
            type: obs.type,
            label: obs.label,
            severity: obs.severity
          });
        }
      }
    });
    
    return obstructions;
  }

  _checkRailingObstruction(seatPos, stageCenter, railing, seatData) {
    if (seatData.zone !== railing.zone && seatData.row !== railing.row) {
      if (seatData.row <= railing.row) return false;
    }
    
    const seatAngle = Math.atan2(seatPos.z, seatPos.x);
    if (seatAngle < railing.startAngle || seatAngle > railing.endAngle) return false;
    
    const seatRadius = Math.sqrt(seatPos.x * seatPos.x + seatPos.z * seatPos.z);
    const stageRadius = Math.sqrt(stageCenter.x * stageCenter.x + stageCenter.z * stageCenter.z);
    
    if (seatRadius <= railing.radius && stageRadius < railing.radius) return false;
    if (seatRadius > railing.radius) return false;
    
    if (seatData.row > railing.row && seatPos.y < railing.y + 0.5) {
      return true;
    }
    
    return false;
  }

  _checkBoundingBoxObstruction(seatPos, stageCenter, obs) {
    const direction = new THREE.Vector3().subVectors(stageCenter, seatPos);
    const distance = direction.length();
    direction.normalize();
    
    const steps = 10;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const point = seatPos.clone().add(direction.clone().multiplyScalar(distance * t));
      
      if (point.x >= obs.boundingBox.min.x && point.x <= obs.boundingBox.max.x &&
          point.y >= obs.boundingBox.min.y && point.y <= obs.boundingBox.max.y &&
          point.z >= obs.boundingBox.min.z && point.z <= obs.boundingBox.max.z) {
        return true;
      }
    }
    
    return false;
  }

  _calculateAngleFactor(seatData) {
    const config = SCENE_CONFIGS[this.currentSceneType];
    if (config.stageType === 'court') {
      return 1;
    }

    const stageAngle = this._getStageAngle();
    const seatAngle = seatData.angle;
    let angleDiff = Math.abs(seatAngle - stageAngle);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    return Math.max(0.3, 1 - angleDiff / Math.PI);
  }

  _calculateElevationFactor(seatData) {
    const elevation = seatData.position.y;
    return Math.min(1, 0.5 + elevation / 20);
  }

  _calculateFrontRowFactor(seatData) {
    if (seatData.row <= 2) return 0.7;
    if (seatData.row <= 5) return 0.85;
    if (seatData.row <= 8) return 0.95;
    return 1.0;
  }

  showSightLine(seatData) {
    this.clearSightLines();
    
    if (!this.sightLinesVisible) return;
    
    const analysis = this.analyzeSeat(seatData);
    
    const seatPos = seatData.position.clone();
    seatPos.y += 1.2;
    
    const targetPoints = this._getStageTargetPoints();
    
    targetPoints.forEach(target => {
      const points = [seatPos.clone(), target.clone()];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      const color = analysis.obstruction ? 0xef4444 : 0x22c55e;
      const material = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.8
      });
      
      const line = new THREE.Line(geometry, material);
      this.sightLinesGroup.add(line);
      
      const dotGeometry = new THREE.SphereGeometry(0.2, 8, 8);
      const dotMaterial = new THREE.MeshBasicMaterial({ color: color });
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.position.copy(target);
      this.sightLinesGroup.add(dot);
    });
    
    const eyeGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    eye.position.copy(seatPos);
    this.sightLinesGroup.add(eye);
  }

  showSightCone(seatData) {
    this.clearSightCone();
    
    if (!this.coneVisible) return;
    
    const seatPos = seatData.position.clone();
    seatPos.y += 1.2;
    const stageCenter = this._getStageCenter();
    
    const direction = new THREE.Vector3().subVectors(stageCenter, seatPos);
    const distance = direction.length();
    
    const fovAngle = 60;
    const halfAngle = (fovAngle / 2) * Math.PI / 180;
    const endRadius = Math.tan(halfAngle) * distance;
    
    const segments = 32;
    const coneVertices = [seatPos.x, seatPos.y, seatPos.z];
    const coneIndices = [];
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const localX = Math.cos(angle) * endRadius;
      const localY = Math.sin(angle) * endRadius;
      
      const right = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      right.crossVectors(direction.clone().normalize(), up).normalize();
      if (right.length() < 0.001) {
        right.set(1, 0, 0);
      }
      const correctedUp = new THREE.Vector3().crossVectors(right, direction.clone().normalize()).normalize();
      
      const targetPoint = stageCenter.clone()
        .add(right.clone().multiplyScalar(localX))
        .add(correctedUp.clone().multiplyScalar(localY));
      
      coneVertices.push(targetPoint.x, targetPoint.y, targetPoint.z);
    }
    
    for (let i = 0; i < segments; i++) {
      coneIndices.push(0, i + 1, i + 2);
    }
    
    const coneGeometry = new THREE.BufferGeometry();
    coneGeometry.setAttribute('position', new THREE.Float32BufferAttribute(coneVertices, 3));
    coneGeometry.setIndex(coneIndices);
    coneGeometry.computeVertexNormals();
    
    const analysis = this.analyzeSeat(seatData);
    const gradeInfo = analysis.gradeInfo;
    
    const coneMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(gradeInfo.color),
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    this.coneGroup.add(cone);
    
    const edgeVertices = [];
    for (let i = 0; i <= segments; i++) {
      const idx = (i + 1) * 3;
      edgeVertices.push(coneVertices[idx], coneVertices[idx + 1], coneVertices[idx + 2]);
    }
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(gradeInfo.color),
      transparent: true,
      opacity: 0.6
    });
    const edge = new THREE.Line(edgeGeometry, edgeMaterial);
    this.coneGroup.add(edge);
    
    for (let i = 0; i < 4; i++) {
      const idx = Math.floor((i / 4) * segments) * 3 + 3;
      const linePoints = [
        new THREE.Vector3(seatPos.x, seatPos.y, seatPos.z),
        new THREE.Vector3(coneVertices[idx], coneVertices[idx + 1], coneVertices[idx + 2])
      ];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(gradeInfo.color),
        transparent: true,
        opacity: 0.4
      });
      const line = new THREE.Line(lineGeom, lineMat);
      this.coneGroup.add(line);
    }
    
    if (analysis.obstruction) {
      this.showObstructionMarkers(seatData, analysis);
    }
  }

  showObstructionMarkers(seatData, analysis) {
    this.clearObstructionMarkers();
    
    if (!this.obstructionMarkersVisible) return;
    
    const seatPos = seatData.position.clone();
    seatPos.y += 1.2;
    const stageCenter = this._getStageCenter();
    
    analysis.obstructionDetails.forEach(obs => {
      const obsObj = this.stadiumBuilder.getObstructionObjects().find(o => o.label === obs.label);
      if (!obsObj) return;
      
      const markerPos = obsObj.position.clone();
      
      const ringGeometry = new THREE.RingGeometry(1.5, 2, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: obs.severity === 'major' ? 0xef4444 : obs.severity === 'moderate' ? 0xf97316 : 0xeab308,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.copy(markerPos);
      ring.position.y += 0.5;
      ring.rotation.x = -Math.PI / 2;
      this.obstructionMarkersGroup.add(ring);
      
      const linePoints = [seatPos.clone(), markerPos.clone()];
      const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.5,
        dashSize: 1,
        gapSize: 0.5
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.computeLineDistances();
      this.obstructionMarkersGroup.add(line);
      
      const pinGeometry = new THREE.ConeGeometry(0.3, 1, 8);
      const pinMaterial = new THREE.MeshBasicMaterial({
        color: obs.severity === 'major' ? 0xef4444 : obs.severity === 'moderate' ? 0xf97316 : 0xeab308
      });
      const pin = new THREE.Mesh(pinGeometry, pinMaterial);
      pin.position.copy(markerPos);
      pin.position.y += 2;
      pin.rotation.x = Math.PI;
      this.obstructionMarkersGroup.add(pin);
    });
  }

  clearSightLines() {
    while (this.sightLinesGroup.children.length > 0) {
      const child = this.sightLinesGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.sightLinesGroup.remove(child);
    }
  }

  clearSightCone() {
    while (this.coneGroup.children.length > 0) {
      const child = this.coneGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.coneGroup.remove(child);
    }
  }

  clearObstructionMarkers() {
    while (this.obstructionMarkersGroup.children.length > 0) {
      const child = this.obstructionMarkersGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.obstructionMarkersGroup.remove(child);
    }
  }

  toggleSightLines(visible) {
    this.sightLinesVisible = visible;
    this.sightLinesGroup.visible = visible;
    if (visible && this.currentSeat) {
      this.showSightLine(this.currentSeat);
    }
  }

  toggleSightCone(visible) {
    this.coneVisible = visible;
    this.coneGroup.visible = visible;
    if (visible && this.currentSeat) {
      this.showSightCone(this.currentSeat);
    } else if (!visible) {
      this.clearSightCone();
    }
  }

  toggleObstructionMarkers(visible) {
    this.obstructionMarkersVisible = visible;
    this.obstructionMarkersGroup.visible = visible;
    if (visible && this.currentSeat) {
      const analysis = this.analyzeSeat(this.currentSeat);
      if (analysis.obstruction) {
        this.showObstructionMarkers(this.currentSeat, analysis);
      }
    } else if (!visible) {
      this.clearObstructionMarkers();
    }
  }

  showHeatmap() {
    this.clearHeatmap();
    
    if (!this.heatmapVisible) return;
    
    const seats = this.stadiumBuilder.seats.filter(s => s.available);
    
    seats.forEach(seat => {
      const analysis = this.analyzeSeat(seat);
      
      const heatGeometry = new THREE.CircleGeometry(0.4, 16);
      const heatMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(analysis.gradeInfo.color),
        transparent: true,
        opacity: 0.6
      });
      const heat = new THREE.Mesh(heatGeometry, heatMaterial);
      heat.rotation.x = -Math.PI / 2;
      heat.position.copy(seat.position);
      heat.position.y += 0.05;
      
      heat.userData.seatId = seat.id;
      this.heatmapGroup.add(heat);
    });
  }

  clearHeatmap() {
    while (this.heatmapGroup.children.length > 0) {
      const child = this.heatmapGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.heatmapGroup.remove(child);
    }
  }

  toggleHeatmap(visible) {
    this.heatmapVisible = visible;
    this.heatmapGroup.visible = visible;
    if (visible) {
      this.showHeatmap();
    } else {
      this.clearHeatmap();
    }
  }

  updateForSceneChange() {
    if (this.heatmapVisible) {
      this.showHeatmap();
    }
    if (this.sightLinesVisible && this.currentSeat) {
      this.showSightLine(this.currentSeat);
    }
    if (this.coneVisible && this.currentSeat) {
      this.showSightCone(this.currentSeat);
    }
    if (this.obstructionMarkersVisible && this.currentSeat) {
      const analysis = this.analyzeSeat(this.currentSeat);
      if (analysis.obstruction) {
        this.showObstructionMarkers(this.currentSeat, analysis);
      }
    }
  }
}
