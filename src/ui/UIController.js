import * as THREE from 'three';
import { SCENE_CONFIGS, QUEUE_SIMULATION_CONFIG, EVACUATION_CONFIG } from '../config/scenes.js';
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
    this._initEvacControls();
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
        const volunteers = this.app.flowAnalysis.getVolunteerPositions();
        if (volunteers.length > 0) {
          this.app.flowAnalysis.removeVolunteer(volunteers[volunteers.length - 1].id);
          this._updateQueueInfo();
        }
      });
    }

    const addFence = document.getElementById('add-fence');
    if (addFence) {
      addFence.addEventListener('click', () => {
        const entries = this.app.facilityBuilder.entries;
        const gates = this.app.facilityBuilder.securityGates;
        if (entries.length > 0 && gates.length > 0) {
          const entry = entries[Math.floor(Math.random() * entries.length)];
          const gate = gates[Math.floor(Math.random() * gates.length)];

          const start = entry.position.clone();
          const end = gate.position.clone();
          const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

          const dir = new THREE.Vector3().subVectors(end, start);
          const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
          const offset = 5 + Math.random() * 5;

          const fenceStart = mid.clone().add(perp.clone().multiplyScalar(offset));
          const fenceEnd = mid.clone().add(perp.clone().multiplyScalar(-offset));

          this.app.flowAnalysis.addFence(fenceStart, fenceEnd);
          this._updateQueueInfo();
        }
      });
    }

    const moveFence = document.getElementById('move-fence');
    if (moveFence) {
      moveFence.addEventListener('click', () => {
        const fences = this.app.flowAnalysis.getFencePositions();
        if (fences.length > 0) {
          const fence = fences[fences.length - 1];
          const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            0,
            (Math.random() - 0.5) * 10
          );
          const newStart = fence.start.clone().add(offset);
          const newEnd = fence.end.clone().add(offset);
          this.app.flowAnalysis.moveFence(fence.id, newStart, newEnd);
          this._updateQueueInfo();
        }
      });
    }

    const removeFence = document.getElementById('remove-fence');
    if (removeFence) {
      removeFence.addEventListener('click', () => {
        const fences = this.app.flowAnalysis.getFencePositions();
        if (fences.length > 0) {
          this.app.flowAnalysis.removeFence(fences[fences.length - 1].id);
          this._updateQueueInfo();
        }
      });
    }

    this._updateGateControls();
  }

  _initEvacControls() {
    document.querySelectorAll('.evac-trigger-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const eventType = btn.dataset.event;
        this._triggerEvacuation(eventType);
      });
    });

    const evacStop = document.getElementById('evac-stop');
    if (evacStop) {
      evacStop.addEventListener('click', () => {
        this.app.evacuation.stopEvacuation();
        this._updateEvacStatus();
      });
    }

    const evacReset = document.getElementById('evac-reset');
    if (evacReset) {
      evacReset.addEventListener('click', () => {
        this.app.evacuation.resetEvacuation();
        this._resetEvacUI();
        const panel = document.querySelector('.control-panel');
        if (panel) panel.classList.remove('evac-mode');
      });
    }

    const evacOpenBypass = document.getElementById('evac-open-bypass');
    if (evacOpenBypass) {
      evacOpenBypass.addEventListener('click', () => {
        const bypass = this.app.evacuation.openBypassExit();
        if (bypass) {
          this._updateEvacDisplay();
        }
      });
    }

    const evacAdjustGate = document.getElementById('evac-adjust-gate');
    if (evacAdjustGate) {
      evacAdjustGate.addEventListener('click', () => {
        const gates = this.app.facilityBuilder.securityGates;
        if (gates.length > 0) {
          this.app.evacuation.adjustGateDirection(gates[0].id);
          this._updateEvacDisplay();
        }
      });
    }

    const evacGuideAccessible = document.getElementById('evac-guide-accessible');
    if (evacGuideAccessible) {
      evacGuideAccessible.addEventListener('click', () => {
        const exitIds = Object.keys(this.app.evacuation.getExitData());
        if (exitIds.length > 0) {
          this.app.evacuation.guideToAccessible(exitIds[0]);
          this._updateEvacDisplay();
        }
      });
    }

    const evacSnapshot = document.getElementById('evac-snapshot');
    if (evacSnapshot) {
      evacSnapshot.addEventListener('click', () => {
        const idx = this.app.evacuation.strategySnapshots.length;
        this.app.evacuation.recordStrategySnapshot(`策略${idx}`);
        this._renderStrategyComparison();
      });
    }

    const evacShowReport = document.getElementById('evac-show-report');
    if (evacShowReport) {
      evacShowReport.addEventListener('click', () => {
        this._showEvacReport();
      });
    }

    const evacReportClose = document.getElementById('evac-report-close');
    if (evacReportClose) {
      evacReportClose.addEventListener('click', () => {
        document.getElementById('evac-report-modal').style.display = 'none';
      });
    }
  }

  _triggerEvacuation(eventType) {
    const eventConfig = EVACUATION_CONFIG.eventTypes[eventType];
    if (!eventConfig) return;

    this.app.evacuation.triggerEvacuation(eventType);

    const alertOverlay = document.getElementById('evac-alert-overlay');
    const alertIcon = document.getElementById('evac-alert-icon');
    const alertText = document.getElementById('evac-alert-text');

    if (alertOverlay && alertIcon && alertText) {
      alertIcon.textContent = eventConfig.icon;
      alertText.textContent = `${eventConfig.label} - 应急疏散已启动`;
      alertOverlay.style.display = 'block';
      alertOverlay.style.animation = 'none';
      alertOverlay.offsetHeight;
      alertOverlay.style.animation = 'evacAlertAnim 3s ease-out forwards';
      setTimeout(() => {
        alertOverlay.style.display = 'none';
      }, 3000);
    }

    const panel = document.querySelector('.control-panel');
    if (panel) panel.classList.add('evac-mode');

    document.getElementById('evac-stop').disabled = false;
    document.getElementById('evac-progress-section').style.display = 'block';
    document.getElementById('evac-exit-section').style.display = 'block';
    document.getElementById('evac-bottleneck-section').style.display = 'block';
    document.getElementById('evac-strategy-section').style.display = 'block';

    this._updateEvacStatus();
  }

  _updateEvacStatus() {
    const statusEl = document.getElementById('evac-status');
    const progress = this.app.evacuation.getSimulationProgress();
    if (!statusEl) return;

    if (progress.active) {
      statusEl.textContent = `${EVACUATION_CONFIG.eventTypes[progress.eventType]?.label || '疏散中'} - 进行中`;
      statusEl.className = 'evac-status active';
    } else if (progress.completed) {
      statusEl.textContent = '疏散完成';
      statusEl.className = 'evac-status completed';
      document.getElementById('evac-report-section').style.display = 'block';
      document.getElementById('evac-stop').disabled = true;
    } else {
      statusEl.textContent = '已停止';
      statusEl.className = 'evac-status inactive';
    }
  }

  _resetEvacUI() {
    const statusEl = document.getElementById('evac-status');
    if (statusEl) {
      statusEl.textContent = '未启动';
      statusEl.className = 'evac-status inactive';
    }

    document.getElementById('evac-stop').disabled = true;
    document.getElementById('evac-progress-section').style.display = 'none';
    document.getElementById('evac-exit-section').style.display = 'none';
    document.getElementById('evac-bottleneck-section').style.display = 'none';
    document.getElementById('evac-strategy-section').style.display = 'none';
    document.getElementById('evac-report-section').style.display = 'none';
    document.getElementById('evac-strategy-comparison').style.display = 'none';

    const progressBar = document.getElementById('evac-progress-bar');
    if (progressBar) progressBar.style.width = '0%';
  }

  _updateEvacDisplay() {
    const progress = this.app.evacuation.getSimulationProgress();
    if (!progress.active && !progress.completed) return;

    const progressBar = document.getElementById('evac-progress-bar');
    if (progressBar) {
      progressBar.style.width = `${progress.progress.toFixed(1)}%`;
    }

    const evacuatedEl = document.getElementById('evac-evacuated');
    if (evacuatedEl) evacuatedEl.textContent = `已疏散: ${progress.evacuatedPeople}`;

    const remainingEl = document.getElementById('evac-remaining');
    if (remainingEl) remainingEl.textContent = `剩余: ${progress.remainingPeople}`;

    const timeEl = document.getElementById('evac-time');
    if (timeEl) timeEl.textContent = `用时: ${progress.simulationTime.toFixed(1)}s`;

    this._updateExitInfo();
    this._updateBottleneckInfo();

    if (progress.completed) {
      this._updateEvacStatus();
    }
  }

  _updateExitInfo() {
    const exitInfoEl = document.getElementById('evac-exit-info');
    if (!exitInfoEl) return;

    const exitData = this.app.evacuation.getExitData();
    const bottlenecks = this.app.evacuation.getBottlenecks();
    const bottleneckExitIds = new Set(bottlenecks.map(b => b.exitId).filter(Boolean));

    exitInfoEl.innerHTML = Object.values(exitData).map(exit => {
      const isBottleneck = bottleneckExitIds.has(exit.id);
      const isBypass = exit.isBypass;
      let cls = 'evac-exit-item';
      if (isBottleneck) cls += ' bottleneck';
      if (isBypass) cls += ' bypass';

      const clearTime = exit.estimatedClearTime === Infinity ? '∞' : `${exit.estimatedClearTime.toFixed(1)}s`;

      return `
        <div class="${cls}">
          <span class="evac-exit-name">${exit.name}</span>
          <span class="evac-exit-stat">已出 <strong>${exit.evacuated}</strong></span>
          <span class="evac-exit-stat">速率 <strong>${exit.flowRate.toFixed(1)}</strong>/s</span>
          <span class="evac-exit-stat">清场 <strong>${clearTime}</strong></span>
        </div>
      `;
    }).join('');
  }

  _updateBottleneckInfo() {
    const bottleneckInfoEl = document.getElementById('evac-bottleneck-info');
    if (!bottleneckInfoEl) return;

    const bottlenecks = this.app.evacuation.getBottlenecks();

    if (bottlenecks.length === 0) {
      bottleneckInfoEl.innerHTML = '<div style="color: #22c55e; font-size: 11px; text-align: center; padding: 8px;">✓ 当前无瓶颈</div>';
      return;
    }

    bottleneckInfoEl.innerHTML = bottlenecks.map(bn => {
      const suggestionsHtml = (bn.suggestedAlternate || []).map(s => `
        <button class="evac-suggestion-btn" data-suggestion-type="${s.type}" data-suggestion-exit="${s.exitId || ''}" data-suggestion-channel="${s.channelId || ''}">
          💡 ${s.description}
        </button>
      `).join('');

      return `
        <div class="evac-bottleneck-item">
          <div class="evac-bottleneck-header">
            <span class="evac-bottleneck-channel">${bn.channelId}</span>
            <span class="evac-bottleneck-density">${(bn.density * 100).toFixed(0)}% 密度</span>
          </div>
          <div class="evac-bottleneck-suggestions">
            ${suggestionsHtml}
          </div>
        </div>
      `;
    }).join('');

    bottleneckInfoEl.querySelectorAll('.evac-suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const suggestion = {
          type: btn.dataset.suggestionType,
          exitId: btn.dataset.suggestionExit || undefined,
          channelId: btn.dataset.suggestionChannel || undefined
        };
        this.app.evacuation.applySuggestion(suggestion);
        this._updateEvacDisplay();
      });
    });
  }

  _renderStrategyComparison() {
    const comparisonEl = document.getElementById('evac-strategy-comparison');
    if (comparisonEl) {
      comparisonEl.style.display = 'block';
    }

    const strategies = this.app.evacuation.compareStrategies();
    if (strategies.length < 2) return;

    const canvas = document.getElementById('evac-curve-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 280 * dpr;
    canvas.height = 160 * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, 280, 160);

    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = 20 + i * 30;
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(270, y);
      ctx.stroke();
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('时间(s)', 150, 155);

    ctx.save();
    ctx.translate(10, 90);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('已疏散', 0, 0);
    ctx.restore();

    const allTimes = strategies.flatMap(s => s.data.map(d => d.time));
    const maxTime = Math.max(...allTimes, 1);
    const allEvac = strategies.flatMap(s => s.data.map(d => d.evacuated));
    const maxEvac = Math.max(...allEvac, 1);

    const chartX = 30;
    const chartY = 15;
    const chartW = 240;
    const chartH = 120;

    strategies.forEach(strategy => {
      if (strategy.data.length < 2) return;

      ctx.strokeStyle = strategy.color || '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();

      strategy.data.forEach((point, i) => {
        const x = chartX + (point.time / maxTime) * chartW;
        const y = chartY + chartH - (point.evacuated / maxEvac) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();
    });

    const legendEl = document.getElementById('evac-strategy-legend');
    if (legendEl) {
      legendEl.innerHTML = strategies.map(s => `
        <div class="evac-legend-item">
          <span class="evac-legend-dot" style="background: ${s.color}"></span>
          <span>${s.label} (${s.totalTime.toFixed(1)}s)</span>
        </div>
      `).join('');
    }
  }

  _showEvacReport() {
    const report = this.app.evacuation.getReport();
    if (!report) {
      const reportBody = document.getElementById('evac-report-body');
      if (reportBody) {
        reportBody.innerHTML = '<p style="text-align:center;color:#64748b;">报告生成中，请等待疏散模拟完成...</p>';
      }
      document.getElementById('evac-report-modal').style.display = 'flex';
      return;
    }

    const eventConfig = EVACUATION_CONFIG.eventTypes[report.eventType];
    const eventLabel = eventConfig?.label || report.eventType;
    const eventIcon = eventConfig?.icon || '🚨';

    const exitStatsHtml = report.exitStats.map(e => `
      <tr>
        <td>${e.name}${e.isBypass ? ' (备用)' : ''}</td>
        <td>${e.evacuated}</td>
        <td>${(e.evacuated / report.totalEvacuated * 100).toFixed(1)}%</td>
      </tr>
    `).join('');

    const bottleneckHtml = report.peakBottlenecks.length > 0
      ? report.peakBottlenecks.map(bn => `
          <tr>
            <td class="report-bottleneck-highlight">${bn.channelId}</td>
            <td>${(bn.maxDensity * 100).toFixed(0)}%</td>
            <td>${bn.timeRange}</td>
            <td>${bn.occurrenceCount}次</td>
          </tr>
        `).join('')
      : '<tr><td colspan="4" style="text-align:center;color:#22c55e;">无显著瓶颈</td></tr>';

    const timeIntervalsHtml = report.timeIntervals.map(ti => `
      <tr>
        <td>${ti.timeStart}s - ${ti.timeEnd}s</td>
        <td>${ti.avgRemaining}</td>
        <td>${ti.avgBottleneckCount}</td>
      </tr>
    `).join('');

    const strategyHtml = report.strategyComparison.map(s => `
      <div class="report-strategy-item">
        <span class="report-strategy-label" style="color:${s.color}">${s.label}</span>
        <span class="report-strategy-time">耗时 ${s.totalTime.toFixed(1)}s / 疏散 ${s.totalEvacuated}人</span>
      </div>
    `).join('');

    const reportBody = document.getElementById('evac-report-body');
    if (reportBody) {
      reportBody.innerHTML = `
        <div class="report-section">
          <div class="report-section-title">${eventIcon} ${eventLabel} 应急疏散报告</div>
          <div class="report-summary">
            <div class="report-metric">
              <div class="report-metric-value">${report.totalPeople}</div>
              <div class="report-metric-label">总人数</div>
            </div>
            <div class="report-metric">
              <div class="report-metric-value">${report.totalEvacuated}</div>
              <div class="report-metric-label">已疏散</div>
            </div>
            <div class="report-metric">
              <div class="report-metric-value">${report.duration}s</div>
              <div class="report-metric-label">总耗时</div>
            </div>
          </div>
        </div>

        <div class="report-section">
          <div class="report-section-title">出口统计</div>
          <table class="report-table">
            <thead>
              <tr><th>出口</th><th>疏散人数</th><th>占比</th></tr>
            </thead>
            <tbody>${exitStatsHtml}</tbody>
          </table>
        </div>

        <div class="report-section">
          <div class="report-section-title">最拥堵节点</div>
          <table class="report-table">
            <thead>
              <tr><th>通道</th><th>峰值密度</th><th>时段</th><th>出现次数</th></tr>
            </thead>
            <tbody>${bottleneckHtml}</tbody>
          </table>
        </div>

        <div class="report-section">
          <div class="report-section-title">时段分析</div>
          <table class="report-table">
            <thead>
              <tr><th>时段</th><th>平均剩余人数</th><th>平均瓶颈数</th></tr>
            </thead>
            <tbody>${timeIntervalsHtml}</tbody>
          </table>
        </div>

        <div class="report-section">
          <div class="report-section-title">策略对比</div>
          ${strategyHtml || '<p style="color:#64748b;text-align:center;">仅基准策略，请记录策略快照后对比</p>'}
        </div>

        <div class="report-section" style="text-align:center;color:#64748b;font-size:11px;margin-top:16px;">
          报告生成时间: ${new Date().toLocaleString('zh-CN')}
        </div>
      `;
    }

    document.getElementById('evac-report-modal').style.display = 'flex';
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
      const count = this.app.flowAnalysis.getVolunteerPositions().length;
      volunteerInfoEl.textContent = `当前志愿者: ${count}人`;
    }

    const fenceInfoEl = document.getElementById('fence-info');
    if (fenceInfoEl) {
      const count = this.app.flowAnalysis.getFencePositions().length;
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

  updateEvacDisplay() {
    this._updateEvacDisplay();
  }
}
