import * as THREE from 'three';
import { ZONE_CONFIGS, STADIUM_CONFIG, SCENE_CONFIGS } from '../config/scenes.js';

export class StadiumBuilder {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.stadiumGroup = new THREE.Group();
    this.seatsGroup = new THREE.Group();
    this.seatLabelsGroup = new THREE.Group();
    this.structureGroup = new THREE.Group();
    this.stageGroup = new THREE.Group();
    
    this.seats = [];
    this.seatMeshes = [];
    this.zoneGroups = {};
    
    this.currentSceneType = 'concert';
    this.showLabels = false;
    
    this._initGroups();
  }

  _initGroups() {
    this.stadiumGroup.add(this.structureGroup);
    this.stadiumGroup.add(this.seatsGroup);
    this.stadiumGroup.add(this.seatLabelsGroup);
    this.stadiumGroup.add(this.stageGroup);
    this.sceneManager.add(this.stadiumGroup);
    
    Object.keys(ZONE_CONFIGS).forEach(zone => {
      this.zoneGroups[zone] = new THREE.Group();
      this.seatsGroup.add(this.zoneGroups[zone]);
    });
  }

  build() {
    this._buildStructure();
    this._buildSeats();
    this._buildStage();
    this._buildFloor();
    return this.stadiumGroup;
  }

  _buildStructure() {
    const { innerRadius, outerRadius, concourseHeight } = STADIUM_CONFIG;
    
    for (let level = 0; level < 3; level++) {
      const shape = new THREE.Shape();
      const outerR = outerRadius - level * 2;
      const innerR = innerRadius + level * 3;
      const y = level * 5;
      
      shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
      shape.absarc(0, 0, innerR, 0, Math.PI * 2, true);
      
      const extrudeSettings = {
        depth: 1.5,
        bevelEnabled: false
      };
      
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, y, 0);
      
      const material = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.8,
        metalness: 0.2
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.structureGroup.add(mesh);
    }
    
    const roofGeometry = new THREE.RingGeometry(outerRadius - 3, outerRadius + 8, 64);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      roughness: 0.5,
      metalness: 0.5
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.rotation.x = -Math.PI / 2;
    roof.position.y = 18;
    this.structureGroup.add(roof);
    
    const supportGeometry = new THREE.CylinderGeometry(0.5, 0.8, 18, 8);
    const supportMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.6,
      metalness: 0.4
    });
    
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const support = new THREE.Mesh(supportGeometry, supportMaterial);
      support.position.set(
        Math.cos(angle) * (outerRadius + 3),
        9,
        Math.sin(angle) * (outerRadius + 3)
      );
      support.castShadow = true;
      this.structureGroup.add(support);
    }
  }

  _buildFloor() {
    const { innerRadius } = STADIUM_CONFIG;
    
    const floorGeometry = new THREE.CircleGeometry(innerRadius - 2, 64);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.05;
    floor.receiveShadow = true;
    this.structureGroup.add(floor);
    
    const courtGeometry = new THREE.RingGeometry(innerRadius - 5, innerRadius - 2, 64);
    const courtMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.8
    });
    const court = new THREE.Mesh(courtGeometry, courtMaterial);
    court.rotation.x = -Math.PI / 2;
    court.position.y = 0.06;
    court.receiveShadow = true;
    this.structureGroup.add(court);
  }

  _buildSeats() {
    this.seats = [];
    this.seatMeshes = [];
    
    Object.keys(ZONE_CONFIGS).forEach(zoneKey => {
      const zone = ZONE_CONFIGS[zoneKey];
      const zoneGroup = this.zoneGroups[zoneKey];
      zoneGroup.clear();
      
      const { rows, seatsPerRow, startAngle, endAngle } = zone;
      const { innerRadius, seatWidth, seatDepth, rowHeight, riserHeight } = STADIUM_CONFIG;
      
      const angleRange = (endAngle - startAngle) * Math.PI / 180;
      const seatAngleStep = angleRange / seatsPerRow;
      const startRad = startAngle * Math.PI / 180;
      
      for (let row = 0; row < rows; row++) {
        const radius = innerRadius + 2 + row * (seatDepth + 0.3);
        const y = row * (rowHeight + riserHeight * 0.3);
        
        const seatsInRow = Math.floor(seatsPerRow + row * 1.5);
        const seatStep = angleRange / seatsInRow;
        
        for (let seat = 0; seat < seatsInRow; seat++) {
          const angle = startRad + seat * seatStep + seatStep / 2;
          
          const seatData = {
            id: `${zoneKey}-${row + 1}-${seat + 1}`,
            zone: zoneKey,
            row: row + 1,
            seat: seat + 1,
            position: new THREE.Vector3(
              Math.cos(angle) * radius,
              y + 0.4,
              Math.sin(angle) * radius
            ),
            angle: angle,
            radius: radius,
            available: true,
            ticketType: this._getTicketType(zoneKey, row, seatsInRow, seat),
            isAccessible: this._isAccessibleSeat(zoneKey, row, seat)
          };
          
          const seatMesh = this._createSeat(seatData, zone.color);
          zoneGroup.add(seatMesh);
          this.seats.push(seatData);
          this.seatMeshes.push(seatMesh);
        }
      }
    });
  }

  _createSeat(seatData, zoneColor) {
    const group = new THREE.Group();
    
    const baseGeometry = new THREE.BoxGeometry(0.45, 0.05, 0.4);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(zoneColor).multiplyScalar(0.7),
      roughness: 0.7
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);
    
    const backGeometry = new THREE.BoxGeometry(0.45, 0.35, 0.05);
    const backMaterial = new THREE.MeshStandardMaterial({
      color: zoneColor,
      roughness: 0.6
    });
    const back = new THREE.Mesh(backGeometry, backMaterial);
    back.position.set(0, 0.175, -0.175);
    back.castShadow = true;
    group.add(back);
    
    group.position.copy(seatData.position);
    group.lookAt(new THREE.Vector3(0, seatData.position.y, 0));
    group.rotateY(Math.PI);
    
    group.userData = {
      type: 'seat',
      seatData: seatData,
      originalColor: zoneColor,
      originalBackColor: zoneColor
    };
    
    return group;
  }

  _getTicketType(zone, row, totalSeats, seat) {
    if (row < 3) return 'vip';
    if (row < 7) return 'premium';
    if (row < 12) return 'standard';
    return 'economy';
  }

  _isAccessibleSeat(zone, row, seat) {
    return row === 5 && (seat % 15 === 0 || seat % 15 === 1);
  }

  _buildStage() {
    this.stageGroup.clear();
    const config = this._getCurrentStageConfig();
    
    const stageGeometry = new THREE.BoxGeometry(
      config.stageSize.width,
      config.stageSize.height,
      config.stageSize.depth
    );
    const stageMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      roughness: 0.5,
      metalness: 0.3,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.3
    });
    const stage = new THREE.Mesh(stageGeometry, stageMaterial);
    stage.position.set(config.stagePosition.x, config.stageSize.height / 2, config.stagePosition.z);
    stage.castShadow = true;
    stage.receiveShadow = true;
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
    const speakerMaterial = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.8
    });
    
    [-1, 1].forEach(side => {
      const speaker = new THREE.Mesh(speakerGeometry, speakerMaterial);
      speaker.position.set(
        config.stagePosition.x + side * (config.stageSize.width / 2 + 2),
        3,
        config.stagePosition.z - 2
      );
      speaker.castShadow = true;
      this.stageGroup.add(speaker);
      
      const lightGeometry = new THREE.SphereGeometry(0.3, 16, 16);
      const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
      const light = new THREE.Mesh(lightGeometry, lightMaterial);
      light.position.set(
        config.stagePosition.x + side * (config.stageSize.width / 2),
        8,
        config.stagePosition.z
      );
      this.stageGroup.add(light);
      
      const spotLight = new THREE.SpotLight(0xffcc66, 0.8, 30, Math.PI / 6, 0.5);
      spotLight.position.copy(light.position);
      spotLight.target.position.set(0, 1, config.stagePosition.z + 5);
      this.stageGroup.add(spotLight);
      this.stageGroup.add(spotLight.target);
    });
    
    const trussGeometry = new THREE.CylinderGeometry(0.1, 0.1, config.stageSize.width + 10, 8);
    const trussMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.8,
      roughness: 0.3
    });
    const truss = new THREE.Mesh(trussGeometry, trussMaterial);
    truss.rotation.z = Math.PI / 2;
    truss.position.set(config.stagePosition.x, 8, config.stagePosition.z - 3);
    this.stageGroup.add(truss);
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
    
    const hoopGeometry = new THREE.TorusGeometry(0.45, 0.03, 8, 16);
    const hoopMaterial = new THREE.MeshStandardMaterial({ color: 0xff6600 });
    [-1, 1].forEach(side => {
      const hoop = new THREE.Mesh(hoopGeometry, hoopMaterial);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.set(
        config.stagePosition.x + side * (config.stageSize.width / 2 - 1.5),
        config.stageSize.height + 3.05,
        config.stagePosition.z
      );
      this.stageGroup.add(hoop);
      
      const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 4, 8);
      const pole = new THREE.Mesh(poleGeometry, new THREE.MeshStandardMaterial({ color: 0x9ca3af }));
      pole.position.set(
        config.stagePosition.x + side * (config.stageSize.width / 2 - 1.5),
        config.stageSize.height + 1.5,
        config.stagePosition.z
      );
      this.stageGroup.add(pole);
    });
  }

  _buildFamilyStage(config) {
    const balloonColors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181];
    for (let i = 0; i < 15; i++) {
      const balloonGeometry = new THREE.SphereGeometry(0.5 + Math.random() * 0.3, 16, 16);
      const balloonMaterial = new THREE.MeshStandardMaterial({
        color: balloonColors[i % balloonColors.length],
        roughness: 0.3,
        metalness: 0.1
      });
      const balloon = new THREE.Mesh(balloonGeometry, balloonMaterial);
      balloon.position.set(
        config.stagePosition.x + (Math.random() - 0.5) * config.stageSize.width * 0.8,
        config.stageSize.height + 2 + Math.random() * 3,
        config.stagePosition.z + (Math.random() - 0.5) * config.stageSize.depth * 0.5
      );
      balloon.userData.floatOffset = Math.random() * Math.PI * 2;
      balloon.userData.floatSpeed = 0.5 + Math.random() * 0.5;
      balloon.userData.baseY = balloon.position.y;
      this.stageGroup.add(balloon);
    }
  }

  _getCurrentStageConfig() {
    return SCENE_CONFIGS[this.currentSceneType];
  }

  setSceneType(sceneType) {
    this.currentSceneType = sceneType;
    this._buildStage();
    this._updateAvailableSeats();
  }

  _updateAvailableSeats() {
    const config = SCENE_CONFIGS[this.currentSceneType];
    
    this.seats.forEach(seat => {
      seat.available = config.availableZones.includes(seat.zone);
      const mesh = this.seatMeshes.find(m => m.userData.seatData.id === seat.id);
      if (mesh) {
        mesh.visible = seat.available;
        if (!seat.available) {
          mesh.traverse(child => {
            if (child.isMesh) {
              child.material = child.material.clone();
              child.material.color.setHex(0x475569);
              child.material.opacity = 0.3;
              child.material.transparent = true;
            }
          });
        }
      }
    });
  }

  setZoneVisible(zone, visible) {
    if (this.zoneGroups[zone]) {
      this.zoneGroups[zone].visible = visible;
    }
  }

  setLabelsVisible(visible) {
    this.showLabels = visible;
    this.seatLabelsGroup.visible = visible;
  }

  getSeatCount() {
    return this.seats.filter(s => s.available).length;
  }

  getTotalSeatCount() {
    return this.seats.length;
  }

  getAccessibleSeatCount() {
    return this.seats.filter(s => s.isAccessible && s.available).length;
  }

  animate(deltaTime) {
    this.stageGroup.children.forEach(child => {
      if (child.userData && child.userData.floatOffset !== undefined) {
        child.position.y = child.userData.baseY + 
          Math.sin(Date.now() * 0.001 * child.userData.floatSpeed + child.userData.floatOffset) * 0.3;
      }
    });
  }
}
