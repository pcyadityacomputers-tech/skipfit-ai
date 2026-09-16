const videoInput = document.getElementById("skipVideo");
const video = document.getElementById("skipVideoPreview");
const statusBox = document.getElementById("skipStatus");
const countBox = document.getElementById("skipCount");

let totalSkips = Number(localStorage.getItem("skipCount") || 0);

if (countBox) {
    countBox.textContent = totalSkips;
}


// -----------------------------
// VIDEO SELECT
// -----------------------------

if (videoInput) {

    videoInput.addEventListener("change", function () {

        const file = this.files[0];

        if (!file) return;

        video.src = URL.createObjectURL(file);

        video.muted = true;
        video.playsInline = true;
        video.style.display = "block";

        statusBox.innerHTML =
            "✅ Video loaded successfully.<br><br>" +
            "Duration: " +
            video.duration.toFixed(1) +
            " seconds.<br><br>" +
            "Ready to start AI analysis.";
    });
}


// -----------------------------
// TEST BUTTON
// -----------------------------

async function analyzeSkipping() {

    statusBox.innerHTML =
        "🟡 BUTTON CLICK DETECTED<br><br>" +
        "Starting AI system...";

    console.log("analyzeSkipping() started");

    try {

        if (!videoInput.files.length) {

            statusBox.innerHTML =
                "❌ Please select a video first.";

            return;
        }

        statusBox.innerHTML =
            "🟡 Video found.<br><br>" +
            "Loading TensorFlow.js...";

        if (!window.tf) {
            throw new Error(
                "TensorFlow.js did not load."
            );
        }

        statusBox.innerHTML =
            "🟡 TensorFlow.js loaded.<br><br>" +
            "Loading MoveNet AI...";

        if (!window.poseDetection) {
            throw new Error(
                "MoveNet library did not load."
            );
        }

        await tf.ready();

        statusBox.innerHTML =
            "🟢 TensorFlow.js ready.<br><br>" +
            "Creating MoveNet detector...";

        const detector =
            await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                {
                    modelType:
                        poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
                }
            );

        statusBox.innerHTML =
            "🟢 MoveNet AI loaded successfully!<br><br>" +
            "Testing body detection...";

        video.pause();
        video.currentTime = 1;

        await new Promise(function(resolve) {

            video.addEventListener(
                "seeked",
                resolve,
                { once: true }
            );

        });

        const poses =
            await detector.estimatePoses(video);

        if (!poses || poses.length === 0) {

            statusBox.innerHTML =
                "⚠️ AI loaded, but no body was detected.<br><br>" +
                "Make sure your complete body is visible.";

            return;
        }

        statusBox.innerHTML =
            "🎉 AI BODY DETECTED!<br><br>" +
            "MoveNet is working correctly.<br><br>" +
            "Keypoints detected: " +
            poses[0].keypoints.length;

    } catch (error) {

        console.error(error);

        statusBox.innerHTML =
            "❌ AI ERROR<br><br>" +
            error.message;
    }
}