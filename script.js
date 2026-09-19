/* =====================================================
   SKIPFIT AI
   MoveNet Body Detection + Camera + Gestures + Counting
===================================================== */


/* =========================
   ELEMENTS
========================= */

const camera =
  document.getElementById("camera");

const overlay =
  document.getElementById("overlay");

const ctx =
  overlay.getContext("2d");

const status =
  document.getElementById("status");

const startBtn =
  document.getElementById("startBtn");

const backCameraBtn =
  document.getElementById("backCameraBtn");

const stopBtn =
  document.getElementById("stopBtn");

const resetBtn =
  document.getElementById("resetBtn");

const frameDisplay =
  document.getElementById("frame");

const fpsDisplay =
  document.getElementById("fps");

const bodyDisplay =
  document.getElementById("body");

const gestureDisplay =
  document.getElementById("gesture");

const countDisplay =
  document.getElementById("count");


/* =========================
   VARIABLES
========================= */

let stream = null;

let detector = null;

let running = false;

let processing = false;

let frameNumber = 0;

let fpsFrames = 0;

let fpsTime = performance.now();

let skipCount = 0;

let lastSkipTime = 0;


/* =========================
   MOVEMENT VARIABLES
========================= */

let previousHipY = null;

let previousAnkleY = null;

let movementHistory = [];

let jumpState = "GROUND";


/* =========================
   CAMERA VARIABLES
========================= */

let currentCameraId = null;


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
      "❌ AI ERROR: " + error.message;

  }

}


/* =====================================================
   STOP CURRENT CAMERA STREAM
===================================================== */

function stopCurrentStream() {

  running = false;

  processing = false;

  if (stream) {

    stream.getTracks().forEach(
      track => track.stop()
    );

    stream = null;

  }

  camera.srcObject = null;

}


/* =====================================================
   START CAMERA
===================================================== */

async function startCamera(deviceId = null) {

  try {

    status.textContent =
      "Opening camera...";

    stopCurrentStream();

    let constraints;


    /* Specific camera */

    if (deviceId) {

      constraints = {

        video: {

          deviceId: {
            exact: deviceId
          },

          width: {
            ideal: 640
          },

          height: {
            ideal: 480
          }

        },

        audio: false

      };

    }


    /* Normal camera */

    else {

      constraints = {

        video: {

          width: {
            ideal: 640
          },

          height: {
            ideal: 480
          }

        },

        audio: false

      };

    }


    stream =
      await navigator.mediaDevices
        .getUserMedia(constraints);


    camera.srcObject =
      stream;

    camera.style.display =
      "block";


    await new Promise(resolve => {

      if (
        camera.readyState >= 2 &&
        camera.videoWidth > 0
      ) {

        resolve();

      }

      else {

        camera.onloadedmetadata =
          () => resolve();

      }

    });


    await camera.play();


    overlay.width =
      camera.videoWidth;

    overlay.height =
      camera.videoHeight;


    currentCameraId =
      deviceId;


    /* Reset tracking */

    previousHipY = null;

    previousAnkleY = null;

    movementHistory = [];

    jumpState = "GROUND";


    frameNumber = 0;

    fpsFrames = 0;

    fpsTime = performance.now();


    running = true;

    processing = false;


    status.textContent =
      "📷 CAMERA WORKING";

    bodyDisplay.textContent =
      "WAIT";

    gestureDisplay.textContent =
      "GESTURE: DETECTING";


    detectFrame();

  }

  catch (error) {

    console.error(
      "CAMERA ERROR:",
      error
    );

    status.textContent =
      "❌ CAMERA ERROR: " +
      error.name;

    gestureDisplay.textContent =
      error.message ||
      "Camera failed";

  }

}


/* =====================================================
   FIND BACK CAMERA
===================================================== */

async function findBackCamera() {

  try {

    status.textContent =
      "Finding back camera...";


    /*
      Ask for permission first.

      This makes camera labels
      available on many phones.
    */

    const temporaryStream =
      await navigator.mediaDevices
        .getUserMedia({

          video: true,

          audio: false

        });


    temporaryStream
      .getTracks()
      .forEach(track => track.stop());


    const devices =
      await navigator.mediaDevices
        .enumerateDevices();


    const videoDevices =
      devices.filter(
        device =>
          device.kind === "videoinput"
      );


    console.log(
      "Available cameras:",
      videoDevices
    );


    /*
      Search camera names for
      back / rear / environment
    */

    let backCamera =
      videoDevices.find(device => {

        const label =
          device.label.toLowerCase();

        return (
          label.includes("back") ||
          label.includes("rear") ||
          label.includes("environment")
        );

      });


    if (backCamera) {

      status.textContent =
        "📷 Back camera found";

      await startCamera(
        backCamera.deviceId
      );

      return;

    }


    /*
      If the browser does not expose
      camera labels, try environment mode.
    */

    status.textContent =
      "Trying rear camera...";


    stopCurrentStream();


    try {

      stream =
        await navigator.mediaDevices
          .getUserMedia({

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


      await new Promise(resolve => {

        if (
          camera.readyState >= 2 &&
          camera.videoWidth > 0
        ) {

          resolve();

        }

        else {

          camera.onloadedmetadata =
            () => resolve();

        }

      });


      await camera.play();


      overlay.width =
        camera.videoWidth;

      overlay.height =
        camera.videoHeight;


      running = true;

      processing = false;


      status.textContent =
        "📷 REAR CAMERA WORKING";

      bodyDisplay.textContent =
        "WAIT";

      gestureDisplay.textContent =
        "GESTURE: DETECTING";


      detectFrame();

    }

    catch (error) {

      console.error(error);

      status.textContent =
        "❌ BACK CAMERA NOT FOUND";

      gestureDisplay.textContent =
        "Use START CAMERA instead.";

    }

  }

  catch (error) {

    console.error(error);

    status.textContent =
      "❌ CAMERA ERROR: " +
      error.name;

    gestureDisplay.textContent =
      error.message ||
      "Camera permission failed";

  }

}


/* =====================================================
   FRAME-BY-FRAME AI PROCESSING
===================================================== */

async function detectFrame() {

  if (!running) {
    return;
  }


  /*
    Prevent multiple AI predictions
    from running at the same time.
  */

  if (processing) {

    requestAnimationFrame(
      detectFrame
    );

    return;

  }


  processing = true;


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

    if (
      detector &&
      camera.readyState >= 2
    ) {

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

      }

      else {

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

    }

  }

  catch (error) {

    console.error(
      "FRAME ERROR:",
      error
    );

  }


  processing = false;


  if (running) {

    requestAnimationFrame(
      detectFrame
    );

  }

}


/* =====================================================
   DRAW BODY KEYPOINTS
===================================================== */

function drawKeypoints(
  keypoints
) {

  for (
    const point of keypoints
  ) {

    if (
      point.score < 0.35
    ) {

      continue;

    }


    const x =
      point.x *
      overlay.width /
      camera.videoWidth;


    const y =
      point.y *
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


/* =====================================================
   GET KEYPOINT
===================================================== */

function getPoint(
  keypoints,
  index
) {

  const point =
    keypoints[index];


  if (
    !point ||
    point.score < 0.35
  ) {

    return null;

  }


  return point;

}


/* =====================================================
   GESTURE DETECTION
===================================================== */

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


  /* HANDS UP */

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


  /* ARMS OUT */

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


  /* NORMAL */

  gestureDisplay.textContent =
    "🧍 NORMAL";

}


/* =====================================================
   SKIP DETECTION
===================================================== */

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


  /*
    Average hip position
  */

  const hipY =
    (
      leftHip.y +
      rightHip.y
    ) / 2;


  /*
    Average ankle position
  */

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
      hipMovement * 0.60 +
      ankleMovement * 0.40;

  }


  previousHipY =
    hipY;

  previousAnkleY =
    ankleY;


  /*
    Store recent movement
    for smoother detection.
  */

  movementHistory.push(
    movement
  );


  if (
    movementHistory.length > 5
  ) {

    movementHistory.shift();

  }


  let averageMovement = 0;


  for (
    const value of movementHistory
  ) {

    averageMovement +=
      value;

  }


  if (
    movementHistory.length > 0
  ) {

    averageMovement /=
      movementHistory.length;

  }


  const now =
    performance.now();


  /*
    GOING UP
  */

  if (

    jumpState === "GROUND" &&

    averageMovement > 0.006

  ) {

    jumpState =
      "AIR";

  }


  /*
    COMING DOWN
  */

  if (

    jumpState === "AIR" &&

    averageMovement < -0.006

  ) {

    /*
      Minimum time between skips.
      Prevents multiple counts
      from one jump.
    */

    if (
      now - lastSkipTime > 250
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


/* =====================================================
   STOP CAMERA BUTTON
===================================================== */

function stopCamera() {

  stopCurrentStream();


  ctx.clearRect(
    0,
    0,
    overlay.width,
    overlay.height
  );


  camera.style.display =
    "none";


  status.textContent =
    "Camera stopped";


  bodyDisplay.textContent =
    "WAIT";


  gestureDisplay.textContent =
    "GESTURE: WAITING";

}


/* =====================================================
   RESET COUNTER
===================================================== */

function resetCounter() {

  skipCount = 0;

  countDisplay.textContent =
    "0";


  frameNumber = 0;

  frameDisplay.textContent =
    "0";


  previousHipY = null;

  previousAnkleY = null;

  movementHistory = [];

  jumpState =
    "GROUND";


  lastSkipTime = 0;


  gestureDisplay.textContent =
    "GESTURE: WAITING";

}


/* =====================================================
   BUTTONS
===================================================== */

startBtn.onclick =
  () => startCamera();


backCameraBtn.onclick =
  () => findBackCamera();


stopBtn.onclick =
  () => stopCamera();


resetBtn.onclick =
  () => resetCounter();


/* =====================================================
   START AI
===================================================== */

loadAI();