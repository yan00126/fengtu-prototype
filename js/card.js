// 分享卡片：在设备上用 canvas 生成图片，不经过服务器。默认不显示 CRS。

const W = 1080;
const H = 1350;
const FONT = '-apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// data: { title, subtitle, nickname, stats: [{label, value}], lines: [string], footer }
export function drawCard(data) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#faf7f4';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#b4442f';
  ctx.fillRect(0, 0, W, 300);

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 64px ${FONT}`;
  ctx.fillText(data.title, 80, 140);
  ctx.font = `400 36px ${FONT}`;
  ctx.fillStyle = '#fbe3dc';
  ctx.fillText(data.subtitle, 80, 210);
  if (data.nickname) ctx.fillText(data.nickname, 80, 260);

  // 数据格子
  const cols = 2;
  const boxW = (W - 160 - 30) / cols;
  const boxH = 200;
  data.stats.forEach((s, i) => {
    const x = 80 + (i % cols) * (boxW + 30);
    const y = 360 + Math.floor(i / cols) * (boxH + 30);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, y, boxW, boxH, 28);
    ctx.fill();
    ctx.strokeStyle = '#e6ded7';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#2a2522';
    ctx.font = `700 72px ${FONT}`;
    ctx.fillText(String(s.value), x + 36, y + 110);
    ctx.fillStyle = '#6d645e';
    ctx.font = `400 32px ${FONT}`;
    ctx.fillText(s.label, x + 36, y + 165);
  });

  const rows = Math.ceil(data.stats.length / cols);
  let y = 360 + rows * (boxH + 30) + 40;
  ctx.fillStyle = '#2a2522';
  ctx.font = `400 38px ${FONT}`;
  for (const line of data.lines) {
    if (y > H - 160) break;
    ctx.fillText(line, 80, y);
    y += 64;
  }

  ctx.fillStyle = '#9a908a';
  ctx.font = `400 30px ${FONT}`;
  ctx.fillText(data.footer, 80, H - 70);
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
