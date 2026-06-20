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
