import * as THREE from 'three';
import { EVACUATION_CONFIG, STADIUM_CONFIG } from '../config/scenes.js';

export class EvacuationSimulation {
  constructor(sceneManager, stadiumBuilder, facilityBuilder) {
    this.sceneManager = sceneManager;
    this.stadiumBuilder = stadiumBuilder;
    this.facilityBuilder = facilityBuilder;

    this.evacGroup = new THREE.Group();
    this.arrowGroup = new THREE.Group();
    this.agentGroup = new THREE.Group();
    this.bottleneckGroup = new THREE.Group();
    this.labelGroup = new THREE.Group();
    this.curveGroup = new THREE.Group();

    this.sceneManager.add(this.evacGroup);
    this.evacGroup.add(this.arrowGroup);
    this.evacGroup.add(this.agentGroup);
    this.evacGroup.add(this.bottleneckGroup);
    this.evacGroup.add(this.labelGroup);
    this.evacGroup.add(this.curveGroup);

    this.active = false;
    this.eventType = null;
    this.agents = [];
    this.channels = [];
    this.exitData = {};
    this.bottlenecks = [];
    this.simulationTime = 0;
    this.totalPeople = 0;
    this.evacuatedPeople = 0;
    this.history = [];
    this.baselineHistory = [];
    this.adjustedHistory = [];
    this.strategySnapshots = [];
    this.currentStrategy = null;
    this.completed = false;
    this.report = null;
    this.bypassExits = [];

    this.evacGroup.visible = false;
  }

  triggerEvacuation(eventType) {
    this.eventType = eventType;
    this.active = true;
    this.completed = false;
    this.report = null;
    this.simulationTime = 0;
    this.evacuatedPeople = 0;
    this.history = [];
    this.baselineHistory = [];
    this.adjustedHistory = [];
    this.bottlenecks = [];
    this.bypassExits = [];
    this.currentStrategy = null;

    this._initChannels();
    this._initExitData();
    this._spawnAgents();
    this._buildEvacPaths();
    this._renderArrows();
    this._renderAgents();

    this.totalPeople = this.agents.length;
    this.evacGroup.visible = true;

    this._recordBaselineSnapshot();
  }

  stopEvacuation() {
    this.active = false;
  }

  resetEvacuation() {
    this.active = false;
    this.completed = false;
    this.eventType = null;
    this.simulationTime = 0;
    this.evacuatedPeople = 0;
    this.totalPeople = 0;
    this.agents = [];
    this.channels = [];
    this.exitData = {};
    this.bottlenecks = [];
    this.history = [];
    this.baselineHistory = [];
    this.adjustedHistory = [];
    this.strategySnapshots = [];
    this.currentStrategy = null;
    this.report = null;
    this.bypassExits = [];

    this._clearGroup(this.arrowGroup);
    this._clearGroup(this.agentGroup);
    this._clearGroup(this.bottleneckGroup);
    this._clearGroup(this.labelGroup);
    this._clearGroup(this.curveGroup);
    this.evacGroup.visible = false;
  }

  _initChannels() {
    this.channels = [];
    const exits = this.facilityBuilder.exits;
    const { innerRadius, outerRadius } = STADIUM_CONFIG;

    exits.forEach((exit, idx) => {
      const exitPos = exit.position.clone();
      const toCenter = new THREE.Vector3(-exitPos.x, 0, -exitPos.z).normalize();
      const midPoint = exitPos.clone().add(toCenter.clone().multiplyScalar(15));
      const innerPoint = exitPos.clone().add(toCenter.clone().multiplyScalar(30));

      const perp = new THREE.Vector3(-toCenter.z, 0, toCenter.x);
      const segments = [];
      for (let s = -1; s <= 1; s += 2) {
        const offset = perp.clone().multiplyScalar(s * 5);
        const start = innerPoint.clone().add(offset);
        const mid = midPoint.clone().add(offset.multiplyScalar(0.5));
        const end = exitPos.clone();
        segments.push({
          id: `${exit.id}-seg-${s > 0 ? 'R' : 'L'}`,
          exitId: exit.id,
          points: [start, mid, end],
          density: 0,
          flowRate: 0,
          length: start.distanceTo(end),
          width: 3,
          maxCapacity: 60,
          isBottleneck: false,
          suggestedAlternate: null
        });
      }

      const mainSeg = {
        id: `${exit.id}-seg-main`,
        exitId: exit.id,
        points: [innerPoint, midPoint, exitPos],
        density: 0,
        flowRate: 0,
        length: innerPoint.distanceTo(exitPos),
        width: 4,
        maxCapacity: 80,
        isBottleneck: false,
        suggestedAlternate: null
      };

      this.channels.push(mainSeg, ...segments);
    });

    const stairAngles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4];
    stairAngles.forEach((angle, i) => {
      const outerPos = new THREE.Vector3(
        Math.cos(angle) * (outerRadius - 5),
        0,
        Math.sin(angle) * (outerRadius - 5)
      );
      const innerPos = new THREE.Vector3(
        Math.cos(angle) * (innerRadius - 1),
        0,
        Math.sin(angle) * (innerRadius - 1)
      );
      this.channels.push({
        id: `stair-${i}`,
        exitId: null,
        points: [innerPos, outerPos],
        density: 0,
        flowRate: 0,
        length: innerPos.distanceTo(outerPos),
        width: 3,
        maxCapacity: 40,
        isBottleneck: false,
        suggestedAlternate: null
      });
    });
  }

  _initExitData() {
    this.exitData = {};
    const exits = this.facilityBuilder.exits;
    exits.forEach(exit => {
      this.exitData[exit.id] = {
        id: exit.id,
        name: exit.name,
        position: exit.position.clone(),
        evacuated: 0,
        flowRate: 0,
        estimatedClearTime: 0,
        isOpen: true,
        isBypass: false
      };
    });
  }

  _spawnAgents() {
    this.agents = [];
    const seats = this.stadiumBuilder.seats.filter(s => s.available);
    const sampleRate = EVACUATION_CONFIG.agentSampleRate || 0.15;
    const sampled = seats.filter(() => Math.random() < sampleRate);

    sampled.forEach((seat, i) => {
      const exitTargets = this._findNearestExits(seat.position, 3);
      const primaryExit = exitTargets[0];

      const path = this._buildAgentPath(seat.position, primaryExit.position);

      this.agents.push({
        id: `agent-${i}`,
        seatId: seat.id,
        position: seat.position.clone(),
        path: path,
        pathIndex: 0,
        speed: EVACUATION_CONFIG.baseSpeed * (0.8 + Math.random() * 0.4),
        exitId: primaryExit.id,
        evacuated: false,
        stuck: false,
        zone: seat.zone,
        color: new THREE.Color().lerpColors(
          new THREE.Color(0x22c55e),
          new THREE.Color(0x3b82f6),
          Math.random()
        )
      });
    });
  }

  _findNearestExits(position, count) {
    const exits = this.facilityBuilder.exits;
    const bypassExits = this._getBypassExits();
    const allExits = [...exits, ...bypassExits];

    const sorted = allExits
      .map(e => ({ ...e, dist: position.distanceTo(e.position) }))
      .sort((a, b) => a.dist - b.dist);

    return sorted.slice(0, count);
  }

  _buildAgentPath(seatPos, exitPos) {
    const points = [];
    const toExit = new THREE.Vector3().subVectors(exitPos, seatPos);
    const dist = toExit.length();
    const steps = Math.max(4, Math.floor(dist / 5));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = new THREE.Vector3().lerpVectors(seatPos, exitPos, t);
      point.y = seatPos.y * (1 - t) * 0.5;
      const jitter = (Math.random() - 0.5) * 2;
      const perp = new THREE.Vector3(-toExit.z, 0, toExit.x).normalize().multiplyScalar(jitter);
      point.add(perp);
      points.push(point);
    }

    points[0] = seatPos.clone();
    points[points.length - 1] = exitPos.clone();
    points[points.length - 1].y = 0;

    return points;
  }

  _buildEvacPaths() {
    this._clearGroup(this.arrowGroup);
    const exits = this.facilityBuilder.exits;
    const bypassExits = this._getBypassExits();
    const allExits = [...exits, ...bypassExits];

    allExits.forEach(exit => {
      const exitPos = exit.position.clone();
      exitPos.y = 0.5;
      const toCenter = new THREE.Vector3(-exitPos.x, 0, -exitPos.z).normalize();

      const pathPoints = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const pt = exitPos.clone().add(toCenter.clone().multiplyScalar(t * 35));
        pt.y = 0.5;
        pathPoints.push(pt);
      }

      const curve = new THREE.CatmullRomCurve3(pathPoints);
      const tubeGeometry = new THREE.TubeGeometry(curve, 40, 0.3, 6, false);
      const tubeMaterial = new THREE.MeshBasicMaterial({
        color: exit.isBypass ? 0xfbbf24 : 0x22c55e,
        transparent: true,
        opacity: 0.4,
        depthWrite: false
      });
      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      this.arrowGroup.add(tube);

      for (let a = 0; a < 5; a++) {
        const t = a / 5;
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const arrowGeo = new THREE.ConeGeometry(0.6, 1.5, 6);
        const arrowMat = new THREE.MeshBasicMaterial({
          color: exit.isBypass ? 0xfbbf24 : 0x22c55e,
          transparent: true,
          opacity: 0.8
        });
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.position.copy(point);
        arrow.position.y = 1;
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, tangent.normalize());
        arrow.quaternion.copy(quat);
        arrow.userData.arrowT = t;
        arrow.userData.arrowSpeed = 0.15;
        arrow.userData.curve = curve;
        arrow.userData.isBypass = exit.isBypass || false;
        this.arrowGroup.add(arrow);
      }
    });

    const zones = ['north', 'south', 'east', 'west'];
    const zoneAngles = {
      north: 0,
      south: Math.PI,
      east: Math.PI / 2,
      west: -Math.PI / 2
    };

    zones.forEach(zone => {
      const angle = zoneAngles[zone];
      const { innerRadius } = STADIUM_CONFIG;
      const startR = innerRadius + 5;

      for (let r = 0; r < 3; r++) {
        const radius = startR + r * 4;
        const cx = Math.cos(angle) * radius;
        const cz = Math.sin(angle) * radius;
        const tx = Math.cos(angle) * (radius + 5);
        const tz = Math.sin(angle) * (radius + 5);

        const arrowGeo = new THREE.ConeGeometry(0.8, 2, 6);
        const arrowMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.7
        });
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.position.set(cx, 3 + r * 2, cz);
        const dir = new THREE.Vector3(tx - cx, 0, tz - cz).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
        arrow.quaternion.copy(quat);
        arrow.userData.isStandArrow = true;
        arrow.userData.baseY = 3 + r * 2;
        this.arrowGroup.add(arrow);
      }
    });
  }

  _renderAgents() {
    this._clearGroup(this.agentGroup);
    this.agents.forEach(agent => {
      if (agent.evacuated) return;
      const geo = new THREE.SphereGeometry(0.2, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: agent.stuck ? 0xef4444 : agent.color,
        transparent: true,
        opacity: 0.9
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(agent.position);
      mesh.userData.agentId = agent.id;
      this.agentGroup.add(mesh);
    });
  }

  simulateStep(deltaTime) {
    if (!this.active || this.completed) return;

    this.simulationTime += deltaTime;
    const speedFactor = this._getEventSpeedFactor();

    this._updateChannelDensities();
    this._detectBottlenecks();

    let evacuatedThisStep = 0;

    this.agents.forEach(agent => {
      if (agent.evacuated) return;

      if (agent.pathIndex >= agent.path.length - 1) {
        agent.evacuated = true;
        agent.evacuatedTime = this.simulationTime;
        this.evacuatedPeople++;
        evacuatedThisStep++;

        if (this.exitData[agent.exitId]) {
          this.exitData[agent.exitId].evacuated++;
        }
        return;
      }

      const currentTarget = agent.path[agent.pathIndex + 1];
      const direction = new THREE.Vector3().subVectors(currentTarget, agent.position);
      const dist = direction.length();

      let speed = agent.speed * speedFactor;

      const channelDensity = this._getAgentChannelDensity(agent);
      if (channelDensity > EVACUATION_CONFIG.densityThreshold) {
        const densityFactor = 1 - (channelDensity - EVACUATION_CONFIG.densityThreshold) / EVACUATION_CONFIG.maxDensity;
        speed *= Math.max(0.1, densityFactor);
        agent.stuck = channelDensity > EVACUATION_CONFIG.criticalThreshold;
      } else {
        agent.stuck = false;
      }

      const moveDist = speed * deltaTime * 8;

      if (moveDist >= dist) {
        agent.position.copy(currentTarget);
        agent.pathIndex++;
      } else {
        direction.normalize().multiplyScalar(moveDist);
        agent.position.add(direction);
      }
    });

    Object.keys(this.exitData).forEach(exitId => {
      const exit = this.exitData[exitId];
      const remaining = this.agents.filter(a => a.exitId === exitId && !a.evacuated).length;
      exit.flowRate = evacuatedThisStep;
      const avgFlowRate = Math.max(1, exit.flowRate * 60 / deltaTime);
      exit.estimatedClearTime = avgFlowRate > 0 ? remaining / avgFlowRate : Infinity;
    });

    this.history.push({
      time: this.simulationTime,
      evacuated: this.evacuatedPeople,
      remaining: this.totalPeople - this.evacuatedPeople,
      bottlenecks: this.bottlenecks.map(b => ({
        channelId: b.channelId,
        density: b.density,
        suggestedAlternate: b.suggestedAlternate
      }))
    });

    this._updateAgentVisuals();
    this._updateBottleneckVisuals();
    this._updateExitLabels();

    if (this.evacuatedPeople >= this.totalPeople) {
      this.completed = true;
      this.active = false;
      this._generateReport();
    }
  }

  _getEventSpeedFactor() {
    const factors = {
      fire: 1.2,
      terror: 1.5,
      equipment: 0.9,
      general: 1.0
    };
    return factors[this.eventType] || 1.0;
  }

  _updateChannelDensities() {
    this.channels.forEach(channel => {
      const nearAgents = this.agents.filter(a => {
        if (a.evacuated) return false;
        return this._distToSegment(a.position, channel.points[0], channel.points[channel.points.length - 1]) < channel.width;
      });
      channel.density = nearAgents.length / channel.maxCapacity;
      channel.flowRate = nearAgents.length > 0 ? nearAgents.length * 0.5 : 0;
    });
  }

  _distToSegment(point, segStart, segEnd) {
    const ab = new THREE.Vector3().subVectors(segEnd, segStart);
    const ap = new THREE.Vector3().subVectors(point, segStart);
    const t = Math.max(0, Math.min(1, ap.dot(ab) / Math.max(0.001, ab.dot(ab))));
    const projection = new THREE.Vector3().addVectors(segStart, ab.multiplyScalar(t));
    return point.distanceTo(projection);
  }

  _detectBottlenecks() {
    this.bottlenecks = [];
    this.channels.forEach(channel => {
      if (channel.density > EVACUATION_CONFIG.densityThreshold) {
        channel.isBottleneck = true;
        const alternate = this._findAlternateRoute(channel);
        channel.suggestedAlternate = alternate;
        this.bottlenecks.push({
          channelId: channel.id,
          exitId: channel.exitId,
          density: channel.density,
          suggestedAlternate: alternate,
          position: channel.points[Math.floor(channel.points.length / 2)].clone()
        });
      } else {
        channel.isBottleneck = false;
        channel.suggestedAlternate = null;
      }
    });
  }

  _findAlternateRoute(congestedChannel) {
    const alternatives = [];

    if (congestedChannel.exitId) {
      const bypassExits = this._getBypassExits();
      bypassExits.forEach(bypass => {
        alternatives.push({
          type: 'bypass_exit',
          exitId: bypass.id,
          name: bypass.name || `备用出口`,
          description: `开启备用出口 ${bypass.name || bypass.id}`
        });
      });
    }

    this.channels.forEach(ch => {
      if (ch.id === congestedChannel.id) return;
      if (ch.density < EVACUATION_CONFIG.densityThreshold * 0.6) {
        alternatives.push({
          type: 'alternate_channel',
          channelId: ch.id,
          name: ch.id,
          description: `引导至通道 ${ch.id}`
        });
      }
    });

    alternatives.push({
      type: 'adjust_gate',
      description: '调整闸机方向为出馆模式'
    });

    alternatives.push({
      type: 'accessible_route',
      description: '引导至无障碍通道'
    });

    return alternatives.slice(0, 3);
  }

  _getAgentChannelDensity(agent) {
    let maxDensity = 0;
    this.channels.forEach(channel => {
      const dist = this._distToSegment(agent.position, channel.points[0], channel.points[channel.points.length - 1]);
      if (dist < channel.width) {
        maxDensity = Math.max(maxDensity, channel.density);
      }
    });
    return maxDensity;
  }

  _updateAgentVisuals() {
    const agentMap = {};
    this.agentGroup.children.forEach(mesh => {
      agentMap[mesh.userData.agentId] = mesh;
    });

    this.agents.forEach(agent => {
      if (agent.evacuated) {
        const mesh = agentMap[agent.id];
        if (mesh) {
          this.agentGroup.remove(mesh);
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) mesh.material.dispose();
        }
        return;
      }
      const mesh = agentMap[agent.id];
      if (mesh) {
        mesh.position.copy(agent.position);
        mesh.material.color.setHex(agent.stuck ? 0xef4444 : agent.color.getHex());
      }
    });
  }

  _updateBottleneckVisuals() {
    this._clearGroup(this.bottleneckGroup);

    this.bottlenecks.forEach(bn => {
      const channel = this.channels.find(c => c.id === bn.channelId);
      if (!channel) return;

      const startPt = channel.points[0];
      const endPt = channel.points[channel.points.length - 1];

      const highlightGeo = new THREE.TubeGeometry(
        new THREE.LineCurve3(startPt, endPt),
        1,
        channel.width * 0.5,
        8,
        false
      );
      const opacity = Math.min(0.6, bn.density * 0.5);
      const highlightMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: opacity,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const highlight = new THREE.Mesh(highlightGeo, highlightMat);
      this.bottleneckGroup.add(highlight);

      const pulseGeo = new THREE.RingGeometry(channel.width * 0.3, channel.width * 0.5, 16);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const pulse = new THREE.Mesh(pulseGeo, pulseMat);
      pulse.position.copy(bn.position);
      pulse.position.y = 0.3;
      pulse.rotation.x = -Math.PI / 2;
      pulse.userData.pulseBase = 1;
      pulse.userData.pulseSpeed = 2;
      this.bottleneckGroup.add(pulse);
    });
  }

  _updateExitLabels() {
    this._clearGroup(this.labelGroup);

    Object.values(this.exitData).forEach(exit => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(0, 0, 256, 128);

      ctx.strokeStyle = exit.isOpen ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, 256, 128);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(exit.name, 128, 24);

      ctx.fillStyle = '#60a5fa';
      ctx.font = '14px Arial';
      ctx.fillText(`已疏散: ${exit.evacuated}人`, 128, 50);

      ctx.fillText(`速率: ${exit.flowRate.toFixed(1)}人/秒`, 128, 72);

      const clearTime = exit.estimatedClearTime === Infinity ? '∞' : `${exit.estimatedClearTime.toFixed(1)}秒`;
      ctx.fillText(`预计清场: ${clearTime}`, 128, 94);

      if (exit.isBypass) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('备用出口', 128, 118);
      }

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(exit.position);
      sprite.position.y = 7;
      sprite.scale.set(5, 2.5, 1);
      this.labelGroup.add(sprite);
    });
  }

  animate(deltaTime) {
    if (!this.evacGroup.visible) return;

    this.simulateStep(deltaTime);

    this.arrowGroup.children.forEach(child => {
      if (child.userData.arrowT !== undefined) {
        child.userData.arrowT = (child.userData.arrowT + child.userData.arrowSpeed * deltaTime) % 1;
        const curve = child.userData.curve;
        if (curve) {
          const point = curve.getPointAt(child.userData.arrowT);
          const tangent = curve.getTangentAt(child.userData.arrowT);
          child.position.copy(point);
          child.position.y = 1 + Math.sin(Date.now() * 0.003) * 0.3;
          const up = new THREE.Vector3(0, 1, 0);
          const quat = new THREE.Quaternion().setFromUnitVectors(up, tangent.normalize());
          child.quaternion.copy(quat);
        }
      }

      if (child.userData.isStandArrow) {
        child.position.y = child.userData.baseY + Math.sin(Date.now() * 0.004 + child.position.x) * 0.3;
      }
    });

    this.bottleneckGroup.children.forEach(child => {
      if (child.userData.pulseBase !== undefined) {
        const scale = 1 + Math.sin(Date.now() * 0.003 * child.userData.pulseSpeed) * 0.2;
        child.scale.set(scale, scale, 1);
      }
    });
  }

  _recordBaselineSnapshot() {
    this.baselineHistory = [];
    const snap = {
      time: 0,
      evacuated: 0,
      remaining: this.totalPeople
    };
    this.baselineHistory.push(snap);
    this.strategySnapshots.push({
      label: '基准策略',
      history: this.baselineHistory,
      color: '#3b82f6'
    });
  }

  recordStrategySnapshot(label) {
    const snapshot = {
      time: this.simulationTime,
      evacuated: this.evacuatedPeople,
      remaining: this.totalPeople - this.evacuatedPeople
    };

    const historyCopy = this.history.map(h => ({ ...h }));
    this.strategySnapshots.push({
      label: label || `策略${this.strategySnapshots.length}`,
      history: historyCopy,
      color: this.strategySnapshots.length === 1 ? '#3b82f6' : '#f97316'
    });
  }

  compareStrategies() {
    return this.strategySnapshots.map(snap => ({
      label: snap.label,
      color: snap.color,
      totalEvacuated: snap.history.length > 0 ? snap.history[snap.history.length - 1].evacuated : 0,
      totalTime: snap.history.length > 0 ? snap.history[snap.history.length - 1].time : 0,
      data: snap.history
    }));
  }

  openBypassExit(exitId) {
    const exits = this.facilityBuilder.exits;
    const newBypass = {
      id: exitId || `bypass-${this.bypassExits.length}`,
      name: `备用出口${this.bypassExits.length + 1}`,
      position: this._generateBypassPosition(),
      isBypass: true
    };
    this.bypassExits.push(newBypass);

    this.exitData[newBypass.id] = {
      id: newBypass.id,
      name: newBypass.name,
      position: newBypass.position.clone(),
      evacuated: 0,
      flowRate: 0,
      estimatedClearTime: 0,
      isOpen: true,
      isBypass: true
    };

    const nearbyChannels = this.channels.filter(ch =>
      ch.points[0].distanceTo(newBypass.position) < 50 ||
      ch.points[ch.points.length - 1].distanceTo(newBypass.position) < 50
    );

    nearbyChannels.forEach(ch => {
      ch.maxCapacity += 20;
    });

    this._redistributeAgents(newBypass);
    this._buildEvacPaths();

    return newBypass;
  }

  _generateBypassPosition() {
    const { outerRadius } = STADIUM_CONFIG;
    const angle = Math.random() * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) * (outerRadius + 5),
      0,
      Math.sin(angle) * (outerRadius + 5)
    );
  }

  _redistributeAgents(newExit) {
    const activeAgents = this.agents.filter(a => !a.evacuated);
    const redistributeCount = Math.floor(activeAgents.length * 0.15);

    const sorted = activeAgents
      .map(a => ({ agent: a, dist: a.position.distanceTo(newExit.position) }))
      .sort((a, b) => a.dist - b.dist);

    sorted.slice(0, redistributeCount).forEach(({ agent }) => {
      agent.exitId = newExit.id;
      agent.path = this._buildAgentPath(agent.position, newExit.position);
      agent.pathIndex = 0;
    });
  }

  adjustGateDirection(gateId) {
    const gates = this.facilityBuilder.securityGates;
    const gate = gates.find(g => g.id === gateId);
    if (!gate) return;

    const nearbyAgents = this.agents.filter(a =>
      !a.evacuated && a.position.distanceTo(gate.position) < 20
    );

    nearbyAgents.forEach(agent => {
      agent.speed *= 1.3;
    });
  }

  guideToAccessible(exitId) {
    const accessibleAreas = this.facilityBuilder.accessibleAreas;
    if (accessibleAreas.length === 0) return;

    const nearest = accessibleAreas.reduce((best, area) => {
      const exitPos = this.exitData[exitId]?.position;
      if (!exitPos) return best;
      const dist = area.position.distanceTo(exitPos);
      return (!best || dist < best.dist) ? { area, dist } : best;
    }, null);

    if (!nearest) return;

    const stuckAgents = this.agents.filter(a => a.stuck);
    stuckAgents.forEach(agent => {
      const accessiblePath = this._buildAgentPath(agent.position, nearest.area.position);
      const exitPath = this._buildAgentPath(nearest.area.position,
        this.facilityBuilder.exits[0]?.position || new THREE.Vector3(70, 0, 0));
      agent.path = [...accessiblePath, ...exitPath.slice(1)];
      agent.pathIndex = 0;
      agent.stuck = false;
      agent.speed *= 0.8;
    });
  }

  applySuggestion(suggestion) {
    switch (suggestion.type) {
      case 'bypass_exit':
        return this.openBypassExit(suggestion.exitId);
      case 'adjust_gate':
        const gates = this.facilityBuilder.securityGates;
        if (gates.length > 0) {
          this.adjustGateDirection(gates[0].id);
        }
        return { type: 'gate_adjusted' };
      case 'accessible_route':
        const exitIds = Object.keys(this.exitData);
        if (exitIds.length > 0) {
          this.guideToAccessible(exitIds[0]);
        }
        return { type: 'accessible_guided' };
      case 'alternate_channel':
        return { type: 'channel_redirected', channelId: suggestion.channelId };
      default:
        return null;
    }
  }

  _generateReport() {
    const duration = this.simulationTime;
    const totalEvacuated = this.evacuatedPeople;

    const exitStats = Object.values(this.exitData).map(exit => ({
      id: exit.id,
      name: exit.name,
      evacuated: exit.evacuated,
      isBypass: exit.isBypass
    }));

    const peakBottlenecks = [];
    const bottleneckMap = {};
    this.history.forEach(h => {
      h.bottlenecks.forEach(bn => {
        if (!bottleneckMap[bn.channelId]) {
          bottleneckMap[bn.channelId] = { channelId: bn.channelId, count: 0, maxDensity: 0, firstSeen: h.time, lastSeen: h.time };
        }
        bottleneckMap[bn.channelId].count++;
        bottleneckMap[bn.channelId].maxDensity = Math.max(bottleneckMap[bn.channelId].maxDensity, bn.density);
        bottleneckMap[bn.channelId].lastSeen = h.time;
      });
    });

    Object.values(bottleneckMap)
      .sort((a, b) => b.count - a.count)
      .forEach(bn => {
        peakBottlenecks.push({
          channelId: bn.channelId,
          maxDensity: bn.maxDensity,
          duration: bn.lastSeen - bn.firstSeen,
          timeRange: `${bn.firstSeen.toFixed(1)}s - ${bn.lastSeen.toFixed(1)}s`,
          occurrenceCount: bn.count
        });
      });

    const timeIntervals = [];
    const intervalSize = Math.max(1, Math.floor(duration / 10));
    for (let t = 0; t < duration; t += intervalSize) {
      const inInterval = this.history.filter(h => h.time >= t && h.time < t + intervalSize);
      if (inInterval.length > 0) {
        const avgRemaining = inInterval.reduce((s, h) => s + h.remaining, 0) / inInterval.length;
        const avgBottlenecks = inInterval.reduce((s, h) => s + h.bottlenecks.length, 0) / inInterval.length;
        timeIntervals.push({
          timeStart: t.toFixed(1),
          timeEnd: (t + intervalSize).toFixed(1),
          avgRemaining: Math.round(avgRemaining),
          avgBottleneckCount: avgBottlenecks.toFixed(1)
        });
      }
    }

    const strategyComparison = this.compareStrategies();

    this.report = {
      eventType: this.eventType,
      totalPeople: this.totalPeople,
      totalEvacuated,
      duration: duration.toFixed(1),
      exitStats,
      peakBottlenecks: peakBottlenecks.slice(0, 5),
      timeIntervals,
      strategyComparison,
      generatedAt: new Date().toISOString()
    };

    return this.report;
  }

  getReport() {
    return this.report;
  }

  getExitData() {
    return this.exitData;
  }

  getBottlenecks() {
    return this.bottlenecks;
  }

  getSimulationProgress() {
    return {
      active: this.active,
      completed: this.completed,
      eventType: this.eventType,
      simulationTime: this.simulationTime,
      totalPeople: this.totalPeople,
      evacuatedPeople: this.evacuatedPeople,
      remainingPeople: this.totalPeople - this.evacuatedPeople,
      progress: this.totalPeople > 0 ? (this.evacuatedPeople / this.totalPeople * 100) : 0,
      bottleneckCount: this.bottlenecks.length
    };
  }

  getSuggestions() {
    return this.bottlenecks.map(bn => ({
      channelId: bn.channelId,
      density: bn.density,
      suggestions: bn.suggestedAlternate || []
    }));
  }

  _clearGroup(group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
      group.remove(child);
    }
  }

  setSceneType(sceneType) {
    if (this.active) {
      this.resetEvacuation();
    }
  }

  isVisible() {
    return this.evacGroup.visible;
  }
}
