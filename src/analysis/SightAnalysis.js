import * as THREE from 'three';
import { getSightQualityColor, getSightQualityLabel, getSightQualityClass } from '../utils/three-utils.js';

export class SightAnalysis {
  constructor(sceneManager, stadiumBuilder) {
    this.sceneManager = sceneManager;
    this.stadiumBuilder = stadiumBuilder;
    
    this.sightLinesGroup = new THREE.Group();
    this.heatmapGroup = new THREE.Group();
    
    this.currentSeat = null;
    this.sightLinesVisible = false;
    this.heatmapVisible = false;
    
    this.sceneManager.add(this.sightLinesGroup);
    this.sceneManager.add(this.heatmapGroup);
  }

  analyzeSeat(seatData) {
    this.currentSeat = seatData;
    
    const stageCenter = new THREE.Vector3(0, 2, -35);
    const seatPos = seatData.position.clone();
    seatPos.y += 1.2;
    
    const direction = new THREE.Vector3().subVectors(stageCenter, seatPos);
    const distance = direction.length();
    direction.normalize();
    
    let obstructionCount = 0;
    const totalChecks = 5;
    
    for (let i = 1; i <= totalChecks; i++) {
      const checkPoint = seatPos.clone().add(direction.clone().multiplyScalar(distance * i / totalChecks));
      if (this._checkObstruction(checkPoint)) {
        obstructionCount++;
      }
    }
    
    const obstructionFactor = 1 - (obstructionCount / totalChecks) * 0.3;
    const distanceFactor = Math.max(0.5, 1 - distance / 150);
    const angleFactor = this._calculateAngleFactor(seatData);
    const elevationFactor = this._calculateElevationFactor(seatData);
    
    const quality = Math.min(1, Math.max(0, 
      obstructionFactor * 0.4 + 
      distanceFactor * 0.3 + 
      angleFactor * 0.2 +
      elevationFactor * 0.1
    ));
    
    return {
      quality,
      distance: distance.toFixed(1),
      obstruction: obstructionCount > 0,
      angle: angleFactor.toFixed(2),
      qualityLabel: getSightQualityLabel(quality),
      qualityColor: getSightQualityColor(quality),
      qualityClass: getSightQualityClass(quality)
    };
  }

  _checkObstruction(point) {
    const seats = this.stadiumBuilder.seatMeshes;
    for (const seat of seats) {
      if (!seat.visible) continue;
      const seatPos = seat.position;
      const dist = seatPos.distanceTo(point);
      if (dist < 2 && point.y < seatPos.y + 1) {
        return true;
      }
    }
    return false;
  }

  _calculateAngleFactor(seatData) {
    const stageAngle = -Math.PI / 2;
    const seatAngle = seatData.angle;
    let angleDiff = Math.abs(seatAngle - stageAngle);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    return Math.max(0.3, 1 - angleDiff / Math.PI);
  }

  _calculateElevationFactor(seatData) {
    const elevation = seatData.position.y;
    return Math.min(1, 0.5 + elevation / 20);
  }

  showSightLine(seatData) {
    this.clearSightLines();
    
    if (!this.sightLinesVisible) return;
    
    const analysis = this.analyzeSeat(seatData);
    
    const seatPos = seatData.position.clone();
    seatPos.y += 1.2;
    
    const targetPoints = [
      new THREE.Vector3(-15, 2, -35),
      new THREE.Vector3(0, 2, -35),
      new THREE.Vector3(15, 2, -35),
      new THREE.Vector3(0, 5, -35),
      new THREE.Vector3(0, 0, -35)
    ];
    
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

  clearSightLines() {
    while (this.sightLinesGroup.children.length > 0) {
      const child = this.sightLinesGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.sightLinesGroup.remove(child);
    }
  }

  toggleSightLines(visible) {
    this.sightLinesVisible = visible;
    this.sightLinesGroup.visible = visible;
    if (visible && this.currentSeat) {
      this.showSightLine(this.currentSeat);
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
        color: new THREE.Color(analysis.qualityColor),
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
  }
}
