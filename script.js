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


let detector = null;

let stream = null;

let running = false;

let frameNumber = 0;

let lastTime = performance.now();

let fpsFrames = 0;

let fpsTime = performance.now();

let skipCount = 0;


/*
================================
SKIP DETECTION STATE
================================
*/

let jumpState = "GROUND";

let lastSkipTime = 0;

let previousHipY = null;

let previousAnkleY = null;

const SKIP_COOLDOWN = 300;


/*
================================
LOAD MOVENET
================================
*/

async function loadAI(){

  try{

    status.textContent =
      "Loading MoveNet AI...";

    await tf.ready();

    detector =
      await poseDetection.createDetector(

        poseDetection.SupportedModels.MoveNet,

        {
          modelType:
            poseDetection.movenet.modelType
              .SINGLEPOSE_LIGHTNING
        }

      );


    status.textContent =
      "✅ AI READY — START CAMERA";

  }

  catch(error){

    console.error(error);

    status.textContent =
      "❌ AI ERROR";

  }

}


/*
================================
START BACK CAMERA
================================
*/

async function startCamera(){

  try{

    status.textContent =
      "Opening back camera...";


    stream =
      await navigator.mediaDevices.getUserMedia({

        video:{

          facingMode:{
            ideal:"environment"
          },

          width:{
            ideal:640
          },

          height:{
            ideal:480
          }

        },

        audio:false

      });


    camera.srcObject = stream;

    camera.style.display =
      "block";


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
      "📷 BACK CAMERA WORKING";


    detectFrame();

  }

  catch(error){

    console.error(error);

    status.textContent =
      "❌ CAMERA ERROR: " +
      error.name;

  }

}


/*
================================
FRAME-BY-FRAME LOOP
================================
*/

async function detectFrame(){

  if(!running){

    return;

  }


  const currentTime =
    performance.now();


  frameNumber++;

  frameDisplay.textContent =
    frameNumber;


  /*
  FPS CALCULATION
  */

  fpsFrames++;


  if(
    currentTime - fpsTime >= 1000
  ){

    fpsDisplay.textContent =
      fpsFrames;

    fpsFrames = 0;

    fpsTime =
      currentTime;

  }


  /*
  GET POSE
  */

  try{

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


    if(
      poses.length === 0
    ){

      bodyDisplay.textContent =
        "NO";

      gestureDisplay.textContent =
        "GESTURE: NO BODY";

    }

    else{

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

  catch(error){

    console.error(
      "FRAME ERROR:",
      error
    );

  }


  /*
  PROCESS NEXT FRAME
  */

  requestAnimationFrame(
    detectFrame
  );

}


/*
================================
DRAW BODY KEYPOINTS
================================
*/

function drawKeypoints(
  keypoints
){

  for(
    const point of keypoints
  ){

    if(
      point.score < 0.35
    ){

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


/*
================================
GET IMPORTANT POINT
================================
*/

function point(
  keypoints,
  index
){

  const p =
    keypoints[index];

  if(
    !p ||
    p.score < 0.35
  ){

    return null;

  }

  return p;

}


/*
================================
GESTURE DETECTION
================================

MoveNet indexes:

0 nose
5 left shoulder
6 right shoulder
7 left elbow
8 right elbow
9 left wrist
10 right wrist
11 left hip
12 right hip
13 left knee
14 right knee
15 left ankle
16 right ankle
*/


function detectGesture(
  keypoints
){

  const leftShoulder =
    point(keypoints,5);

  const rightShoulder =
    point(keypoints,6);

  const leftWrist =
    point(keypoints,9);

  const rightWrist =
    point(keypoints,10);

  const leftHip =
    point(keypoints,11);

  const rightHip =
    point(keypoints,12);


  if(
    !leftShoulder ||
    !rightShoulder ||
    !leftWrist ||
    !rightWrist ||
    !leftHip ||
    !rightHip
  ){

    gestureDisplay.textContent =
      "GESTURE: BODY PARTS LOST";

    return;

  }


  const shoulderY =
    (
      leftShoulder.y +
      rightShoulder.y
    ) / 2;


  const hipY =
    (
      leftHip.y +
      rightHip.y
    ) / 2;


  /*
  HANDS ABOVE HEAD
  */

  if(
    leftWrist.y <
      leftShoulder.y - 0.10 &&
    rightWrist.y <
      rightShoulder.y - 0.10
  ){

    gestureDisplay.textContent =
      "🖐️ GESTURE: HANDS UP";

    return;

  }


  /*
  HANDS OUT
  */

  const armDistance =
    Math.abs(
      leftWrist.x -
      rightWrist.x
    );


  if(
    armDistance > 0.45
  ){

    gestureDisplay.textContent =
      "↔️ GESTURE: ARMS OUT";

    return;

  }


  /*
  CROUCH / BEND
  */

  if(
    hipY >
      shoulderY + 0.20
  ){

    gestureDisplay.textContent =
      "⬇️ GESTURE: BEND";

    return;

  }


  gestureDisplay.textContent =
    "🧍 GESTURE: NORMAL";

}


/*
================================
BASIC SKIP DETECTION
================================
*/

function detectSkip(
  keypoints
){

  const leftHip =
    point(keypoints,11);

  const rightHip =
    point(keypoints,12);

  const leftAnkle =
    point(keypoints,15);

  const rightAnkle =
    point(keypoints,16);


  if(
    !leftHip ||
    !rightHip ||
    !leftAnkle ||
    !rightAnkle
  ){

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


  /*
  Vertical movement
  */

  let hipMovement = 0;

  let ankleMovement = 0;


  if(
    previousHipY !== null
  ){

    hipMovement =
      previousHipY -
      hipY;

  }


  if(
    previousAnkleY !== null
  ){

    ankleMovement =
      previousAnkleY -
      ankleY;

  }


  previousHipY =
    hipY;

  previousAnkleY =
    ankleY;


  const movement =
    (
      hipMovement * 0.55
    ) +
    (
      ankleMovement * 0.45
    );


  const now =
    performance.now();


  /*
  GOING UP
  */

  if(
    jumpState === "GROUND" &&
    movement > 0.008
  ){

    jumpState = "AIR";

  }


  /*
  RETURNING DOWN
  */

  if(
    jumpState === "AIR" &&
    movement < -0.008
  ){

    if(
      now - lastSkipTime >
      SKIP_COOLDOWN
    ){

      skipCount++;

      countDisplay.textContent =
        skipCount;

      lastSkipTime =
        now;

      gestureDisplay.textContent =
        "🦘 SKIP DETECTED";

    }


    jumpState =
      "GROUND";

  }

}


/*
================================
STOP CAMERA
================================
*/

function stopCamera(){

  running = false;


  if(stream){

    stream
      .getTracks()
      .forEach(
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


/*
================================
RESET
================================
*/

function resetCounter(){

  skipCount = 0;

  countDisplay.textContent =
    "0";

  frameNumber = 0;

  frameDisplay.textContent =
    "0";

  previousHipY = null;

  previousAnkleY = null;

  jumpState =
    "GROUND";

  lastSkipTime =
    0;

  gestureDisplay.textContent =
    "GESTURE: WAITING";

}


/*
================================
BUTTONS
================================
*/

startBtn.onclick =
  startCamera;

stopBtn.onclick =
  stopCamera;

resetBtn.onclick =
  resetCounter;


/*
================================
START AI
================================
*/

loadAI();