import {
  FilesetResolver,
  PoseLandmarker
} from
"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";


const MODEL =
"https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const WASM =
"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";


/* =========================
   ELEMENTS
========================= */

const statusEl =
document.getElementById("status");

const camera =
document.getElementById("camera");

const fileVideo =
document.getElementById("fileVideo");

const videoFile =
document.getElementById("videoFile");

const analyzeBtn =
document.getElementById("analyzeBtn");

const canvas =
document.getElementById("overlay");

const ctx =
canvas.getContext("2d");

const startBtn =
document.getElementById("startBtn");

const switchBtn =
document.getElementById("switchBtn");

const calibrateBtn =
document.getElementById("calibrateBtn");

const stopBtn =
document.getElementById("stopBtn");

const stageEl =
document.getElementById("stage");

const calibrationEl =
document.getElementById("calibrationCount");

const barFill =
document.getElementById("barFill");

const skipEl =
document.getElementById("skipCount");

const headEl =
document.getElementById("head");

const handsEl =
document.getElementById("hands");

const legsEl =
document.getElementById("legs");

const videoProgress =
document.getElementById("videoProgress");

const progressBar =
document.getElementById("progressBar");

const progressText =
document.getElementById("progressText");


/* =========================
   AI STATE
========================= */

let landmarker = null;

let stream = null;

let running = false;

let calibrating = false;

let confirmed = false;

let cameraFacing = "user";

let animationId = null;

let lastDetection =
0;


/* =========================
   COUNTING STATE
========================= */

let skips = 0;

let calibrationJumps = 0;

let calibrationSamples = [];

let calibratedAmplitude = 0;

let previousSignal = null;

let signalHistory = [];

let jumpState = "GROUND";

let lastJumpTime = 0;


/* =========================
   LOAD AI
========================= */

async function loadAI() {

  try {

    statusEl.textContent =
      "Loading AI engine...";

    stageEl.textContent =
      "AI LOADING";


    const vision =
      await FilesetResolver.forVisionTasks(
        WASM
      );


    statusEl.textContent =
      "Loading body model...";


    landmarker =
      await PoseLandmarker.createFromOptions(
        vision,
        {

          baseOptions: {

            modelAssetPath:
              MODEL,

            delegate:
              "CPU"

          },

          runningMode:
            "VIDEO",

          numPoses:
            1,

          minPoseDetectionConfidence:
            0.5,

          minPosePresenceConfidence:
            0.5,

          minTrackingConfidence:
            0.5

        }
      );


    statusEl.textContent =
      "✅ AI READY";

    stageEl.textContent =
      "READY";


    startBtn.disabled =
      false;

    analyzeBtn.disabled =
      false;


  } catch(error) {

    console.error(error);


    statusEl.textContent =
      "❌ AI ERROR: " +
      error.message;

    stageEl.textContent =
      "AI FAILED";

  }
}


loadAI();


/* =========================
   RESET COUNTER
========================= */

function resetCounter() {

  skips = 0;

  calibrationJumps = 0;

  calibrationSamples = [];

  calibratedAmplitude = 0;

  previousSignal = null;

  signalHistory = [];

  jumpState =
    "GROUND";

  lastJumpTime = 0;


  skipEl.textContent =
    "0";

  calibrationEl.textContent =
    "0 / 5";

  barFill.style.width =
    "0%";
}


/* =========================
   CAMERA
========================= */

async function startCamera() {

  if (!landmarker) {

    statusEl.textContent =
      "AI is still loading.";

    return;
  }


  stopCamera(false);


  try {

    statusEl.textContent =
      "Opening camera...";


    stream =
      await navigator.mediaDevices.getUserMedia({

        video: {

          facingMode:
            cameraFacing,

          width: {
            ideal: 640
          },

          height: {
            ideal: 480
          },

          frameRate: {
            ideal: 24,
            max: 30
          }

        },

        audio:
          false

      });


    camera.srcObject =
      stream;


    camera.style.display =
      "block";

    fileVideo.style.display =
      "none";


    await camera.play();


    running =
      true;


    resetCounter();


    startBtn.disabled =
      true;

    switchBtn.disabled =
      false;

    stopBtn.disabled =
      false;

    calibrateBtn.disabled =
      false;


    stageEl.textContent =
      "BODY DETECTION";


    statusEl.textContent =
      "Camera active — show your full body.";


    resizeCanvas();


    detectCameraLoop();


  } catch(error) {

    console.error(error);


    statusEl.textContent =
      "❌ Camera error: " +
      error.message;

    stageEl.textContent =
      "CAMERA ERROR";

  }
}


/* =========================
   SWITCH CAMERA
========================= */

async function switchCamera() {

  cameraFacing =
    cameraFacing === "user"
      ? "environment"
      : "user";


  await startCamera();
}


/* =========================
   STOP
========================= */

function stopCamera(updateUI = true) {

  running =
    false;


  if(animationId) {

    cancelAnimationFrame(
      animationId
    );

    animationId =
      null;
  }


  if(stream) {

    stream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

    stream =
      null;
  }


  camera.srcObject =
    null;


  if(updateUI) {

    startBtn.disabled =
      false;

    switchBtn.disabled =
      true;

    stopBtn.disabled =
      true;

    calibrateBtn.disabled =
      true;

    stageEl.textContent =
      "STOPPED";

    statusEl.textContent =
      "Camera stopped.";

  }
}


/* =========================
   CANVAS
========================= */

function resizeCanvas() {

  const video =
    camera.style.display !== "none"
      ? camera
      : fileVideo;


  if(
    video.videoWidth > 0 &&
    video.videoHeight > 0
  ) {

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;
  }
}


/* =========================
   VISIBILITY
========================= */

function visible(p) {

  return (

    p &&

    typeof p.x ===
      "number" &&

    typeof p.y ===
      "number" &&

    (
      p.visibility ===
      undefined ||

      p.visibility >
      0.45
    )

  );
}


/* =========================
   BODY STATUS
========================= */

function bodyStatus(p) {

  const head =
    visible(p[0]);


  const hands =
    visible(p[15]) &&
    visible(p[16]);


  const legs =
    visible(p[25]) &&
    visible(p[26]) &&
    visible(p[27]) &&
    visible(p[28]);


  headEl.textContent =
    head
      ? "HEAD ✓"
      : "HEAD ○";


  handsEl.textContent =
    hands
      ? "HANDS ✓"
      : "HANDS ○";


  legsEl.textContent =
    legs
      ? "LEGS ✓"
      : "LEGS ○";


  return {
    head,
    hands,
    legs
  };
}


/* =========================
   MOVEMENT SIGNAL
========================= */

function getSignal(p) {

  if(

    !visible(p[23]) ||
    !visible(p[24]) ||

    !visible(p[25]) ||
    !visible(p[26]) ||

    !visible(p[27]) ||
    !visible(p[28]) ||

    !visible(p[15]) ||
    !visible(p[16]) ||

    !visible(p[0])

  ) {

    return null;
  }


  const ankle =
    (
      p[27].y +
      p[28].y
    ) / 2;


  const hip =
    (
      p[23].y +
      p[24].y
    ) / 2;


  const knee =
    (
      p[25].y +
      p[26].y
    ) / 2;


  const hands =
    (
      p[15].y +
      p[16].y
    ) / 2;


  return {

    body:
      ankle - hip,

    knee:
      knee - hip,

    hands:
      hands,

    head:
      p[0].y

  };
}


/* =========================
   SMOOTH
========================= */

function smooth(arr) {

  if(
    arr.length === 0
  )
    return 0;


  const n =
    Math.min(
      7,
      arr.length
    );


  let sum = 0;


  for(
    let i =
      arr.length - n;

    i <
      arr.length;

    i++
  ) {

    sum +=
      arr[i];
  }


  return sum / n;
}


/* =========================
   SMART JUMP DETECTOR
========================= */

function processSignal(
  signal,
  timestamp
) {

  signalHistory.push(
    signal.body
  );


  if(
    signalHistory.length >
    30
  ) {

    signalHistory.shift();
  }


  if(
    signalHistory.length <
    8
  ) {

    return;
  }


  const current =
    smooth(signalHistory);


  if(
    previousSignal ===
    null
  ) {

    previousSignal =
      current;

    return;
  }


  const velocity =
    current -
    previousSignal;


  const minimumAmplitude =
    calibrating
      ? 0.025
      : Math.max(
          0.025,
          calibratedAmplitude *
          0.35
        );


  const min =
    Math.min(
      ...signalHistory
    );


  const max =
    Math.max(
      ...signalHistory
    );


  const amplitude =
    max - min;


  const goingUp =
    velocity <
    -0.0018;


  const goingDown =
    velocity >
    0.0018;


  /*
    UP phase
  */

  if(

    jumpState ===
      "GROUND" &&

    goingUp &&

    amplitude >
      minimumAmplitude

  ) {

    jumpState =
      "UP";
  }


  /*
    DOWN phase =
    completed jump
  */

  if(

    jumpState ===
      "UP" &&

    goingDown

  ) {

    if(
      timestamp -
      lastJumpTime >
      280
    ) {

      registerJump(
        timestamp
      );
    }


    jumpState =
      "GROUND";
  }


  previousSignal =
    current;
}


/* =========================
   REGISTER JUMP
========================= */

function registerJump(
  timestamp
) {

  lastJumpTime =
    timestamp;


  if(
    calibrating
  ) {

    calibrationSamples.push({

      time:
        timestamp,

      value:
        smooth(
          signalHistory
        )

    });


    calibrationJumps++;


    calibrationEl.textContent =
      calibrationJumps +
      " / 5";


    barFill.style.width =
      (
        calibrationJumps *
        20
      ) + "%";


    stageEl.textContent =
      "CALIBRATING " +
      calibrationJumps +
      " / 5";


    if(
      calibrationJumps >=
      5
    ) {

      finishCalibration();
    }


    return;
  }


  if(
    !confirmed
  )
    return;


  skips++;


  skipEl.textContent =
    skips.toLocaleString();


  stageEl.textContent =
    "SKIPPING • " +
    skips.toLocaleString();
}


/* =========================
   CALIBRATION
========================= */

function finishCalibration() {

  calibrating =
    false;


  const values =
    calibrationSamples.map(
      x => x.value
    );


  if(
    values.length
  ) {

    const max =
      Math.max(
        ...values
      );

    const min =
      Math.min(
        ...values
      );


    calibratedAmplitude =
      Math.max(
        0.04,
        max - min
      );
  }


  confirmed =
    true;


  calibrateBtn.disabled =
    true;


  stageEl.textContent =
    "✓ PATTERN CONFIRMED";


  statusEl.textContent =
    "Calibration complete. AI is counting skips.";
}


/* =========================
   START CALIBRATION
========================= */

function startCalibration() {

  if(
    !running
  )
    return;


  calibrating =
    true;

  confirmed =
    false;


  calibrationJumps =
    0;


  calibrationSamples =
    [];


  previousSignal =
    null;


  signalHistory =
    [];


  jumpState =
    "GROUND";


  calibrationEl.textContent =
    "0 / 5";


  barFill.style.width =
    "0%";


  stageEl.textContent =
    "JUMP 5 TIMES";


  statusEl.textContent =
    "Make five controlled jumps.";
}


/* =========================
   DRAW BODY
========================= */

function drawSkeleton(
  points
) {

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  const links = [

    [11,12],

    [11,13],
    [13,15],

    [12,14],
    [14,16],

    [11,23],
    [12,24],

    [23,24],

    [23,25],
    [25,27],

    [24,26],
    [26,28]

  ];


  ctx.lineWidth =
    3;

  ctx.strokeStyle =
    "#36a9ff";


  for(
    const [a,b]
    of links
  ) {

    if(
      !visible(points[a]) ||
      !visible(points[b])
    )
      continue;


    ctx.beginPath();


    ctx.moveTo(
      points[a].x *
      canvas.width,

      points[a].y *
      canvas.height
    );


    ctx.lineTo(
      points[b].x *
      canvas.width,

      points[b].y *
      canvas.height
    );


    ctx.stroke();
  }


  ctx.fillStyle =
    "#ffffff";


  for(
    const p of points
  ) {

    if(
      !visible(p)
    )
      continue;


    ctx.beginPath();


    ctx.arc(

      p.x *
      canvas.width,

      p.y *
      canvas.height,

      4,

      0,

      Math.PI * 2

    );


    ctx.fill();
  }
}


/* =========================
   CAMERA AI LOOP
========================= */

function detectCameraLoop() {

  if(
    !running
  )
    return;


  const now =
    performance.now();


  if(
    now -
    lastDetection <
    65
  ) {

    animationId =
      requestAnimationFrame(
        detectCameraLoop
      );

    return;
  }


  lastDetection =
    now;


  try {

    resizeCanvas();


    const result =
      landmarker.detectForVideo(
        camera,
        now
      );


    processResult(
      result,
      now
    );


  } catch(error) {

    console.error(
      error
    );

  }


  animationId =
    requestAnimationFrame(
      detectCameraLoop
    );
}


/* =========================
   PROCESS RESULT
========================= */

function processResult(
  result,
  timestamp
) {

  if(

    !result.landmarks ||

    !result.landmarks.length

  ) {

    stageEl.textContent =
      "NO BODY DETECTED";

    return;
  }


  const points =
    result.landmarks[0];


  drawSkeleton(
    points
  );


  const body =
    bodyStatus(
      points
    );


  if(

    !body.head ||
    !body.hands ||
    !body.legs

  ) {

    if(
      !calibrating &&
      !confirmed
    ) {

      stageEl.textContent =
        "FULL BODY REQUIRED";
    }


    return;
  }


  if(
    !calibrating &&
    !confirmed
  ) {

    stageEl.textContent =
      "BODY DETECTED ✓";
  }


  const signal =
    getSignal(
      points
    );


  if(
    signal
  ) {

    processSignal(
      signal,
      timestamp
    );
  }
}


/* =========================
   VIDEO FILE
========================= */

let selectedVideoURL =
  null;


videoFile.addEventListener(
  "change",
  () => {

    const file =
      videoFile.files[0];


    if(!file)
      return;


    if(
      selectedVideoURL
    ) {

      URL.revokeObjectURL(
        selectedVideoURL
      );
    }


    selectedVideoURL =
      URL.createObjectURL(
        file
      );


    fileVideo.src =
      selectedVideoURL;


    fileVideo.style.display =
      "block";

    camera.style.display =
      "none";


    analyzeBtn.disabled =
      false;


    stageEl.textContent =
      "VIDEO READY";


    statusEl.textContent =
      "Video selected. Press ANALYZE VIDEO.";

  }
);


/* =========================
   ANALYZE VIDEO
========================= */

async function analyzeVideo() {

  const file =
    videoFile.files[0];


  if(
    !file ||
    !landmarker
  )
    return;


  stopCamera(
    false
  );


  resetCounter();


  confirmed =
    true;


  calibrating =
    false;


  videoProgress.style.display =
    "block";


  analyzeBtn.disabled =
    true;


  startBtn.disabled =
    true;


  switchBtn.disabled =
    true;


  stopBtn.disabled =
    false;


  fileVideo.style.display =
    "block";


  camera.style.display =
    "none";


  await fileVideo.play();


  resizeCanvas();


  stageEl.textContent =
    "ANALYZING VIDEO";


  statusEl.textContent =
    "AI is processing the video frame-by-frame.";


  const fps =
    15;


  const interval =
    1000 / fps;


  let time =
    0;


  while(
    time <
    fileVideo.duration
  ) {

    fileVideo.currentTime =
      time;


    await waitForSeek();


    const timestamp =
      time * 1000;


    try {

      const result =
        landmarker.detectForVideo(
          fileVideo,
          timestamp
        );


      processResult(
        result,
        timestamp
      );

    } catch(error) {

      console.error(
        error
      );

    }


    const percent =
      (
        time /
        fileVideo.duration
      ) * 100;


    progressBar.value =
      percent;


    progressText.textContent =
      Math.round(
        percent
      ) + "%";


    time +=
      1 / fps;


    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          interval
        )
    );
  }


  fileVideo.pause();


  analyzeBtn.disabled =
    false;


  startBtn.disabled =
    false;


  stopBtn.disabled =
    true;


  videoProgress.style.display =
    "none";


  stageEl.textContent =
    "✓ VIDEO COMPLETE";


  statusEl.textContent =
    "Video analysis finished. Detected skips: " +
    skips.toLocaleString();
}


/* =========================
   WAIT FOR VIDEO SEEK
========================= */

function waitForSeek() {

  return new Promise(
    resolve => {

      if(
        !fileVideo.seeking
      ) {

        resolve();

        return;
      }


      const done =
        () => {

          fileVideo.removeEventListener(
            "seeked",
            done
          );

          resolve();
        };


      fileVideo.addEventListener(
        "seeked",
        done
      );

    }
  );
}


/* =========================
   BUTTON EVENTS
========================= */

startBtn.addEventListener(
  "click",
  startCamera
);


switchBtn.addEventListener(
  "click",
  switchCamera
);


stopBtn.addEventListener(
  "click",
  () =>
    stopCamera(true)
);


calibrateBtn.addEventListener(
  "click",
  startCalibration
);


analyzeBtn.addEventListener(
  "click",
  analyzeVideo
);