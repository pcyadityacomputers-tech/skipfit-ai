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
   VARIABLES
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
   SKIPFIT ENGINE
========================= */

let jumpCount = 0;

let jumpState = "GROUND";

let lastJumpTime = 0;

let calibrationFrames = 0;
let calibrationSum = 0;
let calibrationValue = null;

let previousHipY = null;

let jumpCooldown = 350;

let minimumJumpDistance = 0.025;

let lastBodyFound = false;


/* =========================
   RESET COUNTER
========================= */

function resetCounter() {

  jumpCount = 0;

  jumpState = "GROUND";

  lastJumpTime = 0;

  calibrationFrames = 0;

  calibrationSum = 0;

  calibrationValue = null;

  previousHipY = null;

  lastBodyFound = false;

  count.textContent = "0";

}


/* =========================
   GET BODY DATA
========================= */

function getBodyData(points) {

  if (!points || points.length < 33)
    return null;


  const leftShoulder = points[11];
  const rightShoulder = points[12];

  const leftHip = points[23];
  const rightHip = points[24];

  const leftKnee = points[25];
  const rightKnee = points[26];

  const leftAnkle = points[27];
  const rightAnkle = points[28];

  const nose = points[0];


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

    if (!p)
      return null;

    if (
      p.visibility !== undefined &&
      p.visibility < 0.25
    ) {

      return null;
    }
  }


  const hipY =
    (leftHip.y + rightHip.y) / 2;


  const shoulderY =
    (leftShoulder.y + rightShoulder.y) / 2;


  const kneeY =
    (leftKnee.y + rightKnee.y) / 2;


  const ankleY =
    (leftAnkle.y + rightAnkle.y) / 2;


  const bodyHeight =
    Math.abs(
      ankleY - shoulderY
    );


  return {

    hipY,
    shoulderY,
    kneeY,
    ankleY,
    bodyHeight,
    nose
  };
}


/* =========================
   CALIBRATION
========================= */

function calibrateBody(data) {

  if (!data)
    return;


  /*
    First frames establish
    normal hip position.
  */

  if (calibrationFrames < 30) {

    calibrationSum += data.hipY;

    calibrationFrames++;


    stage.textContent =
      "CALIBRATING " +
      Math.round