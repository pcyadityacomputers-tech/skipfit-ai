const camera = document.getElementById("camera");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

const status = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const resetBtn = document.getElementById("resetBtn");

const frameDisplay = document.getElementById("frame");
const fpsDisplay = document.getElementById("fps");
const bodyDisplay = document.getElementById("body");
const gestureDisplay = document.getElementById("gesture");
const countDisplay = document.getElementById("count");

let stream = null;
let running = false;
let detector = null;

let frameNumber = 0;
let fpsFrames = 0;
let fpsTime = performance.now();

let skipCount = 0;
let previousHipY = null;
let previousAnkleY = null;

let jumpState = "GROUND";
let lastSkipTime = 0;


/* =========================
   LOAD AI
========================= */

async function loadAI() {

  try {

    status.textContent = "Loading MoveNet AI...";

    await tf.ready();

    detector =
      await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          modelType:
            poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        }
      );

    status.textContent =
      "✅ AI READY — START CAMERA";

  } catch (error) {

    console.error(error);

    status.textContent =
      "❌ AI ERROR: " + error.message;
  }
}


/* =========================
   OPEN CAMERA
========================= */

async function startCamera() {

  try {

    status.textContent =
      "Opening camera...";

    /* Stop any old camera first */

    if (stream) {

      stream.getTracks().forEach(track => {
        track.stop();
      });

      stream = null;
    }


    /*
      IMPORTANT:
      Do NOT force the rear camera
      at first.

      This avoids AbortError on
      some Android/Chrome phones.
    */

    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {
          width: {
            ideal: 640
          },

          height: {
            ideal: 480
          }
        },

        audio: false
      });


    camera.srcObject = stream;

    camera.style.display = "block";


    /*
      Wait until video actually has
      camera dimensions.
    */

    await new Promise(resolve => {

      if (
        camera.readyState >= 2 &&
        camera.videoWidth > 0
      ) {

        resolve();

        return;
      }


      camera.onloadedmetadata = () => {
        resolve();
      };

    });


    await camera.play();


    overlay.width =
      camera.videoWidth;

    overlay.height =
      camera.videoHeight;


    running = true;

    frameNumber = 0;

    previousHipY = null;
    previousAnkleY = null;


    status.textContent =
      "📷 CAMERA WORKING";

    bodyDisplay.textContent =
      "WAIT";


    detectFrame();


  } catch (error) {

    console.error(
      "CAMERA ERROR:",
      error
    );

    status.textContent =
      "❌ CAMERA ERROR: " +
      error.name;

    gestureDisplay.textContent =
      error.message || "Camera failed";

  }
}


/* =========================
   FRAME PROCESSING
========================= */

async function detectFrame() {

  if (!running) return;


  frameNumber++;

  frameDisplay.textContent =
    frameNumber;


  fpsFrames++;

  const now =
    performance.now();


  if (
    now - fpsTime >= 1000
  ) {

    fpsDisplay.textContent =
      fpsFrames;

    fpsFrames = 0;

    fpsTime = now;
  }


  try {

    const poses =
      await detector.estimatePoses(
        camera
      );


    ctx.clearRect(
      0,
      0,
      overlay.width,
      overlay.height
    );


    if (
      poses.length === 0
    ) {

      bodyDisplay.textContent =
        "NO";

      gestureDisplay.textContent =
        "GESTURE: NO BODY";

    } else {

      const keypoints =
        poses[0].keypoints;


      drawKeypoints(
        keypoints
      );


      bodyDisplay.textContent =
        "YES";


      detectGesture(
        keypoints
      );


      detectSkip(
        keypoints
      );
    }


  } catch (error) {

    console.error(
      "FRAME ERROR:",
      error
    );
  }


  requestAnimationFrame(
    detectFrame
  );
}


/* =========================
   DRAW KEYPOINTS
========================= */

function drawKeypoints(keypoints) {

  for (
    const p of keypoints
  ) {

    if (
      p.score < 0.35
    ) continue;


    const x =
      p.x *
      overlay.width /
      camera.videoWidth;


    const y =
      p.y *
      overlay.height /
      camera.videoHeight;


    ctx.beginPath();

    ctx.arc(
      x,
      y,
      5,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      "#00ff88";

    ctx.fill();
  }
}


/* =========================
   GET POINT
========================= */

function getPoint(
  keypoints,
  index
) {

  const p =
    keypoints[index];

  if (
    !p ||
    p.score < 0.35
  ) {

    return null;
  }

  return p;
}


/* =========================
   GESTURE DETECTION
========================= */

function detectGesture(
  keypoints
) {

  const leftShoulder =
    getPoint(keypoints, 5);

  const rightShoulder =
    getPoint(keypoints, 6);

  const leftWrist =
    getPoint(keypoints, 9);

  const rightWrist =
    getPoint(keypoints, 10);

  const leftHip =
    getPoint(keypoints, 11);

  const rightHip =
    getPoint(keypoints, 12);


  if (
    !leftShoulder ||
    !rightShoulder ||
    !leftWrist ||
    !rightWrist ||
    !leftHip ||
    !rightHip
  ) {

    gestureDisplay.textContent =
      "GESTURE: PARTLY LOST";

    return;
  }


  /*
    BOTH HANDS UP
  */

  if (
    leftWrist.y <
      leftShoulder.y - 0.10 &&

    rightWrist.y <
      rightShoulder.y - 0.10
  ) {

    gestureDisplay.textContent =
      "🖐️ HANDS UP";

    return;
  }


  /*
    ARMS OUT
  */

  const armDistance =
    Math.abs(
      leftWrist.x -
      rightWrist.x
    );


  if (
    armDistance > 0.45
  ) {

    gestureDisplay.textContent =
      "↔️ ARMS OUT";

    return;
  }


  gestureDisplay.textContent =
    "🧍 NORMAL";
}


/* =========================
   BASIC SKIP DETECTION
========================= */

function detectSkip(
  keypoints
) {

  const leftHip =
    getPoint(keypoints, 11);

  const rightHip =
    getPoint(keypoints, 12);

  const leftAnkle =
    getPoint(keypoints, 15);

  const rightAnkle =
    getPoint(keypoints, 16);


  if (
    !leftHip ||
    !rightHip ||
    !leftAnkle ||
    !rightAnkle
  ) {

    return;
  }


  const hipY =
    (
      leftHip.y +
      rightHip.y
    ) / 2;


  const ankleY =
    (
      leftAnkle.y +
      rightAnkle.y
    ) / 2;


  let movement = 0;


  if (
    previousHipY !== null &&
    previousAnkleY !== null
  ) {

    const hipMovement =
      previousHipY - hipY;

    const ankleMovement =
      previousAnkleY - ankleY;


    movement =
      hipMovement * 0.55 +
      ankleMovement * 0.45;
  }


  previousHipY = hipY;
  previousAnkleY = ankleY;


  const now =
    performance.now();


  if (
    jumpState === "GROUND" &&
    movement > 0.008
  ) {

    jumpState = "AIR";
  }


  if (
    jumpState === "AIR" &&
    movement < -0.008
  ) {

    if (
      now - lastSkipTime > 300
    ) {

      skipCount++;

      countDisplay.textContent =
        skipCount;

      lastSkipTime =
        now;

      gestureDisplay.textContent =
        "🦘 SKIP " +
        skipCount;
    }


    jumpState =
      "GROUND";
  }
}


/* =========================
   STOP
========================= */

function stopCamera() {

  running = false;


  if (stream) {

    stream.getTracks().forEach(
      track => track.stop()
    );

    stream = null;
  }


  camera.srcObject = null;

  camera.style.display =
    "none";


  ctx.clearRect(
    0,
    0,
    overlay.width,
    overlay.height
  );


  status.textContent =
    "Camera stopped";

  bodyDisplay.textContent =
    "WAIT";

  gestureDisplay.textContent =
    "GESTURE: WAITING";
}


/* =========================
   RESET
========================= */

function resetCounter() {

  skipCount = 0;

  countDisplay.textContent =
    "0";

  frameNumber = 0;

  frameDisplay.textContent =
    "0";

  previous