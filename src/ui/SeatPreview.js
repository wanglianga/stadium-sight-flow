import * as THREE from 'three';
import { SCENE_CONFIGS } from '../config/scenes.js';

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

    this.stageGroup = new THREE.Group();
    this.stadiumGroup.add(this.stageGroup);

    this.currentSceneType = 'concert';
    this.currentSeat = null;
    this.animationId = null;
    this.isVisible = false;

    this._setupLights();
    this._buildStage();
    this._setupFloor();
  }

  setSceneType(sceneType) {
    this.currentSceneType = sceneType;
    this._buildStage();

    if (this.currentSeat) {
      this.showFromSeat(this.currentSeat);
    }
  }

  _setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
    this.scene.add(directionalLight);
  }

  _setupFloor() {
    const floorGeometry = new THREE.CircleGeometry(50, 32);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.05;
    this.stadiumGroup.add(floor);
  }

  _buildStage() {
    while (this.stageGroup.children.length > 0) {
      const child = this.stageGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      this.stageGroup.remove(child);
    }

    const config = SCENE_CONFIGS[this.currentSceneType];
    const stagePos = config.stagePosition;
    const stageSize = config.stageSize;

    const stageGeometry = new THREE.BoxGeometry(stageSize.width, stageSize.height, stageSize.depth);
    const stageMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.3
    });
    const stage = new THREE.Mesh(stageGeometry, stageMaterial);
    stage.position.set(stagePos.x, stageSize.height / 2, stagePos.z);
    this.stageGroup.add(stage);

    if (config.stageType === 'concert') {
      this._buildConcertStage(config);
    } else if (config.stageType === 'court') {
      this._buildCourt(config);
    } else if (config.stageType === 'family') {
      this._buildFamilyStage(config);
    }
  }

  _buildConcertStage(config) {
    const speakerGeometry = new THREE.BoxGeometry(1.5, 3, 1);
    const speakerMaterial = new THREE.MeshStandardMaterial({ color: 0x111827 });

    [-1, 1].forEach(side => {
      const speaker = new THREE.Mesh(speakerGeometry, speakerMaterial);
      speaker.position.set(
        config.stagePosition.x + side * (config.stageSize.width / 2 + 2),
        3,
        config.stagePosition.z - 2
      );
      this.stageGroup.add(speaker);
    });
  }

  _buildCourt(config) {
    const courtGeometry = new THREE.PlaneGeometry(config.stageSize.width, config.stageSize.depth);
    const courtMaterial = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.9
    });
    const court = new THREE.Mesh(courtGeometry, courtMaterial);
    court.rotation.x = -Math.PI / 2;
    court.position.set(config.stagePosition.x, config.stageSize.height + 0.01, config.stagePosition.z);
    this.stageGroup.add(court);

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const outerPoints = [
      new THREE.Vector3(-config.stageSize.width / 2, config.stageSize.height + 0.02, -config.stageSize.depth / 2),
      new THREE.Vector3(config.stageSize.width / 2, config.stageSize.height + 0.02, -config.stageSize.depth / 2),
      new THREE.Vector3(config.stageSize.width / 2, config.stageSize.height + 0.02, config.stageSize.depth / 2),
      new THREE.Vector3(-config.stageSize.width / 2, config.stageSize.height + 0.02, config.stageSize.depth / 2),
      new THREE.Vector3(-config.stageSize.width / 2, config.stageSize.height + 0.02, -config.stageSize.depth / 2)
    ];
    const outerLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outerPoints), lineMaterial);
    outerLine.position.set(config.stagePosition.x, 0, config.stagePosition.z);
    this.stageGroup.add(outerLine);
  }

  _buildFamilyStage(config) {
    const balloonColors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181];
    for (let i = 0; i < 8; i++) {
      const balloonGeometry = new THREE.SphereGeometry(0.4 + Math.random() * 0.2, 16, 16);
      const balloonMaterial = new THREE.MeshStandardMaterial({
        color: balloonColors[i % balloonColors.length],
        roughness: 0.3
      });
      const balloon = new THREE.Mesh(balloonGeometry, balloonMaterial);
      balloon.position.set(
        config.stagePosition.x + (Math.random() - 0.5) * config.stageSize.width * 0.7,
        config.stageSize.height + 1.5 + Math.random() * 2,
        config.stagePosition.z + (Math.random() - 0.5) * config.stageSize.depth * 0.4
      );
      this.stageGroup.add(balloon);
    }
  }

  _getStageLookAtPoint() {
    const config = SCENE_CONFIGS[this.currentSceneType];
    const stagePos = config.stagePosition;
    const stageHeight = config.stageSize.height;
    return new THREE.Vector3(stagePos.x, stageHeight + 2, stagePos.z);
  }

  showFromSeat(seatData) {
    this.currentSeat = seatData;

    const seatPos = seatData.position.clone();
    seatPos.y += 1.2;

    this.camera.position.copy(seatPos);

    const lookAtPoint = this._getStageLookAtPoint();
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
