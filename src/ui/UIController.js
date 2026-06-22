import { SCENE_CONFIGS, QUEUE_SIMULATION_CONFIG } from '../config/scenes.js';
import { getObstructionGradeInfo } from '../utils/three-utils.js';

export class UIController {
  constructor(app) {
    this.app = app;
    this.currentScene = 'concert';
    this.currentMode = 'overview';
    this.zoneVisibility = {
      north: true,
      south: true,
      east: true,
      west: true
    };
    this.layerVisibility = {
      seats: true,
      'seat-labels': false,
      'sight-lines': false,
      'sight-cone': false,
      'obstruction-markers': false,
      heatmap: false,
      'obstructions': true,
      entries: true,
      security: true,
      channels: true,
      accessible: true,
      vendors: true,
      restrooms: true,
      exits: true,
      'flow-paths': false,
      'heat-zones': false
    };
    
    this._initEventListeners();
    this._initQueueControls();
  }

  _initEventListeners() {
    document.querySelectorAll('.scene-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const scene = btn.dataset.scene;
        this.setScene(scene);
      });
    });
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.setMode(mode);
      });
    });
    
    document.querySelectorAll('.zone-toggle').forEach(toggle => {
      toggle.addEventListener('change', () => {
        const zone = toggle.dataset.zone;
        this.setZoneVisible(zone, toggle.checked);
      });
    });
    
    const layerMappings = {
      'layer-seats': 'seats',
      'layer-seat-labels': 'seat-labels',
      'layer-sight-lines': 'sight-lines',
      'layer-sight-cone': 'sight-cone',
      'layer-obstruction-markers': 'obstruction-markers',
      'layer-heatmap': 'heatmap',
      'layer-obstructions': 'obstructions',
      'layer-entries': 'entries',
      'layer-security': 'security',
      'layer-channels': 'channels',
      'layer-accessible': 'accessible',
      'layer-vendors': 'vendors',
      'layer-restrooms': 'restrooms',
      'layer-exits': 'exits',
      'layer-flow-paths': 'flow-paths',
      'layer-heat-zones': 'heat-zones'
    };
    
    Object.entries(layerMappings).forEach(([id, layer]) => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          this.setLayerVisible(layer, checkbox.checked);
        });
      }
    });
    
    const previewClose = document.getElementById('preview-close');
    if (previewClose) {
      previewClose.addEventListener('click', () => {
        this.hidePreview();
      });
    }
  }

  _initQueueControls() {
    const simStart = document.getElementById('sim-start');
    const simStop = document.getElementById('sim-stop');
    const simReset = document.getElementById('sim-reset');
    
    if (simStart) {
      simStart.addEventListener('click', () => {
        this.app.flowAnalysis.startSimulation();
        this._updateSimulationStatus();
      });
    }
    
    if (simStop) {
      simStop.addEventListener('click', () => {
        this.app.flowAnalysis.stopSimulation();
        this._updateSimulationStatus();
      });
    }
    
    if (simReset) {
      simReset.addEventListener('click', () => {
        this.app.flowAnalysis.stopSimulation();
        this.app.flowAnalysis._initQueueData();
        this._updateQueueInfo();
        this._updateSimulationStatus();
      });
    }
    
    const addVolunteer = document.getElementById('add-volunteer');
    if (addVolunteer) {
      addVolunteer.addEventListener('click', () => {
        const entries = this.app.facilityBuilder.entries;
        if (entries.length > 0) {
          const entry = entries[Math.floor(Math.random() * entries.length)];
          const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            0,
            (Math.random() - 0.5) * 10
          );
          const position = entry.position.clone().add(offset);
          this.app.flowAnalysis.addVolunteer(position);
          this._updateQueueInfo();
        }
      });
    }
    
    const removeVolunteer = document.getElementById('remove-volunteer');
    if (removeVolunteer) {
      removeVolunteer.addEventListener('click', () => {
        const volunteers = this.app.flowAnalysis.volunteerPositions;
        if (volunteers.length > 0) {
          this.app.flowAnalysis.removeVolunteer(volunteers[volunteers.length - 1].id);
          this._updateQueueInfo();
        }
      });
    }
    
    this._updateGateControls();
  }

  _updateGateControls() {
    const gatesContainer = document.getElementById('gate-controls');
    if (!gatesContainer) return;
    
    gatesContainer.innerHTML = '';
    
    const gates = this.app.facilityBuilder.securityGates;
    const gateStates = this.app.flowAnalysis.getGateStates();
    
    gates.forEach((gate, index) => {
      if (index % 2 === 0 && index < gates.length - 1) {
        const pairDiv = document.createElement('div');
        pairDiv.className = 'gate-pair';
        
        [gate, gates[index + 1]].forEach(g => {
          const state = gateStates[g.id];
          const gateDiv = document.createElement('div');
          gateDiv.className = `gate-control ${state?.open ? 'gate-open' : 'gate-closed'} ${state?.accessible ? 'gate-accessible' : ''}`;
          
          gateDiv.innerHTML = `
            <div class="gate-label">${g.id}</div>
            <div class="gate-actions">
              <button class="gate-toggle-btn ${state?.open ? 'active' : ''}" data-gate="${g.id}" data-action="toggle">${state?.open ? '开放' : '关闭'}</button>
              <button class="gate-access-btn ${state?.accessible ? 'active' : ''}" data-gate="${g.id}" data-action="accessible">♿</button>
            </div>
          `;
          
          pairDiv.appendChild(gateDiv);
        });
        
        gatesContainer.appendChild(pairDiv);
      }
    });
    
    gatesContainer.querySelectorAll('.gate-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const gateId = btn.dataset.gate;
        const currentState = gateStates[gateId];
        this.app.flowAnalysis.toggleGate(gateId, !currentState.open);
        this._updateGateControls();
        this._updateQueueInfo();
      });
    });
    
    gatesContainer.querySelectorAll('.gate-access-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const gateId = btn.dataset.gate;
        const currentState = gateStates[gateId];
        if (currentState.open) {
          this.app.flowAnalysis.setGateAccessible(gateId, !currentState.accessible);
          this._updateGateControls();
          this._updateQueueInfo();
        }
      });
    });
  }

  _updateSimulationStatus() {
    const statusEl = document.getElementById('sim-status');
    if (statusEl) {
      const running = this.app.flowAnalysis.isSimulating();
      statusEl.textContent = running ? '运行中' : '已停止';
      statusEl.className = `sim-status ${running ? 'running' : 'stopped'}`;
    }
  }

  _updateQueueInfo() {
    const queueData = this.app.flowAnalysis.getQueueData();
    
    const entryInfoEl = document.getElementById('entry-queue-info');
    if (entryInfoEl && queueData.entries) {
      entryInfoEl.innerHTML = queueData.entries.map(entry => {
        const thresholds = QUEUE_SIMULATION_CONFIG.heatThresholds;
        let level = 'low';
        if (entry.queueLength >= thresholds.critical) level = 'critical';
        else if (entry.queueLength >= thresholds.high) level = 'high';
        else if (entry.queueLength >= thresholds.medium) level = 'medium';
        
        return `
          <div class="queue-entry-item">
            <span class="queue-entry-name">${entry.name}</span>
            <div class="queue-bar">
              <div class="queue-fill ${level}" style="width: ${Math.min(100, (entry.queueLength / 120) * 100)}%"></div>
            </div>
            <span class="queue-count">${entry.queueLength}人</span>
          </div>
        `;
      }).join('');
    }
    
    const volunteerInfoEl = document.getElementById('volunteer-info');
    if (volunteerInfoEl) {
      const count = this.app.flowAnalysis.volunteerPositions.length;
      volunteerInfoEl.textContent = `当前志愿者: ${count}人`;
    }
    
    const fenceInfoEl = document.getElementById('fence-info');
    if (fenceInfoEl) {
      const count = this.app.flowAnalysis.fencePositions.length;
      fenceInfoEl.textContent = `当前围栏: ${count}处`;
    }
  }

  setScene(scene) {
    this.currentScene = scene;
    
    document.querySelectorAll('.scene-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.scene === scene);
    });
    
    this.app.setSceneType(scene);
    this._updateStats();
    this._updateGateControls();
    this._updateQueueInfo();
  }

  setMode(mode) {
    this.currentMode = mode;
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    this.app.setViewMode(mode);
  }

  setZoneVisible(zone, visible) {
    this.zoneVisibility[zone] = visible;
    this.app.setZoneVisible(zone, visible);
  }

  setLayerVisible(layer, visible) {
    this.layerVisibility[layer] = visible;
    this.app.setLayerVisible(layer, visible);
  }

  updateSeatInfo(seatData, analysis) {
    const seatInfoEl = document.getElementById('seat-info');
    const sightAnalysisEl = document.getElementById('sight-analysis');
    
    if (seatData && analysis) {
      const gradeInfo = analysis.gradeInfo;
      
      seatInfoEl.innerHTML = `
        <div class="info-row">
          <span class="info-label">座席编号</span>
          <span class="info-value">${seatData.id}</span>
        </div>
        <div class="info-row">
          <span class="info-label">所在区域</span>
          <span class="info-value">${this._getZoneName(seatData.zone)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">排数</span>
          <span class="info-value">第 ${seatData.row} 排</span>
        </div>
        <div class="info-row">
          <span class="info-label">座号</span>
          <span class="info-value">第 ${seatData.seat} 号</span>
        </div>
        <div class="info-row">
          <span class="info-label">票价类型</span>
          <span class="info-value" style="color: ${this._getTicketColor(seatData.ticketType)}">${this._getTicketLabel(seatData.ticketType)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">无障碍</span>
          <span class="info-value">${seatData.isAccessible ? '是' : '否'}</span>
        </div>
      `;
      
      let obstructionHtml = '';
      if (analysis.obstruction && analysis.obstructionDetails) {
        obstructionHtml = `
          <div class="obstruction-list">
            <div class="obstruction-title">遮挡物明细</div>
            ${analysis.obstructionDetails.map(obs => {
              const severityLabel = { major: '严重', moderate: '中等', minor: '轻微' }[obs.severity] || obs.severity;
              const severityClass = `severity-${obs.severity}`;
              const typeLabel = {
                speakerTower: '音响塔',
                camera: '摄像机',
                railing: '栏杆',
                screen: '大屏'
              }[obs.type] || obs.type;
              return `
                <div class="obstruction-item ${severityClass}">
                  <span class="obs-type">${typeLabel}</span>
                  <span class="obs-label">${obs.label}</span>
                  <span class="obs-severity">${severityLabel}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
      
      sightAnalysisEl.innerHTML = `
        <div class="grade-badge" style="background: ${gradeInfo.color}">
          <span class="grade-letter">${analysis.grade}</span>
        </div>
        <div class="grade-info">
          <div class="grade-label" style="color: ${gradeInfo.color}">${gradeInfo.label}</div>
          <div class="grade-description">${gradeInfo.description}</div>
          <div class="grade-ticket">${gradeInfo.ticketNote}</div>
        </div>
        <div style="margin: 10px 0 6px;">
          <span style="color: #64748b; font-size: 12px;">视线质量</span>
          <span style="float: right; color: ${analysis.qualityColor}; font-weight: 600;">${analysis.qualityLabel}</span>
        </div>
        <div class="quality-bar">
          <div class="quality-fill ${analysis.qualityClass}" style="width: ${(analysis.quality * 100).toFixed(0)}%"></div>
        </div>
        <div class="info-row">
          <span class="info-label">观看距离</span>
          <span class="info-value">${analysis.distance} 米</span>
        </div>
        <div class="info-row">
          <span class="info-label">视线遮挡</span>
          <span class="info-value" style="color: ${analysis.obstruction ? '#ef4444' : '#22c55e'}">${analysis.obstruction ? `${analysis.obstructionCount}处遮挡` : '无遮挡'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">角度系数</span>
          <span class="info-value">${(analysis.angle * 100).toFixed(0)}%</span>
        </div>
        <div class="info-row">
          <span class="info-label">前排影响</span>
          <span class="info-value">${(analysis.frontRowFactor * 100).toFixed(0)}%</span>
        </div>
        ${obstructionHtml}
      `;
      
      const previewEl = document.getElementById('view-preview');
      previewEl.classList.remove('hidden');
      
      document.getElementById('preview-title').textContent = `${seatData.id} 视角 · ${analysis.grade}级`;
      document.getElementById('preview-detail').textContent = `${this._getZoneName(seatData.zone)} · 第${seatData.row}排${seatData.seat}号 · ${gradeInfo.label}`;
    } else {
      seatInfoEl.innerHTML = '<div class="info-empty">点击座席查看详情</div>';
      sightAnalysisEl.innerHTML = '<div class="info-empty">选择座席查看视线分析</div>';
      this.hidePreview();
    }
  }

  hidePreview() {
    const previewEl = document.getElementById('view-preview');
    previewEl.classList.add('hidden');
  }

  _updateStats() {
    const config = SCENE_CONFIGS[this.currentScene];
    
    document.getElementById('stat-total-seats').textContent = 
      this.app.stadiumBuilder.getTotalSeatCount().toLocaleString();
    document.getElementById('stat-available-seats').textContent = 
      this.app.stadiumBuilder.getSeatCount().toLocaleString();
    document.getElementById('stat-accessible-seats').textContent = 
      this.app.stadiumBuilder.getAccessibleSeatCount().toLocaleString();
    document.getElementById('stat-security').textContent = 
      this.app.facilityBuilder.getSecurityGateCount();
  }

  _getZoneName(zone) {
    const names = {
      north: '北区',
      south: '南区',
      east: '东区',
      west: '西区'
    };
    return names[zone] || zone;
  }

  _getTicketLabel(type) {
    const labels = {
      vip: 'VIP 票',
      premium: '高级票',
      standard: '标准票',
      economy: '经济票',
      family: '家庭票'
    };
    return labels[type] || type;
  }

  _getTicketColor(type) {
    const colors = {
      vip: '#fbbf24',
      premium: '#f97316',
      standard: '#3b82f6',
      economy: '#22c55e',
      family: '#a855f7'
    };
    return colors[type] || '#94a3b8';
  }

  updateStats(totalSeats, availableSeats, accessibleSeats, securityCount) {
    document.getElementById('stat-total-seats').textContent = totalSeats.toLocaleString();
    document.getElementById('stat-available-seats').textContent = availableSeats.toLocaleString();
    document.getElementById('stat-accessible-seats').textContent = accessibleSeats.toLocaleString();
    document.getElementById('stat-security').textContent = securityCount;
  }

  updateQueueDisplay() {
    this._updateQueueInfo();
  }
}
