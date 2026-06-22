export const SCENE_CONFIGS = {
  concert: {
    name: '演唱会',
    stageType: 'concert',
    stagePosition: { x: 0, y: 0, z: -35 },
    stageRotation: { x: 0, y: 0, z: 0 },
    stageSize: { width: 30, depth: 15, height: 2 },
    availableZones: ['north', 'east', 'west', 'south'],
    entryStrategy: 'all',
    ticketZones: {
      vip: { price: 2880, color: '#fbbf24' },
      premium: { price: 1280, color: '#f97316' },
      standard: { price: 680, color: '#3b82f6' },
      economy: { price: 380, color: '#22c55e' }
    },
    obstructions: {
      speakerTowers: [
        { x: -18, y: 0, z: -37, width: 2, height: 8, depth: 2, label: '音响塔左' },
        { x: 18, y: 0, z: -37, width: 2, height: 8, depth: 2, label: '音响塔右' }
      ],
      cameras: [
        { x: -25, y: 6, z: -30, radius: 0.5, height: 2, label: '摄像机1' },
        { x: 25, y: 6, z: -30, radius: 0.5, height: 2, label: '摄像机2' },
        { x: 0, y: 10, z: -28, radius: 0.6, height: 3, label: '摄像机3' }
      ],
      railings: {
        rows: [3, 6, 10, 14],
        height: 1.2,
        thickness: 0.08
      },
      screens: [
        { x: -20, y: 10, z: -35, width: 8, height: 5, label: '侧屏左' },
        { x: 20, y: 10, z: -35, width: 8, height: 5, label: '侧屏右' }
      ]
    }
  },
  game: {
    name: '比赛',
    stageType: 'court',
    stagePosition: { x: 0, y: 0, z: 0 },
    stageRotation: { x: 0, y: 0, z: 0 },
    stageSize: { width: 28, depth: 15, height: 0.2 },
    availableZones: ['north', 'south', 'east', 'west'],
    entryStrategy: 'all',
    ticketZones: {
      vip: { price: 1280, color: '#fbbf24' },
      premium: { price: 680, color: '#f97316' },
      standard: { price: 380, color: '#3b82f6' },
      economy: { price: 180, color: '#22c55e' }
    },
    obstructions: {
      speakerTowers: [
        { x: -18, y: 0, z: -10, width: 1.5, height: 6, depth: 1.5, label: '音响塔左' },
        { x: 18, y: 0, z: -10, width: 1.5, height: 6, depth: 1.5, label: '音响塔右' }
      ],
      cameras: [
        { x: -16, y: 5, z: 0, radius: 0.5, height: 2, label: '摄像机1' },
        { x: 16, y: 5, z: 0, radius: 0.5, height: 2, label: '摄像机2' },
        { x: 0, y: 8, z: -10, radius: 0.6, height: 3, label: '摄像机3' },
        { x: 0, y: 8, z: 10, radius: 0.6, height: 3, label: '摄像机4' }
      ],
      railings: {
        rows: [3, 6, 10, 14],
        height: 1.1,
        thickness: 0.08
      },
      screens: [
        { x: 0, y: 12, z: -12, width: 10, height: 6, label: '计分大屏' }
      ]
    }
  },
  family: {
    name: '亲子活动',
    stageType: 'family',
    stagePosition: { x: 0, y: 0, z: -20 },
    stageRotation: { x: 0, y: 0, z: 0 },
    stageSize: { width: 20, depth: 12, height: 0.5 },
    availableZones: ['south', 'east', 'west'],
    entryStrategy: 'south-main',
    ticketZones: {
      vip: { price: 580, color: '#fbbf24' },
      family: { price: 380, color: '#a855f7' },
      standard: { price: 280, color: '#3b82f6' }
    },
    obstructions: {
      speakerTowers: [
        { x: -14, y: 0, z: -22, width: 1.5, height: 5, depth: 1.5, label: '音响塔左' },
        { x: 14, y: 0, z: -22, width: 1.5, height: 5, depth: 1.5, label: '音响塔右' }
      ],
      cameras: [
        { x: -10, y: 4, z: -18, radius: 0.4, height: 1.5, label: '摄像机1' },
        { x: 10, y: 4, z: -18, radius: 0.4, height: 1.5, label: '摄像机2' }
      ],
      railings: {
        rows: [3, 6, 10],
        height: 1.0,
        thickness: 0.08
      },
      screens: []
    }
  }
};

export const ZONE_CONFIGS = {
  north: {
    name: '北区',
    color: '#ef4444',
    angle: 0,
    rows: 15,
    seatsPerRow: 40,
    startAngle: -60,
    endAngle: 60
  },
  south: {
    name: '南区',
    color: '#22c55e',
    angle: 180,
    rows: 15,
    seatsPerRow: 40,
    startAngle: 120,
    endAngle: 240
  },
  east: {
    name: '东区',
    color: '#3b82f6',
    angle: 90,
    rows: 12,
    seatsPerRow: 25,
    startAngle: 30,
    endAngle: 150
  },
  west: {
    name: '西区',
    color: '#f59e0b',
    angle: 270,
    rows: 12,
    seatsPerRow: 25,
    startAngle: 210,
    endAngle: 330
  }
};

export const STADIUM_CONFIG = {
  innerRadius: 40,
  outerRadius: 70,
  seatWidth: 0.5,
  seatDepth: 0.8,
  rowHeight: 0.3,
  riserHeight: 0.4,
  floorHeight: 0.2,
  concourseHeight: 4
};

export const OBSTRUCTION_GRADES = {
  A: { label: '无遮挡', color: '#22c55e', description: '视线完全畅通，无任何遮挡', factor: 1.0 },
  B: { label: '轻微遮挡', color: '#84cc16', description: '轻微栏杆遮挡，不影响观赛体验', factor: 0.85 },
  C: { label: '部分遮挡', color: '#eab308', description: '部分视线被音响塔/摄像机遮挡', factor: 0.6 },
  D: { label: '严重遮挡', color: '#ef4444', description: '严重遮挡，影响核心观赛区域', factor: 0.3 }
};

export const EVACUATION_CONFIG = {
  baseSpeed: 1.2,
  agentSampleRate: 0.15,
  densityThreshold: 0.6,
  criticalThreshold: 0.85,
  maxDensity: 1.0,
  eventTypes: {
    fire: { label: '火警', icon: '🔥', color: '#ef4444', speedFactor: 1.2 },
    terror: { label: '恐怖威胁', icon: '⚠️', color: '#dc2626', speedFactor: 1.5 },
    equipment: { label: '设备故障', icon: '⚡', color: '#f97316', speedFactor: 0.9 },
    general: { label: '综合应急', icon: '🚨', color: '#eab308', speedFactor: 1.0 }
  },
  bypassExitPositions: [
    { angle: Math.PI / 6 },
    { angle: Math.PI / 3 },
    { angle: 2 * Math.PI / 3 },
    { angle: 5 * Math.PI / 6 },
    { angle: 7 * Math.PI / 6 },
    { angle: 4 * Math.PI / 3 },
    { angle: 5 * Math.PI / 3 },
    { angle: 11 * Math.PI / 6 }
  ]
};

export const QUEUE_SIMULATION_CONFIG = {
  baseArrivalRate: 2.0,
  peakMultiplier: 3.0,
  gateProcessingTime: 3.5,
  accessibleProcessingTime: 5.0,
  volunteerEfficiency: 0.15,
  fenceRedirectFactor: 0.3,
  heatColors: {
    low: '#22c55e',
    medium: '#eab308',
    high: '#f97316',
    critical: '#ef4444'
  },
  heatThresholds: {
    low: 20,
    medium: 50,
    high: 80,
    critical: 100
  }
};
