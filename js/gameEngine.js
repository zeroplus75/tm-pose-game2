/**
 * gameEngine.js
 * Catch Zone Game Logic
 *
 * Manages game state, basket position, falling items, scoring, and level progression.
 */

class GameEngine {
  constructor() {
    this.reset();
    
    // Callbacks
    this.onScoreChange = null; // (score, level, missCount) => void
    this.onGameEnd = null;     // (score, level, reason) => void
  }

  reset() {
    this.isGameActive = false;
    this.score = 0;
    this.level = 1;
    this.missCount = 0; // Max 2
    
    // Level settings
    this.levelDuration = 20; // seconds per level
    this.currentLevelTime = 0;
    
    // Physics & Spawning
    this.baseDropTime = 2.0; // Seconds to fall in Level 1
    this.currentDropTime = this.baseDropTime;
    this.items = []; // { type, x, y, speed, caught }
    this.lastSpawnTime = 0;
    this.nextSpawnInterval = 0; // ms
    
    // Player
    this.basketPosition = "CENTER"; // LEFT, CENTER, RIGHT
  }

  /**
   * Start the game
   */
  start() {
    this.reset();
    this.isGameActive = true;
    this.updateDropTime();
    this.scheduleNextSpawn();
    this.lastTime = performance.now();
  }

  /**
   * Stop the game
   */
  stop() {
    this.isGameActive = false;
  }

  /**
   * Set basket position from pose
   * @param {string} poseLabel - "LEFT", "CENTER", "RIGHT"
   */
  setBasketPose(poseLabel) {
    if (["LEFT", "CENTER", "RIGHT"].includes(poseLabel)) {
      this.basketPosition = poseLabel;
    }
  }

  /**
   * Main Game Loop Update
   * @param {number} timestamp - Current time
   */
  update(timestamp) {
    if (!this.isGameActive) return;

    const deltaTime = (timestamp - this.lastTime) / 1000; // seconds
    this.lastTime = timestamp;

    // 1. Level Timer
    this.currentLevelTime += deltaTime;
    if (this.currentLevelTime >= this.levelDuration) {
      this.levelUp();
    }

    // 2. Spawn Items
    if (timestamp > this.lastSpawnTime + this.nextSpawnInterval) {
      this.spawnItem();
      this.lastSpawnTime = timestamp;
      this.scheduleNextSpawn();
    }

    // 3. Move Items
    // canvas height is normalized to 1.0 for logic, handled in draw
    const dropSpeed = 1.0 / this.currentDropTime; // units per second
    
    this.items.forEach(item => {
      item.y += dropSpeed * deltaTime;
    });

    // 4. Collision Detection
    this.checkCollisions();

    // 5. Remove off-screen items
    // (Missed items handled in checkCollisions)
    this.items = this.items.filter(item => item.y <= 1.2 && !item.caught);
  }

  updateDropTime() {
    // Level 1: 2.0s, Level 2: 1.8s, ...
    this.currentDropTime = Math.max(0.5, 2.0 - (this.level - 1) * 0.2);
  }

  scheduleNextSpawn() {
    // Interval = 60% ~ 80% of currentDropTime
    const min = this.currentDropTime * 600; // ms
    const max = this.currentDropTime * 800; // ms
    this.nextSpawnInterval = Math.random() * (max - min) + min;
  }

  spawnItem() {
    const zones = ["LEFT", "CENTER", "RIGHT"];
    const type = this.getRandomItemType();
    
    this.items.push({
      type: type, // 'apple', 'pear', 'orange', 'bomb'
      zone: zones[Math.floor(Math.random() * zones.length)],
      y: 0, // Top
      caught: false,
      processed: false // To prevent double counting miss
    });
  }

  getRandomItemType() {
    const rand = Math.random();
    if (rand < 0.2) return 'bomb'; // 20% Bomb
    if (rand < 0.6) return 'apple'; // 40% Apple
    if (rand < 0.85) return 'pear'; // 25% Pear
    return 'orange'; // 15% Orange
  }

  checkCollisions() {
    const catchThreshold = 0.85; // Y position to catch
    const missThreshold = 1.0; // Y position considered missed

    this.items.forEach(item => {
      if (item.caught || item.processed) return;

      // Check Catch
      if (item.y >= catchThreshold && item.y < missThreshold) {
        if (item.zone === this.basketPosition) {
          this.handleCatch(item);
        }
      } 
      // Check Miss (Only fruits)
      else if (item.y >= missThreshold) {
        if (item.type !== 'bomb') {
          this.handleMiss(item);
        }
        item.processed = true;
      }
    });
  }

  handleCatch(item) {
    if (item.type === 'bomb') {
      this.gameOver("폭탄을 건드렸습니다!");
      return;
    }

    item.caught = true;
    let points = 0;
    if (item.type === 'apple') points = 100;
    else if (item.type === 'pear') points = 150;
    else if (item.type === 'orange') points = 200;

    this.score += points;
    this.notifyChange();
  }

  handleMiss(item) {
    this.missCount++;
    this.notifyChange();

    if (this.missCount === 1) {
      // Warning? UI handled via notifyChange
    } else if (this.missCount >= 2) {
      this.gameOver("과일을 2놓쳐서 게임 오버!");
    }
  }

  levelUp() {
    this.level++;
    this.currentLevelTime = 0;
    this.updateDropTime();
    this.notifyChange();
  }

  gameOver(reason) {
    this.isGameActive = false;
    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level, reason);
    }
  }

  notifyChange() {
    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.level, this.missCount);
    }
  }
  
  // Setters for callbacks
  setScoreChangeCallback(cb) { this.onScoreChange = cb; }
  setGameEndCallback(cb) { this.onGameEnd = cb; }

  /**
   * Draw game elements on canvas
   * @param {CanvasRenderingContext2D} ctx 
   * @param {number} width 
   * @param {number} height 
   */
  draw(ctx, width, height) {
    if (!this.isGameActive) return;

    // Draw Zones Lines (Optional)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.moveTo(width / 3, 0); ctx.lineTo(width / 3, height);
    ctx.moveTo(width * 2 / 3, 0); ctx.lineTo(width * 2 / 3, height);
    ctx.stroke();

    // Draw Basket (Simple Rectangle or Arc for now)
    const basketY = height * 0.9;
    let basketX = width / 2;
    if (this.basketPosition === "LEFT") basketX = width / 6;
    else if (this.basketPosition === "CENTER") basketX = width / 2;
    else if (this.basketPosition === "RIGHT") basketX = width * 5 / 6;

    ctx.fillStyle = "rgba(0, 255, 0, 0.7)";
    ctx.fillRect(basketX - 30, basketY - 10, 60, 20); // Width 60 basket

    // Draw Items
    this.items.forEach(item => {
      if (item.caught) return;

      let itemX = width / 2;
      if (item.zone === "LEFT") itemX = width / 6;
      else if (item.zone === "CENTER") itemX = width / 2;
      else if (item.zone === "RIGHT") itemX = width * 5 / 6;
      
      const itemY = item.y * height;

      // Color/Shape by type
      ctx.beginPath();
      if (item.type === 'bomb') {
        ctx.fillStyle = "black";
        ctx.arc(itemX, itemY, 15, 0, Math.PI * 2);
      } else if (item.type === 'apple') {
        ctx.fillStyle = "red";
        ctx.arc(itemX, itemY, 15, 0, Math.PI * 2);
      } else if (item.type === 'pear') {
        ctx.fillStyle = "yellow"; // Golden pear
        ctx.arc(itemX, itemY, 15, 0, Math.PI * 2);
      } else if (item.type === 'orange') {
        ctx.fillStyle = "orange";
        ctx.arc(itemX, itemY, 15, 0, Math.PI * 2);
      }
      ctx.fill();
    });
  }
}

// Export
window.GameEngine = GameEngine;
