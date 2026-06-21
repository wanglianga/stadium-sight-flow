import './styles/main.css';
import * as THREE from 'three';
import { SceneManager } from './core/SceneManager.js';
import { StadiumBuilder } from './builders/StadiumBuilder.js';
import { FacilityBuilder } from './builders/FacilityBuilder.js';
import { SightAnalysis } from './analysis/SightAnalysis.js';
import { FlowAnalysis } from './analysis/FlowAnalysis.js';
import { SeatPreview } from './ui/SeatPreview.js';
import { UIController } from './ui/UIController.js';

class StadiumApp {
  constructor() {
    this.sceneManager = null;
    this.stadiumBuilder = null;
    this.facilityBuilder = null;
    this.sightAnalysis = null;
    this.flowAnalysis = null;
    this.seatPreview = null;
    this.uiController = null;
    
    this.selectedSeat = null;
    this.hoveredSeat = null;
    this.currentViewMode = 'overview';
    this.currentSceneType = 'concert';
    
    this._init();
  }

  _init() {
    const canvas = document.getElementById('scene-canvas');
    this.sceneManager = new SceneManager(canvas);
    
    this.stadiumBuilder = new StadiumBuilder(this.sceneManager);
    this.stadiumBuilder.build();
    
    this.facilityBuilder = new FacilityBuilder(this.sceneManager);
    this.facilityBuilder.build();
    
    this.sightAnalysis = new SightAnalysis(this.sceneManager, this.stadiumBuilder);
    this.flowAnalysis = new FlowAnalysis(this.sceneManager, this.stadiumBuilder, this.facilityBuilder);
    
    const previewCanvas = document.getElementById('preview-canvas');
    previewCanvas.width = 320;
    previewCanvas.height = 200;
    this.seatPreview = new SeatPreview(previewCanvas, this.sceneManager);
    
    this.uiController = new UIController(this);
    
    this._setupEventListeners();
    this._updateStats();
    
    this.sceneManager.onAnimate = () => this._animate();
    this.sceneManager.startAnimation();
  }

  _setupEventListeners() {
    this.sceneManager.canvas.addEventListener('click', (event) => this._onCanvasClick(event));
    this.sceneManager.canvas.addEventListener('mousemove', (event) => this._onCanvasMouseMove(event));
    
    this.sceneManager.canvas.style.cursor = 'grab';
  }

  _onCanvasClick(event) {
    const seatMeshes = this.stadiumBuilder.seatMeshes.filter(m => m.visible);
    const intersects = this.sceneManager.getIntersects(event, seatMeshes);
    
    if (intersects.length > 0) {
      let seatObject = intersects[0].object;
      while (seatObject.parent && !seatObject.userData.seatData) {
        seatObject = seatObject.parent;
      }
      
      if (seatObject.userData.seatData) {
        this._selectSeat(seatObject.userData.seatData);
      }
    } else {
      this._deselectSeat();
    }
  }

  _onCanvasMouseMove(event) {
    const seatMeshes = this.stadiumBuilder.seatMeshes.filter(m => m.visible);
    const intersects = this.sceneManager.getIntersects(event, seatMeshes);
    
    if (intersects.length > 0) {
      let seatObject = intersects[0].object;
      while (seatObject.parent && !seatObject.userData.seatData) {
        seatObject = seatObject.parent;
      }
      
      if (seatObject.userData.seatData) {
        this._hoverSeat(seatObject.userData.seatData, seatObject);
        this.sceneManager.canvas.style.cursor = 'pointer';
      }
    } else {
      this._unhoverSeat();
      this.sceneManager.canvas.style.cursor = 'grab';
    }
  }

  _selectSeat(seatData) {
    if (this.selectedSeat && this.selectedSeat.id === seatData.id) {
      return;
    }
    
    this._deselectSeat();
    
    this.selectedSeat = seatData;
    
    const seatMesh = this.stadiumBuilder.seatMeshes.find(m => m.userData.seatData.id === seatData.id);
    if (seatMesh) {
      seatMesh.traverse(child => {
        if (child.isMesh && child.material) {
          child.userData.originalMaterialColor = child.material.color.getHex();
          child.material = child.material.clone();
          child.material.emissive = new THREE.Color(0x3b82f6);
          child.material.emissiveIntensity = 0.5;
        }
      });
    }
    
    const analysis = this.sightAnalysis.analyzeSeat(seatData);
    this.sightAnalysis.showSightLine(seatData);
    
    this.uiController.updateSeatInfo(seatData, analysis);
    
    this.seatPreview.showFromSeat(seatData);
    
    const previewEl = document.getElementById('view-preview');
    if (!previewEl.classList.contains('hidden')) {
      this.seatPreview.show();
    }
  }

  _deselectSeat() {
    if (this.selectedSeat) {
      const seatMesh = this.stadiumBuilder.seatMeshes.find(
        m => m.userData.seatData.id === this.selectedSeat.id
      );
      if (seatMesh) {
        seatMesh.traverse(child => {
          if (child.isMesh && child.material && child.userData.originalMaterialColor !== undefined) {
            child.material.emissive = new THREE.Color(0x000000);
            child.material.emissiveIntensity = 0;
            delete child.userData.originalMaterialColor;
          }
        });
      }
      
      this.selectedSeat = null;
    }
    
    this.sightAnalysis.clearSightLines();
    this.uiController.updateSeatInfo(null, null);
    this.seatPreview.hide();
  }

  _hoverSeat(seatData, seatMesh) {
    if (this.hoveredSeat && this.hoveredSeat.id === seatData.id) {
      return;
    }
    
    this._unhoverSeat();
    
    if (this.selectedSeat && this.selectedSeat.id === seatData.id) {
      return;
    }
    
    this.hoveredSeat = seatData;
    
    seatMesh.traverse(child => {
      if (child.isMesh && child.material) {
        child.userData.hoverOriginalColor = child.material.color.getHex();
        child.material = child.material.clone();
        child.material.color.multiplyScalar(1.3);
      }
    });
  }

  _unhoverSeat() {
    if (this.hoveredSeat) {
      const seatMesh = this.stadiumBuilder.seatMeshes.find(
        m => m.userData.seatData.id === this.hoveredSeat.id
      );
      if (seatMesh && !this.selectedSeat || this.selectedSeat.id !== this.hoveredSeat.id) {
        seatMesh.traverse(child => {
          if (child.isMesh && child.material && child.userData.hoverOriginalColor !== undefined) {
            child.material.color.setHex(child.userData.hoverOriginalColor);
            delete child.userData.hoverOriginalColor;
          }
        });
      }
      this.hoveredSeat = null;
    }
  }

  setSceneType(sceneType) {
    this.currentSceneType = sceneType;
    this.stadiumBuilder.setSceneType(sceneType);
    this.facilityBuilder.setSceneType(sceneType);
    this.sightAnalysis.setSceneType(sceneType);
    this.flowAnalysis.setSceneType(sceneType);
    this.seatPreview.setSceneType(sceneType);
    this.sightAnalysis.updateForSceneChange();
    this.flowAnalysis.renderFlowPaths();
    this._updateStats();
    
    this._deselectSeat();
  }

  setViewMode(mode) {
    this.currentViewMode = mode;
    this.flowAnalysis.setMode(mode);
    
    switch (mode) {
      case 'ticket':
        this._setCameraPosition(80, 80, 80);
        break;
      case 'operation':
        this._setCameraPosition(0, 120, 0.1);
        break;
      case 'audience':
        this._setCameraPosition(60, 40, 60);
        break;
      case 'overview':
      default:
        this._setCameraPosition(80, 60, 80);
        break;
    }
  }

  _setCameraPosition(x, y, z) {
    this.sceneManager.camera.position.set(x, y, z);
    this.sceneManager.controls.target.set(0, 5, 0);
    this.sceneManager.controls.update();
  }

  setZoneVisible(zone, visible) {
    this.stadiumBuilder.setZoneVisible(zone, visible);
    this.sightAnalysis.updateForSceneChange();
  }

  setLayerVisible(layer, visible) {
    switch (layer) {
      case 'seats':
        this.stadiumBuilder.seatsGroup.visible = visible;
        break;
      case 'seat-labels':
        this.stadiumBuilder.setLabelsVisible(visible);
        break;
      case 'sight-lines':
        this.sightAnalysis.toggleSightLines(visible);
        if (visible && this.selectedSeat) {
          this.sightAnalysis.showSightLine(this.selectedSeat);
        }
        break;
      case 'heatmap':
        this.sightAnalysis.toggleHeatmap(visible);
        break;
      case 'flow-paths':
        this.flowAnalysis.toggleFlowPaths(visible);
        break;
      default:
        this.facilityBuilder.setLayerVisible(layer, visible);
        break;
    }
  }

  _updateStats() {
    const total = this.stadiumBuilder.getTotalSeatCount();
    const available = this.stadiumBuilder.getSeatCount();
    const accessible = this.stadiumBuilder.getAccessibleSeatCount();
    const security = this.facilityBuilder.getSecurityGateCount();
    
    this.uiController.updateStats(total, available, accessible, security);
  }

  _animate() {
    const deltaTime = 0.016;
    
    this.stadiumBuilder.animate(deltaTime);
    this.flowAnalysis.animate(deltaTime);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new StadiumApp();
});
