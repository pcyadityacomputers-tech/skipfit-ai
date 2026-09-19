const status = document.getElementById("status");

async function startCameraTest() {

  try {

    status.textContent = "Requesting camera...";

    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

    status.textContent =
      "✅ CAMERA ACCESS WORKS";

    console.log("Camera stream:", stream);

    stream.getTracks().forEach(track => {
      track.stop();
    });

  } catch (error) {

    console.error(error);

    status.textContent =
      "❌ CAMERA ERROR: " + error.name;

  }

}

startCameraTest();