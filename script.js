import {
  FilesetResolver,
  PoseLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm";


/* =====================================================
   ELEMENTS
===================================================== */

const camera =
  document.getElementById("camera");

const videoPlayer =
  document.getElementById("videoFilePlayer");

const videoInput =
  document.getElementById("videoInput");

const canvas =
  document.getElementById("canvas");

const ctx =
  canvas.getContext("2d");

const status =
  document.getElementById("status");

const stage =
  document.getElementById("stage");

const count =
  document.getElementById("count");

const progress =
  document.getElementById("progress");

const startCamera =
  document.getElementById("startCamera");

const switchCamera =
  document.getElementById("switchCamera");

const stopCamera =
  document.getElementById("stopCamera");

const analyzeVideo =
  document.getElementById("analyzeVideo");

const cameraState =
  document.getElementById("cameraState");

const videoState =
  document.getElementById("videoState");

const aiState =
  document.getElementById("aiState");


/* =====================================================
   VARIABLES
===================================================== */

let landmarker = null;

let aiReady = false;

let stream = null;

let facing = "user";

let cameraRunning = false;

let analysing = false;

let videoURL = null;

let lastFrameTime = 0;


/* =====================================================
   COUNTER VARIABLES
===================================================== */

let skipCount = 0;

let calibrationFrames = 0;

let calibrationHip = 0;

let calibrationHeight = 0;

let previousHip = null;

let smoothHip = null;

let highestPoint = 0;

let state = "GROUND";

let lastSkipTime = 0;


/* =====================================================
   SETTINGS
===================================================== */

const CALIBRATION_FRAMES = 35;

const MIN_AIR_MOVEMENT = 0.010;

const MIN_SKIP_MOVEMENT = 0.014;

const MIN_TIME_BETWEEN_SKIPS = 170;


/* =====================================================
   RESET
===================================================== */

function resetCounter(){

  skipCount = 0;

  calibrationFrames = 0;

  calibrationHip = 0;

  calibrationHeight = 0;

  previousHip = null;

  smoothHip = null;

  highestPoint = 0;

  state = "GROUND";

  lastSkipTime = 0;

  count.textContent = "0";

}


/* =====================================================
   AVERAGE
===================================================== */

function average(values){

  if(!values.length){
    return 0;
  }

  let total = 0;

  for(const value of values){
    total += value;
  }

  return total / values.length;
}


/* =====================================================
   LOAD AI
===================================================== */

async function loadAI(){

  try{

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

          baseOptions:{

            modelAssetPath:

              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

            delegate:"CPU"

          },

          runningMode:"VIDEO",

          numPoses:1,

          minPoseDetectionConfidence:0.25,

          minPosePresenceConfidence:0.25,

          minTrackingConfidence:0.25

        }

      );


    aiReady = true;

    aiState.textContent =
      "AI ✓";

    status.textContent =
      "✅ AI READY";

    stage.textContent =
      "READY";


  }catch(error){

    console.error(
      "AI ERROR:",
      error
    );

    aiReady = false;

    aiState.textContent =
      "AI ✕";

    status.textContent =
      "❌ AI FAILED TO LOAD";

    stage.textContent =
      "CHECK INTERNET";

  }

}


/* =====================================================
   GET HIP DATA
===================================================== */

function getBodyData(landmarks){

  if(
    !landmarks ||
    landmarks.length < 33
  ){
    return null;
  }


  const leftShoulder =
    landmarks[11];

  const rightShoulder =
    landmarks[12];

  const leftHip =
    landmarks[23];

  const rightHip =
    landmarks[24];

  const leftAnkle =
    landmarks[27];

  const rightAnkle =
    landmarks[28];


  const required = [

    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftAnkle,
    rightAnkle

  ];


  for(const point of required){

    if(!point){
      return null;
    }

    if(
      point.visibility !== undefined &&
      point.visibility < 0.15
    ){
      return null;
    }

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


  const shoulderY =
    (
      leftShoulder.y +
      rightShoulder.y
    ) / 2;


  const height =
    Math.abs(
      ankleY -
      shoulderY
    );


  return {

    hipY:hipY,

    ankleY:ankleY,

    height:height

  };

}


/* =====================================================
   DRAW BODY
===================================================== */

function drawPose(result){

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );


  if(
    !result ||
    !result.landmarks ||
    !result.landmarks.length
  ){
    return;
  }


  const points =
    result.landmarks[0];


  const connections = [

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


  ctx.strokeStyle =
    "#00ff88";

  ctx.lineWidth = 3;


  for(
    const pair of connections
  ){

    const a =
      points[pair[0]];

    const b =
      points[pair[1]];


    if(!a || !b){
      continue;
    }


    ctx.beginPath();

    ctx.moveTo(
      a.x * canvas.width,
      a.y * canvas.height
    );

    ctx.lineTo(
      b.x * canvas.width,
      b.y * canvas.height
    );

    ctx.stroke();

  }


  ctx.fillStyle =
    "#ffffff";


  for(const point of points){

    if(
      point.visibility !== undefined &&
      point.visibility < 0.15
    ){
      continue;
    }


    ctx.beginPath();

    ctx.arc(

      point.x * canvas.width,

      point.y * canvas.height,

      4,

      0,

      Math.PI * 2

    );

    ctx.fill();

  }

}


/* =====================================================
   CALIBRATION
===================================================== */

function calibrate(data){

  calibrationFrames++;

  calibrationHip +=
    data.hipY;

  calibrationHeight +=
    data.height;


  const percent =
    Math.round(
      calibrationFrames /
      CALIBRATION_FRAMES *
      100
    );


  stage.textContent =
    "CALIBRATING " +
    Math.min(percent,100) +
    "%";


  status.textContent =
    "Stand still";


  if(
    calibrationFrames >=
    CALIBRATION_FRAMES
  ){

    calibrationHip =
      calibrationHip /
      calibrationFrames;

    calibrationHeight =
      calibrationHeight /
      calibrationFrames;


    previousHip =
      calibrationHip;

    smoothHip =
      calibrationHip;


    state =
      "GROUND";


    stage.textContent =
      "READY — START SKIPPING";

    status.textContent =
      "🔥 AI READY";

  }

}


/* =====================================================
   DETECT SKIP
===================================================== */

function detectSkip(data){

  if(
    calibrationFrames <
    CALIBRATION_FRAMES
  ){
    return;
  }


  /*
     Smooth the hip position.
  */

  smoothHip =
    smoothHip * 0.55 +
    data.hipY * 0.45;


  const movement =
    calibrationHip -
    smoothHip;


  /*
     Positive movement =
     person is moving upward.
  */


  if(
    state === "GROUND"
  ){

    if(
      movement >
      MIN_AIR_MOVEMENT
    ){

      state =
        "AIR";

      highestPoint =
        movement;


      stage.textContent =
        "⬆ AIRBORNE";

    }

  }


  /*
     AIR PHASE
  */

  else if(
    state === "AIR"
  ){

    if(
      movement >
      highestPoint
    ){

      highestPoint =
        movement;

    }


    /*
       Once movement starts
       decreasing, the person
       is coming down.
    */

    if(
      movement <
      highestPoint -
      0.003
    ){

      state =
        "DOWN";

      stage.textContent =
        "⬇ LANDING";

    }

  }


  /*
     LANDING
  */

  else if(
    state === "DOWN"
  ){

    const now =
      performance.now();


    if(
      highestPoint >
      MIN_SKIP_MOVEMENT &&

      now -
      lastSkipTime >
      MIN_TIME_BETWEEN_SKIPS
    ){

      skipCount++;

      count.textContent =
        skipCount;


      lastSkipTime =
        now;


      stage.textContent =
        "🔥 SKIP " +
        skipCount;

    }


    /*
       Reset after landing.
    */

    if(
      movement <
      highestPoint * 0.45
    ){

      state =
        "GROUND";

      highestPoint =
        0;

    }

  }

}


/* =====================================================
   PROCESS POSE
===================================================== */

function processPose(result){

  drawPose(result);


  if(
    !result ||
    !result.landmarks ||
    !result.landmarks.length
  ){

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


  if(!data){

    stage.textContent =
      "BODY PARTLY LOST";

    return;

  }


  if(
    calibrationFrames <
    CALIBRATION_FRAMES
  ){

    calibrate(data);

    return;

  }


  detectSkip(data);

}


/* =====================================================
   RESIZE
===================================================== */

function resizeCanvas(){

  if(
    camera.videoWidth &&
    camera.videoHeight
  ){

    canvas.width =
      camera.videoWidth;

    canvas.height =
      camera.videoHeight;

  }

}


/* =====================================================
   START CAMERA
===================================================== */

startCamera.onclick =
async function(){

  try{

    if(
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ){

      status.textContent =
        "❌ Camera unavailable";

      return;

    }


    if(stream){

      stream.getTracks().forEach(
        track => track.stop()
      );

      stream = null;

    }


    resetCounter();


    status.textContent =
      "Requesting camera...";


    stream =
      await navigator.mediaDevices.getUserMedia({

        video:{

          facingMode:facing,

          width:{
            ideal:640
          },

          height:{
            ideal:480
          },

          frameRate:{
            ideal:30
          }

        },

        audio:false

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
      aiReady
        ? "📷 CAMERA WORKING"
        : "📷 CAMERA WORKING — AI LOADING";


    stage.textContent =
      aiReady
        ? "CALIBRATING"
        : "WAITING FOR AI";


    resizeCanvas();


    cameraLoop();


  }catch(error){

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


/* =====================================================
   CAMERA LOOP
===================================================== */

function cameraLoop(){

  if(!cameraRunning){
    return;
  }


  requestAnimationFrame(
    cameraLoop
  );


  if(!aiReady){
    return;
  }


  if(
    camera.readyState < 2
  ){
    return;
  }


  const now =
    performance.now();


  /*
     Approximately 20 FPS.
  */

  if(
    now -
    lastFrameTime <
    50
  ){
    return;
  }


  lastFrameTime =
    now;


  resizeCanvas();


  try{

    const result =
      landmarker.detectForVideo(
        camera,
        now
      );


    processPose(result);

  }catch(error){

    console.error(
      "POSE ERROR:",
      error
    );

  }

}


/* =====================================================
   SWITCH CAMERA
===================================================== */

switchCamera.onclick =
async function(){

  facing =
    facing === "user"
      ? "environment"
      : "user";


  cameraRunning =
    false;


  if(stream){

    stream.getTracks().forEach(
      track => track.stop()
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
function(){

  cameraRunning =
    false;


  if(stream){

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
   VIDEO
===================================================== */

videoInput.onchange =
function(){

  const file =
    videoInput.files[0];


  if(!file){
    return;
  }


  if(videoURL){

    URL.revokeObjectURL(
      videoURL
    );

  }


  videoURL =
    URL.createObjectURL(file);


  videoPlayer.src =
    videoURL;


  videoPlayer.style.display =
    "block";


  camera.style.display =
    "none";


  cameraRunning =
    false;


  if(stream){

    stream.getTracks().forEach(
      track => track.stop()
    );

    stream = null;

  }


  resetCounter();


  videoState.textContent =
    "VIDEO ✓";


  analyzeVideo.disabled =
    false;


  status.textContent =
    "✅ VIDEO SELECTED";


  stage.textContent =
    "VIDEO READY";


};


/* =====================================================
   INITIALIZE
===================================================== */

resetCounter();

loadAI();