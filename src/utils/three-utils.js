import * as THREE from 'three';

export function createTextSprite(text, options = {}) {
  const {
    fontSize = 16,
    fontFace = 'Arial',
    color = '#ffffff',
    bgColor = 'rgba(0,0,0,0.7)',
    padding = 4,
    borderRadius = 4
  } = options;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  context.font = `${fontSize}px ${fontFace}`;
  const textWidth = context.measureText(text).width;
  
  canvas.width = textWidth + padding * 2;
  canvas.height = fontSize + padding * 2;
  
  context.font = `${fontSize}px ${fontFace}`;
  
  if (bgColor) {
    context.fillStyle = bgColor;
    roundRect(context, 0, 0, canvas.width, canvas.height, borderRadius);
    context.fill();
  }
  
  context.fillStyle = color;
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });
  
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(canvas.width / 50, canvas.height / 50, 1);
  
  return sprite;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function lerpColor(color1, color2, t) {
  const c1 = new THREE.Color(color1);
  const c2 = new THREE.Color(color2);
  return c1.lerp(c2, t);
}

export function getSightQualityColor(quality) {
  if (quality >= 0.85) return '#22c55e';
  if (quality >= 0.7) return '#84cc16';
  if (quality >= 0.5) return '#eab308';
  if (quality >= 0.3) return '#f97316';
  return '#ef4444';
}

export function getSightQualityLabel(quality) {
  if (quality >= 0.85) return '极佳';
  if (quality >= 0.7) return '良好';
  if (quality >= 0.5) return '一般';
  if (quality >= 0.3) return '较差';
  return '很差';
}

export function getSightQualityClass(quality) {
  if (quality >= 0.85) return 'excellent';
  if (quality >= 0.7) return 'good';
  if (quality >= 0.5) return 'medium';
  if (quality >= 0.3) return 'poor';
  return 'bad';
}

export function getObstructionGrade(obstructionScore) {
  if (obstructionScore >= 0.85) return 'A';
  if (obstructionScore >= 0.6) return 'B';
  if (obstructionScore >= 0.3) return 'C';
  return 'D';
}

export function getObstructionGradeInfo(grade) {
  const grades = {
    A: { label: 'A级 · 无遮挡', color: '#22c55e', description: '视线完全畅通，无任何遮挡', ticketNote: '正常售票' },
    B: { label: 'B级 · 轻微遮挡', color: '#84cc16', description: '轻微栏杆遮挡，不影响观赛体验', ticketNote: '正常售票，标注轻微遮挡' },
    C: { label: 'C级 · 部分遮挡', color: '#eab308', description: '部分视线被音响塔/摄像机遮挡', ticketNote: '折价售票，标注部分遮挡' },
    D: { label: 'D级 · 严重遮挡', color: '#ef4444', description: '严重遮挡，影响核心观赛区域', ticketNote: '限制售票，标注严重遮挡' }
  };
  return grades[grade] || grades['A'];
}

export function getQueueHeatColor(people, thresholds) {
  if (people < thresholds.low) return '#22c55e';
  if (people < thresholds.medium) return '#eab308';
  if (people < thresholds.high) return '#f97316';
  return '#ef4444';
}

export function getQueueHeatLevel(people, thresholds) {
  if (people < thresholds.low) return 'low';
  if (people < thresholds.medium) return 'medium';
  if (people < thresholds.high) return 'high';
  return 'critical';
}

export function createConeGeometry(origin, target, fovAngle, segments) {
  const direction = new THREE.Vector3().subVectors(target, origin);
  const distance = direction.length();
  direction.normalize();
  
  const halfAngle = (fovAngle / 2) * Math.PI / 180;
  const radius = Math.tan(halfAngle) * distance;
  
  const positions = [0, 0, 0];
  const indices = [];
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    positions.push(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      -distance
    );
  }
  
  for (let i = 0; i < segments; i++) {
    indices.push(0, i + 1, i + 2);
  }
  indices.push(0, segments + 1, 1);
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  return geometry;
}
