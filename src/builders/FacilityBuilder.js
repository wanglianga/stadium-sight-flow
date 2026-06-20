import * as THREE from 'three';
import { createTextSprite } from '../utils/three-utils.js';
import { STADIUM_CONFIG } from '../config/scenes.js';

export class FacilityBuilder {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.facilityGroup = new THREE.Group();
    
    this.entriesGroup = new THREE.Group();
    this.securityGroup = new THREE.Group();
    this.channelsGroup = new THREE.Group();
    this.accessibleGroup = new THREE.Group();
    this.vendorsGroup = new THREE.Group();
    this.restroomsGroup = new THREE.Group();
    this.exitsGroup = new THREE.Group();
    this.labelsGroup = new THREE.Group();
    
    this.entries = [];
    this.securityGates = [];
    this.vendors = [];
    this.restrooms = [];
    this.exits = [];
    this.accessibleAreas = [];
    
    this._initGroups();
  }

  _initGroups() {
    this.facilityGroup.add(this.entriesGroup);
    this.facilityGroup.add(this.securityGroup);
    this.facilityGroup.add(this.channelsGroup);
    this.facilityGroup.add(this.accessibleGroup);
    this.facilityGroup.add(this.vendorsGroup);
    this.facilityGroup.add(this.restroomsGroup);
    this.facilityGroup.add(this.exitsGroup);
    this.facilityGroup.add(this.labelsGroup);
    
    this.sceneManager.add(this.facilityGroup);
  }

  build() {
    this._buildEntries();
    this._buildSecurityGates();
    this._buildChannels();
    this._buildAccessibleAreas();
    this._buildVendors();
    this._buildRestrooms();
    this._buildExits();
    return this.facilityGroup;
  }

  _buildEntries() {
    const { outerRadius } = STADIUM_CONFIG;
    const entryPositions = [
      { angle: 0, name: '北门', direction: 'north' },
      { angle: Math.PI / 2, name: '东门', direction: 'east' },
      { angle: Math.PI, name: '南门', direction: 'south' },
      { angle: -Math.PI / 2, name: '西门', direction: 'west' }
    ];
    
    entryPositions.forEach((entry, index) => {
      const group = new THREE.Group();
      
      const frameGeometry = new THREE.BoxGeometry(8, 6, 2);
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        roughness: 0.5,
        metalness: 0.3,
        emissive: 0x1e40af,
        emissiveIntensity: 0.2
      });
      const frame = new THREE.Mesh(frameGeometry, frameMaterial);
      frame.position.y = 3;
      frame.castShadow = true;
      group.add(frame);
      
      const openingGeometry = new THREE.BoxGeometry(6, 4.5, 0.5);
      const openingMaterial = new THREE.MeshStandardMaterial({
        color: 0x0a0e1a,
        transparent: true,
        opacity: 0.8
      });
      const opening = new THREE.Mesh(openingGeometry, openingMaterial);
      opening.position.y = 2.5;
      opening.position.z = 0.8;
      group.add(opening);
      
      const signGeometry = new THREE.BoxGeometry(5, 1.2, 0.2);
      const signMaterial = new THREE.MeshStandardMaterial({
        color: 0x1e3a5f,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.5
      });
      const sign = new THREE.Mesh(signGeometry, signMaterial);
      sign.position.y = 5.5;
      sign.position.z = 1.1;
      group.add(sign);
      
      const label = createTextSprite(entry.name, {
        fontSize: 20,
        color: '#ffffff',
        bgColor: 'rgba(59, 130, 246, 0.9)'
      });
      label.position.y = 5.5;
      label.position.z = 2;
      label.scale.set(2, 0.8, 1);
      this.labelsGroup.add(label);
      
      const x = Math.cos(entry.angle) * (outerRadius + 2);
      const z = Math.sin(entry.angle) * (outerRadius + 2);
      group.position.set(x, 0, z);
      group.lookAt(0, 0, 0);
      
      this.entriesGroup.add(group);
      this.entries.push({
        id: `entry-${index}`,
        name: entry.name,
        direction: entry.direction,
        position: new THREE.Vector3(x, 0, z),
        angle: entry.angle
      });
      
      label.position.set(x, 6, z);
    });
  }

  _buildSecurityGates() {
    const { outerRadius } = STADIUM_CONFIG;
    const gatePositions = [
      { angle: -0.3, count: 2 },
      { angle: 0.3, count: 2 },
      { angle: Math.PI / 2 - 0.3, count: 2 },
      { angle: Math.PI / 2 + 0.3, count: 2 },
      { angle: Math.PI - 0.3, count: 2 },
      { angle: Math.PI + 0.3, count: 2 },
      { angle: -Math.PI / 2 - 0.3, count: 2 },
      { angle: -Math.PI / 2 + 0.3, count: 2 }
    ];
    
    let gateIndex = 0;
    gatePositions.forEach(pos => {
      for (let i = 0; i < pos.count; i++) {
        const offset = (i - (pos.count - 1) / 2) * 1.5;
        const group = new THREE.Group();
        
        const gateGeometry = new THREE.BoxGeometry(0.8, 2.2, 0.3);
        const gateMaterial = new THREE.MeshStandardMaterial({
          color: 0x22c55e,
          emissive: 0x166534,
          emissiveIntensity: 0.3,
          metalness: 0.5,
          roughness: 0.4
        });
        
        const leftGate = new THREE.Mesh(gateGeometry, gateMaterial);
        leftGate.position.x = -0.5;
        leftGate.position.y = 1.1;
        leftGate.castShadow = true;
        group.add(leftGate);
        
        const rightGate = new THREE.Mesh(gateGeometry, gateMaterial.clone());
        rightGate.position.x = 0.5;
        rightGate.position.y = 1.1;
        rightGate.castShadow = true;
        group.add(rightGate);
        
        const topGeometry = new THREE.BoxGeometry(2, 0.2, 0.4);
        const topMaterial = new THREE.MeshStandardMaterial({
          color: 0x15803d,
          metalness: 0.6,
          roughness: 0.3
        });
        const top = new THREE.Mesh(topGeometry, topMaterial);
        top.position.y = 2.4;
        group.add(top);
        
        const lightGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const lightMaterial = new THREE.MeshBasicMaterial({ color: 0x22c55e });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.set(0, 2.3, 0.3);
        group.add(light);
        
        const baseAngle = pos.angle + offset * 0.02;
        const radius = outerRadius - 5;
        const x = Math.cos(baseAngle) * radius;
        const z = Math.sin(baseAngle) * radius;
        
        group.position.set(x, 0, z);
        group.lookAt(0, 0, 0);
        
        this.securityGroup.add(group);
        this.securityGates.push({
          id: `security-${gateIndex}`,
          position: new THREE.Vector3(x, 0, z),
          angle: baseAngle
        });
        gateIndex++;
      }
    });
  }

  _buildChannels() {
    const { innerRadius, outerRadius } = STADIUM_CONFIG;
    
    const channelMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9
    });
    
    const walkwayMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.8
    });
    
    const concourseGeometry = new THREE.RingGeometry(innerRadius - 3, innerRadius - 0.5, 64);
    const concourse = new THREE.Mesh(concourseGeometry, walkwayMaterial);
    concourse.rotation.x = -Math.PI / 2;
    concourse.position.y = 0.1;
    concourse.receiveShadow = true;
    this.channelsGroup.add(concourse);
    
    const upperConcourse = new THREE.Mesh(
      new THREE.RingGeometry(innerRadius + 8, innerRadius + 10, 64),
      walkwayMaterial
    );
    upperConcourse.rotation.x = -Math.PI / 2;
    upperConcourse.position.y = 5;
    this.channelsGroup.add(upperConcourse);
    
    const stairAngles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4];
    stairAngles.forEach(angle => {
      const stairGroup = new THREE.Group();
      
      const steps = 15;
      for (let i = 0; i < steps; i++) {
        const stepHeight = 0.3;
        const stepDepth = 0.6;
        const stepWidth = 3;
        
        const stepGeometry = new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth);
        const step = new THREE.Mesh(stepGeometry, channelMaterial);
        
        const radius = innerRadius - 1 + i * stepDepth;
        step.position.set(
          Math.cos(angle) * radius,
          i * stepHeight + stepHeight / 2,
          Math.sin(angle) * radius
        );
        step.lookAt(new THREE.Vector3(Math.cos(angle) * (radius + 1), step.position.y, Math.sin(angle) * (radius + 1)));
        step.castShadow = true;
        step.receiveShadow = true;
        stairGroup.add(step);
      }
      
      this.channelsGroup.add(stairGroup);
    });
  }

  _buildAccessibleAreas() {
    const { innerRadius } = STADIUM_CONFIG;
    const accessiblePositions = [
      { angle: 0, side: 'left' },
      { angle: 0, side: 'right' },
      { angle: Math.PI, side: 'left' },
      { angle: Math.PI, side: 'right' }
    ];
    
    accessiblePositions.forEach((pos, index) => {
      const group = new THREE.Group();
      
      const platformGeometry = new THREE.BoxGeometry(4, 0.3, 5);
      const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        roughness: 0.7,
        emissive: 0x6b21a8,
        emissiveIntensity: 0.2
      });
      const platform = new THREE.Mesh(platformGeometry, platformMaterial);
      platform.position.y = 0.15;
      platform.receiveShadow = true;
      group.add(platform);
      
      const wheelchairGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
      const wheelchairMaterial = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xb45309,
        emissiveIntensity: 0.3
      });
      
      for (let i = 0; i < 3; i++) {
        const wc = new THREE.Mesh(wheelchairGeometry, wheelchairMaterial);
        wc.position.set((i - 1) * 1.2, 0.35, 0);
        group.add(wc);
      }
      
      const signGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
      const signMaterial = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x166534,
        emissiveIntensity: 0.5
      });
      const sign = new THREE.Mesh(signGeometry, signMaterial);
      sign.rotation.x = Math.PI / 2;
      sign.position.set(0, 1.5, 2);
      group.add(sign);
      
      const sideOffset = pos.side === 'left' ? -6 : 6;
      const radius = innerRadius + 2;
      const baseX = Math.cos(pos.angle) * radius;
      const baseZ = Math.sin(pos.angle) * radius;
      
      group.position.set(baseX + sideOffset * Math.sin(pos.angle), 0, baseZ - sideOffset * Math.sin(pos.angle));
      group.lookAt(0, 0, 0);
      
      this.accessibleGroup.add(group);
      this.accessibleAreas.push({
        id: `accessible-${index}`,
        position: group.position.clone(),
        capacity: 6
      });
    });
  }

  _buildVendors() {
    const { outerRadius } = STADIUM_CONFIG;
    const vendorPositions = [
      { angle: Math.PI / 4, name: '售卖点A' },
      { angle: 3 * Math.PI / 4, name: '售卖点B' },
      { angle: 5 * Math.PI / 4, name: '售卖点C' },
      { angle: 7 * Math.PI / 4, name: '售卖点D' }
    ];
    
    vendorPositions.forEach((vendor, index) => {
      const group = new THREE.Group();
      
      const stallGeometry = new THREE.BoxGeometry(4, 2.5, 3);
      const stallMaterial = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        roughness: 0.6,
        metalness: 0.2,
        emissive: 0xc2410c,
        emissiveIntensity: 0.2
      });
      const stall = new THREE.Mesh(stallGeometry, stallMaterial);
      stall.position.y = 1.25;
      stall.castShadow = true;
      stall.receiveShadow = true;
      group.add(stall);
      
      const counterGeometry = new THREE.BoxGeometry(3.5, 1, 0.3);
      const counterMaterial = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        roughness: 0.5
      });
      const counter = new THREE.Mesh(counterGeometry, counterMaterial);
      counter.position.set(0, 0.5, 1.5);
      group.add(counter);
      
      const roofGeometry = new THREE.BoxGeometry(5, 0.2, 4);
      const roofMaterial = new THREE.MeshStandardMaterial({
        color: 0xea580c,
        roughness: 0.5
      });
      const roof = new THREE.Mesh(roofGeometry, roofMaterial);
      roof.position.y = 2.8;
      group.add(roof);
      
      const label = createTextSprite(vendor.name, {
        fontSize: 14,
        color: '#ffffff',
        bgColor: 'rgba(249, 115, 22, 0.9)'
      });
      label.position.y = 3.5;
      label.scale.set(1.5, 0.6, 1);
      this.labelsGroup.add(label);
      
      const radius = outerRadius - 10;
      const x = Math.cos(vendor.angle) * radius;
      const z = Math.sin(vendor.angle) * radius;
      
      group.position.set(x, 0, z);
      group.lookAt(0, 0, 0);
      
      this.vendorsGroup.add(group);
      this.vendors.push({
        id: `vendor-${index}`,
        name: vendor.name,
        position: new THREE.Vector3(x, 0, z)
      });
      
      label.position.set(x, 4, z);
    });
  }

  _buildRestrooms() {
    const { outerRadius } = STADIUM_CONFIG;
    const restroomPositions = [
      { angle: Math.PI / 6, gender: 'male' },
      { angle: Math.PI / 3, gender: 'female' },
      { angle: 5 * Math.PI / 6, gender: 'male' },
      { angle: 2 * Math.PI / 3, gender: 'female' },
      { angle: 7 * Math.PI / 6, gender: 'male' },
      { angle: 4 * Math.PI / 3, gender: 'female' },
      { angle: 11 * Math.PI / 6, gender: 'male' },
      { angle: 5 * Math.PI / 3, gender: 'female' }
    ];
    
    restroomPositions.forEach((rr, index) => {
      const group = new THREE.Group();
      
      const buildingGeometry = new THREE.BoxGeometry(5, 3, 4);
      const buildingMaterial = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        roughness: 0.6,
        metalness: 0.2
      });
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      building.position.y = 1.5;
      building.castShadow = true;
      group.add(building);
      
      const signColor = rr.gender === 'male' ? 0x3b82f6 : 0xec4899;
      const signGeometry = new THREE.BoxGeometry(2, 1, 0.2);
      const signMaterial = new THREE.MeshStandardMaterial({
        color: signColor,
        emissive: signColor,
        emissiveIntensity: 0.3
      });
      const sign = new THREE.Mesh(signGeometry, signMaterial);
      sign.position.set(0, 2.5, 2.1);
      group.add(sign);
      
      const label = createTextSprite(rr.gender === 'male' ? '男卫' : '女卫', {
        fontSize: 14,
        color: '#ffffff',
        bgColor: rr.gender === 'male' ? 'rgba(59, 130, 246, 0.9)' : 'rgba(236, 72, 153, 0.9)'
      });
      label.position.y = 4;
      label.scale.set(1.2, 0.5, 1);
      this.labelsGroup.add(label);
      
      const radius = outerRadius - 12;
      const x = Math.cos(rr.angle) * radius;
      const z = Math.sin(rr.angle) * radius;
      
      group.position.set(x, 0, z);
      group.lookAt(0, 0, 0);
      
      this.restroomsGroup.add(group);
      this.restrooms.push({
        id: `restroom-${index}`,
        gender: rr.gender,
        position: new THREE.Vector3(x, 0, z)
      });
      
      label.position.set(x, 4.5, z);
    });
  }

  _buildExits() {
    const { outerRadius } = STADIUM_CONFIG;
    const exitPositions = [
      { angle: -0.2, name: '疏散出口1' },
      { angle: 0.2, name: '疏散出口2' },
      { angle: Math.PI / 2 - 0.2, name: '疏散出口3' },
      { angle: Math.PI / 2 + 0.2, name: '疏散出口4' },
      { angle: Math.PI - 0.2, name: '疏散出口5' },
      { angle: Math.PI + 0.2, name: '疏散出口6' },
      { angle: -Math.PI / 2 - 0.2, name: '疏散出口7' },
      { angle: -Math.PI / 2 + 0.2, name: '疏散出口8' }
    ];
    
    exitPositions.forEach((exit, index) => {
      const group = new THREE.Group();
      
      const doorGeometry = new THREE.BoxGeometry(2.5, 3, 0.5);
      const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.3,
        roughness: 0.7
      });
      const door = new THREE.Mesh(doorGeometry, doorMaterial);
      door.position.y = 1.5;
      door.castShadow = true;
      group.add(door);
      
      const signGeometry = new THREE.BoxGeometry(2, 0.8, 0.2);
      const signMaterial = new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x166534,
        emissiveIntensity: 0.5
      });
      const sign = new THREE.Mesh(signGeometry, signMaterial);
      sign.position.y = 3.8;
      sign.position.z = 0.4;
      group.add(sign);
      
      const label = createTextSprite('安全出口', {
        fontSize: 14,
        color: '#ffffff',
        bgColor: 'rgba(34, 197, 94, 0.9)'
      });
      label.position.y = 4.5;
      label.scale.set(1.2, 0.5, 1);
      this.labelsGroup.add(label);
      
      const radius = outerRadius - 2;
      const x = Math.cos(exit.angle) * radius;
      const z = Math.sin(exit.angle) * radius;
      
      group.position.set(x, 0, z);
      group.lookAt(0, 0, 0);
      
      this.exitsGroup.add(group);
      this.exits.push({
        id: `exit-${index}`,
        name: exit.name,
        position: new THREE.Vector3(x, 0, z)
      });
      
      label.position.set(x, 5, z);
    });
  }

  setLayerVisible(layer, visible) {
    const layerMap = {
      entries: this.entriesGroup,
      security: this.securityGroup,
      channels: this.channelsGroup,
      accessible: this.accessibleGroup,
      vendors: this.vendorsGroup,
      restrooms: this.restroomsGroup,
      exits: this.exitsGroup,
      labels: this.labelsGroup
    };
    
    if (layerMap[layer]) {
      layerMap[layer].visible = visible;
    }
  }

  getSecurityGateCount() {
    return this.securityGates.length;
  }
}
