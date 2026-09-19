const camera = document.getElementById("camera");
const status = document.getElementById("status");

const startBtn = document.getElementById("startBtn");
const backCameraBtn = document.getElementById("backCameraBtn");
const stopBtn = document.getElementById("stopBtn");


/* =========================
   AI
========================= */

let detector = null;

let stream = null;

let running = false;

let processing = false;


/* =========================
   COUNTER
========================= */

let skipCount = 0;

let jumpPhase = "GROUND";

let lastCountTime = 0;


/* =========================
   MOVEMENT HISTORY
========================= */

let hipHistory = [];

let ankleHistory = [];

let verticalHistory = [];

let lastVertical = null;


/* =========================
   SETTINGS
========================= */

const MIN_CONFIDENCE = 0.35;

const SMOOTHING_FRAMES = 5;

const MIN_SKIP_TIME = 280;


/* =====================================================
   LOAD AI
===================================================== */

async function loadAI() {

  try {

    status.textContent =
      "Loading MoveNet AI...";

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

  }

  catch (error) {

    console.error(error);

    status.textContent =
      "❌ AI ERROR: " +
      error.message;

  }

}


/* =====================================================
   STOP CAMERA
===================================================== */

function stopCamera() {

  running = false;

  processing = false;


  if (stream) {

    stream.getTracks().forEach(
      track => track.stop()
    );

    stream = null;

  }


  camera.srcObject = null;

  camera.style.display =
    "none";


  resetTracking();


  status.textContent =
    "Camera stopped";

}


/* =====================================================
   START NORMAL CAMERA
===================================================== */

async function startCamera() {

  try {

    stopCamera();

    status.textContent =
      "Opening camera...";


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


    camera.srcObject =
      stream;

    camera.style.display =
      "block";


    await camera.play();


    running = true;

    processing = false;


    status.textContent =
      "📷 CAMERA + AI WORKING";


    processFrame();

  }

  catch (error) {

    console.error(error);

    status.textContent =
      "❌ CAMERA ERROR: " +
      error.name;

  }

}


/* =====================================================
   START BACK CAMERA
===================================================== */

async function startBackCamera() {

  try {

    stopCamera();

    status.textContent =
      "Opening back camera...";


    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode: {
            ideal: "environment"
          },

          width: {
            ideal: 640
          },

          height: {
            ideal: 480
          }

        },

        audio: false

      });


    camera.srcObject =
      stream;

    camera.style.display =
      "block";


    await camera.play();


    running = true;

    processing = false;


    status.textContent =
      "📷 BACK CAMERA + AI WORKING";


    processFrame();

  }

  catch (error) {

    console.error(error);

    status.textContent =
      "❌ BACK CAMERA ERROR: " +
      error.name;

  }

}


/* =====================================================
   GET GOOD KEYPOINT
===================================================== */

function point(keypoints, index) {

  const p =
    keypoints[index];

  if (!p) {
    return null;
  }

  if (
    p.score < MIN_CONFIDENCE
  ) {

    return null;

  }

  return p;

}


/* =====================================================
   MAIN FRAME PROCESSING
===================================================== */

async function processFrame() {

  if (!running) {
    return;
  }


  /*
    Never run two AI predictions
    simultaneously.
  */

  if (processing) {

    requestAnimationFrame(
      processFrame
    );

    return;

  }


  if (!detector) {

    requestAnimationFrame(
      processFrame
    );

    return;

  }


  processing = true;


  try {

    const poses =
      await detector.estimatePoses(
        camera
      );


    if (
      poses.length > 0
    ) {

      const keypoints =
        poses[0].keypoints;


      detectJump(
        keypoints
      );

    }

  }

  catch (error) {

    console.error(
      "AI ERROR:",
      error
    );

  }


  processing = false;


  if (running) {

    requestAnimationFrame(
      processFrame
    );

  }

}


/* =====================================================
   JUMP / SKIP DETECTION
===================================================== */

function detectJump(keypoints) {

  /*
    MoveNet indexes:

    11 = left hip
    12 = right hip

    15 = left ankle
    16 = right ankle

    5  = left shoulder
    6  = right shoulder
  */


  const leftHip =
    point(keypoints, 11);

  const rightHip =
    point(keypoints, 12);

  const leftAnkle =
    point(keypoints, 15);

  const rightAnkle =
    point(keypoints, 16);

  const leftShoulder =
    point(keypoints, 5);

  const rightShoulder =
    point(keypoints, 6);


  /*
    We need hips + ankles.
  */

  if (
    !leftHip ||
    !rightHip ||
    !leftAnkle ||
    !rightAnkle
  ) {

    return;

  }


  /* =========================
     BODY SCALE
  ========================= */

  let bodyScale = 1;


  if (
    leftShoulder &&
    rightShoulder
  ) {

    const shoulderWidth =
      Math.abs(
        leftShoulder.x -
        rightShoulder.x
      );


    const hipWidth =
      Math.abs(
        leftHip.x -
        rightHip.x
      );


    bodyScale =
      Math.max(
        shoulderWidth,
        hipWidth,
        0.10
      );

  }


  /*
    Normalize movement.

    This makes the detector less
    sensitive to how far the
    person stands from camera.
  */

  const scale =
    Math.max(
      bodyScale,
      0.10
    );


  /* =========================
     HIP POSITION
  ========================= */

  const hipY =
    (
      leftHip.y +
      rightHip.y
    ) / 2;


  /* =========================
     AN