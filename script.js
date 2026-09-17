import {
  FilesetResolver,
  PoseLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";


/* =====================================================
   ELEMENTS
===================================================== */

const camera = document.getElementById("camera");
const videoPlayer = document.getElementById("videoFilePlayer");
const videoInput = document.getElementById("videoInput");

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const status = document.getElementById("status");
const stage = document.getElementById("stage");
const count = document.getElementById("count");
const progress = document.getElementById("progress");

const startCamera = document.getElementById("startCamera");
const switchCamera = document.getElementById("switchCamera");
const stopCamera = document.getElementById("stopCamera");
const analyzeVideo = document.getElementById("analyzeVideo");

const cameraState = document.getElementById("cameraState");
const videoState = document.getElementById("videoState");
const aiState = document.getElementById("aiState");


/* =====================================================
   AI
===================================================== */

let landmarker = null;
let aiReady = false;


/* =====================================================
   CAMERA
===================================================== */

let stream = null;
let facing = "user";
let cameraRunning = false;


/* =====================================================
   VIDEO
===================================================== */

let videoURL = null;
let analysing = false;


/* =====================================================
   COUNTER
===================================================== */

let skipCount = 0;

let calibrationFrames = 0;
let calibrationHipY = 0;
let calibrationAnkleY = 0;
let calibrationKneeY = 0;

let hipSamples = [];
let ankleSamples = [];

let state = "GROUND";

let lastJumpTime = 0;
let lastPeakTime = 0;

let previousHipY = null;
let previousAnkleY = null;

let upwardSpeed = 0;
let downwardSpeed = 0;

let jumpPeak = 0;

let bodyScale = 0.2;


/* =====================================================
   SETTINGS
===================================================== */

const CALIBRATION_FRAMES = 45;

/*
   These values are deliberately smaller than
   the old version so small jumps are detected.
*/

const MIN_UP_MOVEMENT = 0.012;
const MIN_DOWN_MOVEMENT = 0.008;

const MIN_JUMP_DISTANCE = 0.018;

const MIN_TIME_BETWEEN_SKIPS = 180;


/* =====================================================
   RESET
===================================================== */

function resetCounter() {

  skipCount = 0;

  calibrationFrames = 0;

  calibrationHipY = 0;
  calibrationAnkleY = 0;
  calibrationKneeY = 0;

  hipSamples = [];
  ankleSamples = [];

  state = "GROUND";

  lastJumpTime = 0;
  lastPeakTime = 0;

  previousHipY = null;
  previousAnkleY = null;

  upwardSpeed = 0;
  downwardSpeed = 0;

  jumpPeak = 0;

  count.textContent = "0";

  progress.value = 0;
}


/* =====================================================
   GET BODY DATA
===================================================== */

function getBodyData(landmarks) {

  if (!landmarks || landmarks.length < 33) {
    return null;
  }

  const nose = landmarks[0];

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];

  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  const required = [
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle
  ];

  for (const p of required) {

    if (!p) {
      return null;
    }

    if (
      p.visibility !== undefined &&
      p.visibility < 0.15
    ) {
      return null;
    }
  }


  const hipY =
    (leftHip.y + rightHip.y) / 2;

  const kneeY =
    (leftKnee.y + rightKnee.y) / 2;

  const ankleY =
    (leftAnkle.y + rightAnkle.y) / 2;

  const shoulderY =
    (leftShoulder.y + rightShoulder.y) / 2;


  /*
     Body scale makes the detector adaptive.

     A tall person and a short person will
     therefore not need exactly the same threshold.
  */

  const bodyHeight =
    Math.abs(
      ((leftShoulder.y + rightShoulder.y) / 2) -
      ((leftAnkle.y + rightAnkle.y) / 2)
    );


  return {
    noseY: nose ? nose.y : hipY,

    hipY,
    kneeY,
    ankleY,
    shoulderY,

    bodyHeight
  };
}


/* =====================================================
   CALIBRATION
===================================================== */

function calibrate(data) {

  if (!data) {
    return true;
  }


  calibrationFrames++;

  hipSamples.push(data.hipY);
  ankleSamples.push(data.ankleY);


  if (hipSamples.length > CALIBRATION_FRAMES) {
    hipSamples.shift();
  }

  if (ankleSamples.length > CALIBRATION_FRAMES) {
    ankleSamples.shift();
  }


  const percent =
    Math.round(
      calibrationFrames /
      CALIBRATION_FRAMES *
      100
    );


  stage.textContent =
    "CALIBRATING " +
    Math.min(percent, 100) +
    "%";


  status.textContent =
    "Stand normally for calibration";


  if (
    calibrationFrames >=
    CALIBRATION_FRAMES
  ) {

    calibrationHipY =
      average(hipSamples);

    calibrationAnkleY =
      average(ankleSamples);

    calibrationKneeY =
      data.kneeY;

    bodyScale =
      Math.max(
        data.bodyHeight,
        0.15
      );


    state = "GROUND";


    previousHipY =
      data.hipY;

    previousAnkleY =
      data.ankleY;


    stage.textContent =
      "READY — START SKIPPING";

    status.textContent =
      "🔥 AI READY";


    return false;
  }


  return true;
}


/* =====================================================
   AVERAGE
===================================================== */

function average(array) {

  if (!array.length) {
    return 0;
  }

  let total = 0;

  for (const value of array) {
    total += value;
  }

  return total / array.length;
}


/* =====================================================
   SMOOTH VALUE
===================================================== */

function smooth(previous, current, amount = 0.65) {

  if (previous === null) {
    return current;
  }

  return (
    previous * amount +
    current * (1 - amount)
  );
}


/* =====================================================
   IMPROVED SKIP DETECTION
===================================================== */

function detectSkip(data) {

  if (!data) {
    return;
  }


  if (
    calibrationFrames <
    CALIBRATION_FRAMES
  ) {
    return;
  }


  const now =
    performance.now();


  /*
     Smooth the body movement.

     This removes some MediaPipe frame-to-frame
     shaking while keeping real jumps.
  */

  const hipY =
    smooth(
      previousHipY,
      data.hipY,
      0.55
    );

  const ankleY =
    smooth(
      previousAnkleY,
      data.ankleY,
      0.55
    );


  const hipMovement =
    previousHipY === null
      ? 0
      : previousHipY - hipY;


  const ankleMovement =
    previousAnkleY === null
      ? 0
      : previousAnkleY - ankleY;


  /*
     Positive movement means upward.

     Negative movement means downward.
  */

  upwardSpeed =
    hipMovement;


  downwardSpeed =
    -hipMovement;


  previousHipY =
    hipY;

  previousAnkleY =
    ankleY;


  /*
     Adaptive threshold.

     Bigger body = slightly larger threshold.
  */

  const scaleFactor =
    Math.max(
      0.7,
      Math.min(
        1.5,
        bodyScale / 0.45
      )
    );


  const upThreshold =
    MIN_UP_MOVEMENT *
    scaleFactor;


  const downThreshold =
    MIN_DOWN_MOVEMENT *
    scaleFactor;


  /*
     How far the person has moved upward
     from calibration position.
  */

  const upwardDistance =
    calibrationHipY -
    hipY;


  /*
     =================================================
     GROUND → AIR
     =================================================
  */

  if (
    state === "GROUND" &&
    (
      upwardDistance >
      MIN_JUMP_DISTANCE * scaleFactor
      ||
      upwardSpeed >
      upThreshold
    )
  ) {

    state = "AIR";

    jumpPeak =
      upwardDistance;

    stage.textContent =
      "⬆ AIRBORNE";

    return;
  }


  /*
     =================================================
     AIR → PEAK
     =================================================
  */

  if (
    state === "AIR"
  ) {

    if (
      upwardDistance >
      jumpPeak
    ) {

      jumpPeak =
        upwardDistance;
    }


    /*
       When upward motion slows,
       we reached the jump peak.
    */

    if (
      upwardSpeed <
      upThreshold * 0.25
    ) {

      state =
        "PEAK";

      stage.textContent =
        "⬆ PEAK";
    }

    return;
  }


  /*
     =================================================
     PEAK → GROUND
     =================================================
  */

  if (
    state === "PEAK"
  ) {

    /*
       Downward motion OR returning toward
       starting height.
    */

    const returnedDown =
      downwardSpeed >
      downThreshold;

    const nearGround =
      upwardDistance <
      jumpPeak * 0.45;


    if (
      returnedDown &&
      nearGround
    ) {

      /*
         Prevent duplicate counting.
      */

      if (
        now -
        lastJumpTime >
        MIN_TIME_BETWEEN_SKIPS
      ) {

        /*
           Require a meaningful jump.

           This prevents tiny body movements
           from becoming skips.
        */

        if (
          jumpPeak >
          MIN_JUMP_DISTANCE *
          scaleFactor
        ) {

          skipCount++;

          count.textContent =
            skipCount;


          lastJumpTime =
            now;


          stage.textContent =
            "🔥 SKIP " +
            skipCount;

          status.textContent =
            "SKIP DETECTED";
        }
      }


      state =
        "GROUND";

      jumpPeak =
        0;
    }
  }
}


/* =====================================================
   DRAW POSE
===================================================== */

function drawPose(result) {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  if (
    !result ||
    !result.landmarks ||
    result.landmarks.length === 0
  ) {
    return;
  }


  const points =
    result.landmarks[0];


  /*
     Connections
  */

  const connections = [

    [11, 12],

    [11, 13],
    [13, 15],

    [12, 14],
    [14, 16],

    [11, 23],
    [12, 24],

    [23, 24],

    [23, 25],
    [25, 27],

    [24, 26],
    [26, 28]

  ];


  ctx.lineWidth = 3;
  ctx.strokeStyle = "#00ff88";


  for (const [a, b] of connections) {

    const p1 = points[a];
    const p2 = points[b];


    if (!p1 || !p2) {
      continue;
    }


    ctx.beginPath();

    ctx.moveTo(
      p1.x * canvas.width,
      p1.y * canvas.height
    );

    ctx.lineTo(
      p2.x * canvas.width,
      p2.y * canvas.height
    );

    ctx.stroke();
  }


  /*
     Points
  */

  ctx.fillStyle = "#ffffff";


  for (const point of points) {

    if (
      point.visibility !== undefined &&
      point.visibility < 0.15
    ) {
      continue;
    }


    const x =
      point.x *
      canvas.width;

    const y =
      point.y *
      canvas.height;


    ctx.beginPath();

    ctx.arc(
      x,
      y,
      4,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }
}


/* =====================================================
   PROCESS AI
===================================================== */

function processPose(result) {

  drawPose(result);


  if (
    !result ||
    !result.landmarks ||
    result.landmarks.length === 0
  ) {

    stage.textContent =
      "BODY NOT FOUND";

    return;
  }


  const landmarks =
    result.landmarks[0];


  const data =
    getBodyData(
      landmarks
    );


  if (!data) {

    stage.textContent =
      "BODY PARTLY LOST";

    return;
  }


  if (
    calibrationFrames <
    CALIBRATION_FRAMES
  ) {

    calibrate(data);

    return;
  }


  detectSkip(data);
}


/* =====================================================
   LOAD AI
===================================================== */

async function loadAI() {

  try {

    status.textContent =
      "Loading AI...";


    aiState.textContent =
      "AI ...";


    const vision =
      await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
      );


    landmarker =
      await PoseLandmarker.createFromOptions(
        vision,
        {

          baseOptions: {

            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

            delegate: "CPU"
          },


          runningMode:
            "VIDEO",


          numPoses:
            1,


          minPoseDetectionConfidence:
            0.30,


          minPosePresenceConfidence:
            0.30,


          minTrackingConfidence:
            0.30
        }
      );


    aiReady =
      true;


    aiState.textContent =
      "AI ✓";


    status.textContent =
      "✅ AI READY";


    stage.textContent =
      "READY";


  }

  catch (error) {

    console.error(error);


    aiReady =
      false;


    aiState.textContent =
      "AI ✕";


    status.textContent =
      "❌ AI FAILED";


    stage.textContent =
      "CHECK INTERNET";
  }
}


/* =====================================================
   CANVAS SIZE
===================================================== */

function resizeCanvas() {

  const video =
    camera.style.display !== "none"
      ? camera
      : videoPlayer;


  if (
    video.videoWidth &&
    video.videoHeight
  ) {

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;
  }
}


/* =====================================================
   CAMERA START
===================================================== */

startCamera.onclick =
  async function () {

    try {

      if (!navigator.mediaDevices) {

        status.textContent =
          "Camera unavailable";

        return;
      }


      if (stream) {

        stream.getTracks().forEach(
          track =>
            track.stop()
        );
      }


      resetCounter();


      status.textContent =
        "Requesting camera...";


      stream =
        await navigator.mediaDevices.getUserMedia({

          video: {

            facingMode: facing,

            width: {
              ideal: 640
            },

            height: {
              ideal: 480
            },

            frameRate: {
              ideal: 30
            }
          },

          audio: false
        });


      camera.srcObject =
        stream;


      camera.style.display =
        "block";


      videoPlayer.style.display =
        "none";


      await camera.play();


      cameraRunning =
        true;


      cameraState.textContent =
        "CAMERA ✓";


      startCamera.disabled =
        true;

      switchCamera.disabled =
        false;

      stopCamera.disabled =
        false;


      status.textContent =
        "📷 CAMERA WORKING";


      stage.textContent =
        "CALIBRATING";


      resizeCanvas();


      cameraLoop();

    }

    catch (error) {

      console.error(error);


      status.textContent =
        "❌ CAMERA ERROR: " +
        error.name;

      stage.textContent =
        "CAMERA FAILED";
    }
  };


/* =====================================================
   CAMERA LOOP
===================================================== */

let lastProcessTime = 0;


function cameraLoop() {

  if (!cameraRunning) {
    return;
  }


  requestAnimationFrame(
    cameraLoop
  );


  if (!aiReady) {
    return;
  }


  if (
    camera.readyState <
    2
  ) {
    return;
  }


  const now =
    performance.now();


  /*
     About 20–25 AI frames/sec.

     This is faster than the old 12 FPS
     feeling and helps catch quick skips.
  */

  if (
    now -
    lastProcessTime <
    45
  ) {
    return;
  }


  lastProcessTime =
    now;


  resizeCanvas();


  try {

    const result =
      landmarker.detectForVideo(
        camera,
        now
      );


    processPose(result);

  }

  catch (error) {

    console.error(
      "Pose error:",
      error
    );
  }
}


/* =====================================================
   SWITCH CAMERA
===================================================== */

switchCamera.onclick =
  async function () {

    facing =
      facing === "user"
        ? "environment"
        : "user";


    cameraRunning =
      false;


    if (stream) {

      stream.getTracks().forEach(
        track =>
          track.stop()
      );

      stream = null;
    }


    startCamera.disabled =
      false;

    switchCamera.disabled =
      true;

    stopCamera.disabled =
      true;


    startCamera.click();
  };


/* =====================================================
   STOP CAMERA
===================================================== */

stopCamera.onclick =
  function () {

    cameraRunning =
      false;


    if (stream) {

      stream.getTracks().forEach(
        track =>
          track.stop()
      );

      stream = null;
    }


    camera.srcObject =
      null;


    camera.style.display =
      "none";


    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    resetCounter();


    cameraState.textContent =
      "CAMERA ○";


    startCamera.disabled =
      false;

    switchCamera.disabled =
      true;

    stopCamera.disabled =
      true;


    stage.textContent =
      "STOPPED";

    status.textContent =
      "Camera stopped";
  };


/* =====================================================
   VIDEO SELECT
===================================================== */

videoInput.onchange =
  function () {

    const file =
      videoInput.files[0];


    if (!file) {
      return;
    }


    if (videoURL) {

      URL.revokeObjectURL(
        videoURL
      );
    }


    videoURL =
      URL.createObjectURL(file);


    videoPlayer.src =
      videoURL;


    videoPlayer.load();


    videoPlayer.style.display =
      "block";


    camera.style.display =
      "none";


    cameraRunning =
      false;


    if (stream) {

      stream.getTracks().forEach(
        track =>
          track.stop()
      );

      stream = null;
    }


    camera.srcObject =
      null;


    resetCounter();


    videoState.textContent =
      "VIDEO ✓";


    analyzeVideo.disabled =
      false;


    stage.textContent =
      "VIDEO READY";


    status.textContent =
      "✅ VIDEO SELECTED";


    videoPlayer.onloadedmetadata =
      function () {

        resizeCanvas();
      };
  };


/* =====================================================
   SEEK VIDEO
===================================================== */

function seekVideo(time) {

  return new Promise(
    resolve => {

      if (
        Math.abs(
          videoPlayer.currentTime -
          time
        ) < 0.002
      ) {

        resolve();

        return;
      }


      const handler =
        function () {

          videoPlayer.removeEventListener(
            "seeked",
            handler
          );

          resolve();
        };


      videoPlayer.addEventListener(
        "seeked",
        handler
      );


      videoPlayer.currentTime =
        time;
    }
  );
}


/* =====================================================
   ANALYZE VIDEO
===================================================== */

analyzeVideo.onclick =
  async function () {

    if (
      !videoURL ||
      analysing
    ) {
      return;
    }


    if (!aiReady) {

      status.textContent =
        "❌ AI NOT READY";

      return;
    }


    analysing =
      true;


    analyzeVideo.disabled =
      true;

    sta