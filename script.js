const camera = document.getElementById("camera");
const startCamera = document.getElementById("startCamera");
const stopCamera = document.getElementById("stopCamera");
const status = document.getElementById("status");

startCamera.addEventListener("click", async () => {
  status.textContent = "BUTTON WORKED — REQUESTING CAMERA...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false
    });

    camera.srcObject = stream;
    camera.style.display = "block";

    await camera.play();

    status.textContent = "✅ CAMERA WORKING";
  } catch (error) {
    status.textContent = "❌ " + error.name + " — " + error.message;
    console.log(error);
  }
});

stopCamera.addEventListener("click", () => {
  const stream = camera.srcObject;

  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }

  camera.srcObject = null;
  camera.style.display = "none";
  status.textContent = "Camera stopped";
});