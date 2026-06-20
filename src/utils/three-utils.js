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
