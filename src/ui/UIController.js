import { SCENE_CONFIGS } from '../config/scenes.js';

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
      heatmap: false,
      entries: true,
      security: true,
      channels: true,
      accessible: true,
      vendors: true,
      restrooms: true,
      exits: true,
      'flow-paths': false
    };
    
    this._initEventListeners();
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
      'layer-heatmap': 'heatmap',
      'layer-entries': 'entries',
      'layer-security': 'security',
      'layer-channels': 'channels',
      'layer-accessible': 'accessible',
      'layer-vendors': 'vendors',
      'layer-restrooms': 'restrooms',
      'layer-exits': 'exits',
      'layer-flow-paths': 'flow-paths'
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

  setScene(scene) {
    this.currentScene = scene;
    
    document.querySelectorAll('.scene-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.scene === scene);
    });
    
    this.app.setSceneType(scene);
    this._updateStats();
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
      
      sightAnalysisEl.innerHTML = `
        <div style="margin-bottom: 8px;">
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
          <span class="info-value" style="color: ${analysis.obstruction ? '#ef4444' : '#22c55e'}">${analysis.obstruction ? '有遮挡' : '无遮挡'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">角度系数</span>
          <span class="info-value">${(analysis.angle * 100).toFixed(0)}%</span>
        </div>
      `;
      
      const previewEl = document.getElementById('view-preview');
      previewEl.classList.remove('hidden');
      
      document.getElementById('preview-title').textContent = `${seatData.id} 视角`;
      document.getElementById('preview-detail').textContent = `${this._getZoneName(seatData.zone)} · 第${seatData.row}排${seatData.seat}号`;
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
}
