import * as THREE from 'three';

export class SeatPreview {
  constructor(canvas, sceneManager) {
    this.canvas = canvas;
    this.sceneManager = sceneManager;
    
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    
    this.camera = new THREE.PerspectiveCamera(
      70,
      canvas.width / canvas.height,
      0.1,
      500
    );
    
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.width, canvas.height, false);
    
    this.stadiumGroup = new THREE.Group();
    this.scene.add(this.stadiumGroup);
    
    this._setupLights();
    this._setupStage();
    
    this.currentSeat = null;
    this.animationId = null;
    this.isVisible = false;
  }

  _setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
    this.scene.add(directionalLight);
  }

  _setupStage() {
    const stageGeometry = new THREE.BoxGeometry(30, 2, 15);
    const stageMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.3
    });
    const stage = new THREE.Mesh(stageGeometry, stageMaterial);
    stage.position.set(0, 1, -35);
    this.stadiumGroup.add(stage);
    
    const speakerGeometry = new THREE.BoxGeometry(1.5, 3, 1);
    const speakerMaterial = new THREE.MeshStandardMaterial({ color: 0x111827 });
    
    [-1, 1].forEach(side => {
      const speaker = new THREE.Mesh(speakerGeometry, speakerMaterial);
      speaker.position.set(side * 17, 3, -37);
      this.stadiumGroup.add(speaker);
    });
    
    const floorGeometry = new THREE.CircleGeometry(40, 32);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.05;
    this.stadiumGroup.add(floor);
  }

  showFromSeat(seatData) {
    this.currentSeat = seatData;
    
    const seatPos = seatData.position.clone();
    seatPos.y += 1.2;
    
    this.camera.position.copy(seatPos);
    
    const lookAtPoint = new THREE.Vector3(0, 3, -35);
    this.camera.lookAt(lookAtPoint);
    
    this._render();
    
    return {
      seatId: seatData.id,
      zone: seatData.zone,
      row: seatData.row,
      seat: seatData.seat,
      viewAngle: this.camera.fov
    };
  }

  _render() {
    if (!this.isVisible) return;
    this.renderer.render(this.scene, this.camera);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.isVisible) {
      this._render();
    }
  }

  show() {
    this.isVisible = true;
    this._render();
  }

  hide() {
    this.isVisible = false;
  }

  dispose() {
    this.renderer.dispose();
  }
}
