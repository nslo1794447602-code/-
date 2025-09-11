// 视觉诗引擎（p5.js）
// 全屏自适应、慢漂移、章节主题切换、轻交互

let elements = [];
let currentChar;
let lastCharChange;
let colors = ['#3498db', '#e91e63', '#2ecc71', '#f1c40f', '#000000'];
let totalElements = 48;
let charPool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
let paused = false;
let softFreeze = false; // 按住 Shift 的“轻冻结”

function setup() {
  // 每日一诗：固定随机种子（同一天风格一致）
  const today = new Date();
  randomSeed(today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate());
  noiseSeed(today.getFullYear() + today.getMonth() + today.getDate());

  // 画布全屏 & 底层
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');

  // 降低能耗
  frameRate(30);
  pixelDensity(1);

  // 文本
  textAlign(CENTER, CENTER);

  // 初始字符
  currentChar = getRandomChar();
  lastCharChange = millis();

  // 初始化主题观察（根据章节/详情切换）
  initThemeObserver();

  // 生成元素
  generateElements();

  // 标签页隐藏自动暂停
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) noLoop();
    else if (!paused) loop();
  });

  // 动静切换按钮
  const btn = document.getElementById('toggle-anim');
  if (btn) {
    btn.addEventListener('click', () => {
      paused = !paused;
      if (paused) { noLoop(); btn.textContent = '流动'; }
      else { loop(); btn.textContent = '静止'; }
    });
  }

  // 系统减少动态偏好
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    frameRate(12);
    elements.forEach(e => e.rotationSpeed = 0);
  }
}

function draw() {
  // 柔和拖影背景
  noStroke();
  fill(240, 240, 240, 20);
  rect(0, 0, width, height);

  // 每1.5秒更换一次字符
  if (millis() - lastCharChange > 1500) {
    currentChar = getRandomChar();
    lastCharChange = millis();
  }

  // 更新 & 绘制
  for (let i = 0; i < elements.length; i++) {
    elements[i].update();
    elements[i].display();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  generateElements();
}

function mousePressed() {
  // 点击“播种”
  createElementAt(mouseX, mouseY);
  if (elements.length > totalElements * 1.6) elements.shift();
}

function keyPressed() {
  if (key === 'r' || key === 'R') { background(240); generateElements(); }
  if (key === 's' || key === 'S') saveCanvas('poem-' + Date.now(), 'png');
  if (keyCode === SHIFT) softFreeze = true;
}
function keyReleased() {
  if (keyCode === SHIFT) softFreeze = false;
}

// 主题观察：观察所有带 data-chars 的元素（首页各区 + 详情页）
function initThemeObserver() {
  const setThemeFrom = (el) => {
    if (!el) return;
    const chars = (el.dataset.chars || '').replace(/\s+/g, '');
    if (chars.length) charPool = chars;
    const palette = (el.dataset.colors || '').split(',').map(s => s.trim()).filter(Boolean);
    if (palette.length) colors = palette;
    const d = parseInt(el.dataset.density, 10);
    if (!isNaN(d)) { totalElements = d; generateElements(); }
  };

  // 初始：页面上第一个带 data-chars 的元素
  const first = document.querySelector('[data-chars]');
  if (first) setThemeFrom(first);

  // 观察
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) setThemeFrom(e.target); });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-chars]').forEach(el => io.observe(el));
}

function generateElements() {
  elements = [];
  const lowerCount = floor(totalElements * 0.7);
  const upperCount = totalElements - lowerCount;
  const lowerPts = bestCandidatePositions(lowerCount, { x: 0, y: height / 2, w: width, h: height / 2 });
  const upperPts = bestCandidatePositions(upperCount, { x: 0, y: 0, w: width, h: height / 2 });
  [...lowerPts, ...upperPts].forEach(p => createElementAt(p.x, p.y));
}

function createElementAt(x, y) {
  const type = floor(random(3)); // 0: 花, 1: 草, 2: 叶
  const col = colors[floor(random(colors.length))];
  elements.push(new NaturalElement(x, y, type, col));
}

function getRandomChar() {
  const i = floor(random(charPool.length));
  return charPool[i];
}

// 更自然的散布（最优候选采样）
function bestCandidatePositions(count, rect) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    let best = null, bestDist = -1;
    for (let k = 0; k < 15; k++) {
      const x = random(rect.x, rect.x + rect.w);
      const y = random(rect.y, rect.y + rect.h);
      let dmin = 1e9;
      for (const p of pts) dmin = min(dmin, dist(x, y, p.x, p.y));
      if (dmin > bestDist) { bestDist = dmin; best = { x, y }; }
    }
    pts.push(best || { x: random(rect.x, rect.x + rect.w), y: random(rect.y, rect.y + rect.h) });
  }
  return pts;
}

// 元素类
class NaturalElement {
  constructor(x, y, type, col) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.col = col;
    this.size = random(30, 80);
    this.angle = random(TWO_PI);
    this.rotationSpeed = random(-0.004, 0.004);
    // 漂移（风场）
    this.t = random(1000);
    this.drift = random(0.08, 0.35);
  }

  update() {
    if (softFreeze) return; // 按住 Shift 时轻冻结
    this.t += 0.002;
    const ang = noise(this.x * 0.001, this.y * 0.001, this.t) * TWO_PI * 2;
    this.x += cos(ang) * this.drift;
    this.y += sin(ang) * this.drift;
    this.angle += this.rotationSpeed;

    // 环绕边界
    const m = 40;
    if (this.x < -m) this.x = width + m;
    if (this.x > width + m) this.x = -m;
    if (this.y < -m) this.y = height + m;
    if (this.y > height + m) this.y = -m;
  }

  display() {
    push();
    translate(this.x, this.y);
    rotate(this.angle);
    noStroke();
    fill(this.col);
    textSize(this.size / 3);
    switch (this.type) {
      case 0: this.drawFlower(); break;
      case 1: this.drawGrass(); break;
      case 2: this.drawLeaf();  break;
    }
    pop();
  }

  drawFlower() {
    for (let i = 0; i < 6; i++) {
      push();
      rotate(TWO_PI / 6 * i);
      text(currentChar, 0, -this.size / 3.5);
      pop();
    }
    fill(241, 196, 15, 200);
    ellipse(0, 0, this.size / 4, this.size / 4);
  }

  drawGrass() {
    for (let i = 0; i < 3; i++) {
      push();
      translate(0, -this.size / 2.8 * i * 0.5);
      rotate(random(-0.35, 0.35));
      text(currentChar, 0, 0);
      pop();
    }
  }

  drawLeaf() {
    for (let i = 0; i < 2; i++) {
      push();
      scale(1, i === 0 ? 1 : -1);
      beginShape();
      curveVertex(0, 0);
      curveVertex(0, 0);
      curveVertex(this.size / 3.8, -this.size / 3.8);
      curveVertex(this.size / 1.8, -this.size / 8);
      curveVertex(this.size / 1.5, 0);
      curveVertex(this.size / 1.5, 0);
      endShape();
      pop();
    }
    textSize(this.size / 5);
    text(currentChar, this.size / 4, 0);
  }
}