/**
 * main.js
 * Catch Zone Game Main Entry Point
 */

// Global Instances
let poseEngine;
let gameEngine;
let stabilizer;
let ctx;
let labelContainer;

/**
 * Initialize Application (Load Model & Camera)
 */
async function init() {
  const startBtn = document.getElementById("startBtn");
  startBtn.disabled = true;
  startBtn.innerText = "Loading...";

  try {
    // 1. PoseEngine Init
    poseEngine = new PoseEngine("./my_model/");
    const { maxPredictions, webcam } = await poseEngine.init({
      size: 400, // Larger size for better game visibility
      flip: true
    });

    // 2. Stabilizer Init
    stabilizer = new PredictionStabilizer({
      threshold: 0.8,
      smoothingFrames: 4
    });

    // 3. GameEngine Init
    gameEngine = new GameEngine();
    setupGameCallbacks();

    // 4. Canvas Setup
    const canvas = document.getElementById("canvas");
    canvas.width = 400;
    canvas.height = 400;
    ctx = canvas.getContext("2d");

    // 5. Label Container Setup
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
    for (let i = 0; i < maxPredictions; i++) {
      labelContainer.appendChild(document.createElement("div"));
    }

    // 6. Register Callbacks
    poseEngine.setPredictionCallback(handlePrediction);
    poseEngine.setDrawCallback(drawLoop);

    // 7. Start Camera Loop
    poseEngine.start();

    // UI Update
    startBtn.innerText = "Camera Ready";
    document.getElementById("gameStartBtn").disabled = false;

  } catch (error) {
    console.error("Init Error:", error);
    alert("Initialization failed. Check console.");
    startBtn.disabled = false;
    startBtn.innerText = "Retry Init";
  }
}

function setupGameCallbacks() {
  gameEngine.setScoreChangeCallback((score, level, missCount) => {
    document.getElementById("score").innerText = score;
    document.getElementById("level").innerText = level;
    document.getElementById("miss").innerText = missCount;
  });

  gameEngine.setGameEndCallback((score, level, reason) => {
    document.getElementById("final-score").innerText = score;
    document.getElementById("game-over-reason").innerText = reason || "Game Over";
    document.getElementById("game-over-overlay").classList.remove("hidden");
  });
}

/**
 * Start the Game Logic
 */
function gameStart() {
  if (!gameEngine) return;

  // Hide Overlay
  document.getElementById("game-over-overlay").classList.add("hidden");

  // Start Engine
  gameEngine.start();
  console.log("Game Started!");
}

/**
 * Prediction Callback
 */
function handlePrediction(predictions, pose) {
  // Stabilize
  const stabilized = stabilizer.stabilize(predictions);

  // Update Labels
  for (let i = 0; i < predictions.length; i++) {
    const classPrediction =
      predictions[i].className + ": " + predictions[i].probability.toFixed(2);
    labelContainer.childNodes[i].innerHTML = classPrediction;

    // Highlight active
    if (stabilized.className === predictions[i].className) {
      labelContainer.childNodes[i].style.background = "#00adb5";
      labelContainer.childNodes[i].style.color = "white";
    } else {
      labelContainer.childNodes[i].style.background = "rgba(255,255,255,0.1)";
      labelContainer.childNodes[i].style.color = "inherit";
    }
  }

  // Update Max Prediction UI
  const maxPredictionDiv = document.getElementById("max-prediction");
  maxPredictionDiv.innerHTML = stabilized.className || "Detecting...";

  // Send to GameEngine
  if (gameEngine && gameEngine.isGameActive && stabilized.className) {
    gameEngine.setBasketPose(stabilized.className);
  }
}

/**
 * Main Drawing Loop (Called by PoseEngine)
 */
function drawLoop(pose) {
  if (poseEngine.webcam && poseEngine.webcam.canvas) {
    // 1. Draw Webcam Feed
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0);

    // 2. Draw Skeleton (Optional, maybe semi-transparent)
    if (pose) {
      const minPartConfidence = 0.5;
      // Semi-transparent
      ctx.globalAlpha = 0.5;
      tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
      tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
      ctx.globalAlpha = 1.0;
    }

    // 3. Update & Draw Game
    if (gameEngine) {
      gameEngine.update(performance.now());

      // Update Time UI
      if (gameEngine.isGameActive) {
        const timeLeft = Math.max(0, gameEngine.levelDuration - gameEngine.currentLevelTime).toFixed(1);
        document.getElementById("time").innerText = timeLeft;
      }

      gameEngine.draw(ctx, ctx.canvas.width, ctx.canvas.height);
    }
  }
}

// Expose functions globally for HTML buttons
window.init = init;
window.gameStart = gameStart;
