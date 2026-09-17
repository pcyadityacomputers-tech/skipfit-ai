import {
  FilesetResolver,
  PoseLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";


/* =========================
   ELEMENTS
========================= */

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


/* =========================
   MAIN VARIABLES
========================= */

let stream = null;
let facing = "user";

let videoURL = null;

let landmarker = null;
let aiReady = false;

let cameraRunning = false;
let analysing = false;

let lastProcess = 0;
let videoTimestamp = 0;


/* =========================
   SKIP COUNTER
========================= */

let skipCount = 0;

let calibrationFrames = 0;
let calibrationSum = 0;
let calibrationHipY = null;

let jumpState = "GROUND";

let lastSkipTime = 0;

const CALIBRATION_FRAMES = 30;

const UP_THRESHOLD = 0.025;
const DOWN_THRESHOLD = 0.012;

const SKIP_COOLDOWN = 300;


/* =========================
   RESET SKIP SYSTEM
========================= */

function resetSkipSystem() {

  skipCount = 0;

  calibrationFrames = 0;
  calibrationSum = 0;
  calibrationHipY = null;

  jumpState = "GROUND";

  lastSkipTime = 0;

  count.textContent = "0";
}


/* =========================
   BODY DATA
========================= */

function getBodyData(landmarks) {

  if (!landmarks || landmarks.length < 33) {
    return null;
  }


  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];

  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];


  const points = [
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle
  ];


  for (const point of points) {

    if (!point) {
      return null;
    }

    if (
      point.visibility !== undefined &&
      point.visibility < 0.20
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


  return {
    hipY,
    kneeY,
    ankleY,
    shoulderY
  };
}


/* =========================
   CALIBRATION
========================= */

function calibrate(data) {

  if (!data) {
    return false;
  }


  if (
    calibrationFrames <
    CALIBRATION_FRAMES
  ) {

    calibrationSum += data.hipY;

    calibrationFrames++;


    const percent =
      Math.round(
        calibrationFrames /
        CALIBRATION_FRAMES *
        100
      );


    stage.textContent =
      "CALIBRATING " +
      percent +
      "%";


    status.textContent =
      "Stand still for calibration";


    if (
      calibrationFrames ===
      CALIBRATION_FRAMES
    ) {

      calibrationHipY =
        calibrationSum /
        CALIBRATION_FRAMES;


      stage.textContent =
        "READY — START SKIPPING";


      status.textContent =
        "✅ AI READY FOR SKIPPING";
    }


    return true;
  }


  return false;
}


/* =========================
   SKIP DETECTION
========================= */

function detectSkip(data) {

  if (!data) {
    return;
  }


  if (calibrationHipY === null) {
    return;
  }


  const now =
    performance.now();


  /*
    In video coordinates:

    Smaller Y = body moves upward
    Larger Y = body moves downward
  */

  const upward =
    calibrationHipY -
    data.hipY;


  const downward =
    data.hipY -
    calibrationHipY;


  /* =====================
     GOING UP
  ===================== */

  if (
    jumpState === "GROUND" &&
    upward > UP_THRESHOLD
  ) {

    jumpState = "AIR";

    stage.textContent =
      "AIRBORNE";
  }


  /* =====================
     COMING DOWN
  ===================== */

  if (
    jumpState === "AIR" &&
    downward > DOWN_THRESHOLD
  ) {

    if (
      now - lastSkipTime >
      SKIP_COOLDOWN
    ) {

      skipCount++;

      count.textContent =
        skipCount;


      lastSkipTime =
        now;


      stage.textContent =
        "SKIP " +
        skipCount;


      status.textContent =
        "🔥 SKIP DETECTED";
    }


    jumpState =
      "GROUND";
  }
}


/* =========================
   DRAW POSE
========================= */

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

    stage.textContent =
      aiReady
        ? "BODY NOT FOUND"
        : "AI LOADING";

    return;
  }


  const landmarks =
    result.landmarks[0];


  ctx.fillStyle =
    "#00ff88";


  for (const point of landmarks) {

    if (
      point.visibility !== undefined &&
      point.visibility < 0.20
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


/* =========================
   PROCESS POSE
========================= */

function processPose(result) {

  drawPose(result);


  if (
    !result ||
    !result.landmarks ||
    result.landmarks.length === 0
  ) {
    return;
  }


  const landmarks =
    result.landmarks[0];


  const body =
    getBodyData(landmarks);


  if (!body) {

    stage.textContent =
      "BODY PARTLY LOST";

    return;
  }


  if (
    calibrationFrames <
    CALIBRATION_FRAMES
  ) {

    calibrate(body);

    return;
  }


  detectSkip(body);
}


/* =========================
   LOAD AI
========================= */

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
            0.35,


          minPosePresenceConfidence:
            0.35,


          minTrackingConfidence:
            0.35
        }
      );


    aiReady = true;


    aiState.textContent =
      "AI ✓";


    status.textContent =
      "✅ AI READY";


    console.log(
      "SkipFit AI loaded"
    );

  }

  catch (error) {

    console.error(
      "AI ERROR:",
      error
    );


    aiReady = false;


    aiState.textContent =
      "AI ✕";


    status.textContent =
      "❌ AI FAILED TO LOAD";
  }
}


/* =========================
   CANVAS SIZE
========================= */

function resizeCanvas() {

  if (
    camera.videoWidth &&
    camera.videoHeight
  ) {

    canvas.width =
      camera.videoWidth;

    canvas.height =
      camera.videoHeight;

    return;
  }


  if (
    videoPlayer.videoWidth &&
    videoPlayer.videoHeight
  ) {

    canvas.width =
      videoPlayer.videoWidth;

    canvas.height =
      videoPlayer.videoHeight;
  }
}


/* =========================
   START CAMERA
========================= */

startCamera.onclick =
  async function () {

    try {

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {

        status.textContent =
          "❌ Camera API unavailable";

        return;
      }


      if (stream) {

        stream.getTracks().forEach(
          track => track.stop()
        );

        stream = null;
      }


      resetSkipSystem();


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


      stage.textContent =
        "CAMERA ACTIVE";


      status.textContent =
        "📷 CAMERA WORKING";


      resizeCanvas();


      cameraLoop();

    }

    catch (error) {

      console.error(
        "CAMERA ERROR:",
        error
      );


      status.textContent =
        "❌ CAMERA ERROR: " +
        error.name;


      stage.textContent =
        "CAMERA FAILED";
    }
  };


/* =========================
   CAMERA LOOP
========================= */

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


  if (camera.readyState < 2) {
    return;
  }


  const now =
    performance.now();


  if (
    now - lastProcess <
    80
  ) {
    return;
  }


  lastProcess =
    now;


  try {

    resizeCanvas();


    const result =
      landmarker.detectForVideo(
        camera,
        now
      );


    processPose(result);

  }

  catch (error) {

    console.error(
      "CAMERA AI ERROR:",
      error
    );
  }
}


/* =========================
   SWITCH CAMERA
========================= */

switchCamera.onclick =
  async function () {

    facing =
      facing === "user"
        ? "environment"
        : "user";


    if (stream) {

      stream.getTracks().forEach(
        track => track.stop()
      );

      stream = null;
    }


    cameraRunning =
      false;


    startCamera.disabled =
      false;


    switchCamera.disabled =
      true;


    stopCamera.disabled =
      true;


    await startCamera.click();
  };


/* =========================
   STOP CAMERA
========================= */

stopCamera.onclick =
  function () {

    cameraRunning =
      false;


    if (stream) {

      stream.getTracks().forEach(
        track => track.stop()
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


    resetSkipSystem();


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


/* =========================
   VIDEO SELECT
========================= */

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
        track => track.stop()
      );

      stream = null;
    }


    camera.srcObject =
      null;


    resetSkipSystem();


    videoState.textContent =
      "VIDEO ✓";


    analyzeVideo.disabled =
      false;


    startCamera.disabled =
      false;


    switchCamera.disabled =
      true;


    stopCamera.disabled =
      true;


    progress.value =
      0;


    stage.textContent =
      "VIDEO READY";


    status.textContent =
      "✅ VIDEO SELECTED";


    videoPlayer.onloadedmetadata =
      function () {

        resizeCanvas();
      };


    console.log(
      "Video:",
      file.name
    );
  };


/* =========================
   SEEK VIDEO
========================= */

function seekVideo(time) {

  return new Promise(
    resolve => {

      const target =
        Math.max(
          0,
          Math.min(
            time,
            videoPlayer.duration
          )
        );


      if (
        Math.abs(
          videoPlayer.currentTime -
          target
        ) < 0.001
      ) {

        resolve();

        return;
      }


      const onSeeked =
        function () {

          videoPlayer.removeEventListener(
            "seeked",
            onSeeked
          );


          resolve();
        };


      videoPlayer.addEventListener(
        "seeked",
        onSeeked
      );


      videoPlayer.currentTime =
        target;
    }
  );
}


/* =========================
   ANALYZE VIDEO
========================= */

analyzeVideo.onclick =
  async function () {

    if (!videoURL) {
      return;
    }


    if (analysing) {
      return;
    }


    if (!aiReady) {

      status.textContent =
        "❌ AI is not ready";

      return;
    }


    analysing =
      true;


    analyzeVideo.disabled =
      true;


    startCamera.disabled =
      true;


    resetSkipSystem();


    status.textContent =
      "🧠 ANALYZING VIDEO...";


    stage.textContent =
      "PREPARING";


    try {

      if (
        videoPlayer.readyState < 1
      ) {

        await new Promise(
          resolve => {

            videoPlayer.addEventListener(
              "loadedmetadata",
              resolve,
              {
                once: true
              }
            );
          }
        );
      }


      const duration =
        videoPlayer.duration;


      if (
        !duration ||
        !isFinite(duration)
      ) {

        throw new Error(
          "Video duration unavailable"
        );
      }


      const fps =
        12;


      const step =
        1 / fps;


      const total =
        Math.ceil(
          duration * fps
        );


      let frame =
        0;


      videoTimestamp =
        0;


      videoPlayer.pause();


      resizeCanvas();


      for (
        let time = 0;
        time < duration;
        time += step
      ) {

        await seekVideo(time);


        videoTimestamp +=
          1000 / fps;


        const result =
          landmarker.detectForVideo(
            videoPlayer,
            videoTimestamp
          );


        processPose(result);


        frame++;


        progress.value =
          Math.min(
            100,
            Math.round(
              frame /
              total *
              100
            )
          );


        if (
          frame % 8 === 0
        ) {

          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                0
              )
          );
        }
      }


      videoPlayer.pause();


      progress.value =
        100;


      stage.textContent =
        "✓ VIDEO ANALYZED";


      status.textContent =
        "✅ Analysis complete: " +
        skipCount +
        " skips";


    }

    catch (error) {

      console.error(
        "VIDEO ANALYSIS ERROR:",
        error
      );


      status.textContent =
        "❌ VIDEO ERROR";


      stage.textContent =
        error.message ||
        "Analysis failed";
    }


    finally {

      analysing =
        false;


      analyzeVideo.disabled =
        false;


      startCamera.disabled =
        false;
    }
  };


/* =========================
   START
========================= */

resetSkipSystem();

loadAI();