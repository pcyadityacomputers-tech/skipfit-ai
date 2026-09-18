const camera = document.getElementById("camera");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

const status = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const count = document.getElementById("count");

let detector = null;
let stream = null;
let running = false;

async function loadAI(){

  try{

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

  }catch(error){

    console.error(error);

    status.textContent =
      "❌ AI ERROR: " + error.message;
  }
}


async function startCamera(){

  try{

    status.textContent =
      "Opening camera...";

    stream =
      await navigator.mediaDevices.getUserMedia({

        video:{
          facingMode:"user",
          width:{ideal:640},
          height:{ideal:480}
        },

        audio:false

      });

    camera.srcObject = stream;

    camera.style.display = "block";

    await camera.play();

    overlay.width = camera.videoWidth;
    overlay.height = camera.videoHeight;

    running = true;

    status.textContent =
      "📷 CAMERA WORKING";

    detectBody();

  }catch(error){

    console.error(error);

    status.textContent =
      "❌ CAMERA ERROR: " +
      error.name;

  }
}


async function detectBody(){

  if(!running) return;

  try{

    const poses =
      await detector.estimatePoses(camera);

    ctx.clearRect(
      0,
      0,
      overlay.width,
      overlay.height
    );

    if(poses.length > 0){

      const keypoints =
        poses[0].keypoints;

      let visible = 0;

      keypoints.forEach(point => {

        if(point.score > 0.3){

          visible++;

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

      });

      status.textContent =
        "AI BODY DETECTED! " +
        visible +
        " keypoints";

    }else{

      status.textContent =
        "BODY NOT DETECTED";
    }

  }catch(error){

    console.error(error);

  }

  requestAnimationFrame(detectBody);
}


function stopCamera(){

  running = false;

  if(stream){

    stream
      .getTracks()
      .forEach(track => track.stop());

    stream = null;
  }

  camera.srcObject = null;

  camera.style.display = "none";

  ctx.clearRect(
    0,
    0,
    overlay.width,
    overlay.height
  );

  status.textContent =
    "Camera stopped";
}


startBtn.onclick =
  startCamera;

stopBtn.onclick =
  stopCamera;


loadAI();