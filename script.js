// ==========================================
// SKIPFIT AI V5
// CAMERA + RECORDING + BODY TRACKING
// ==========================================


const camera =
    document.getElementById("camera");

const canvas =
    document.getElementById("poseCanvas");

const ctx =
    canvas.getContext("2d");

const cameraBtn =
    document.getElementById("cameraBtn");

const recordBtn =
    document.getElementById("recordBtn");

const cameraStatus =
    document.getElementById("cameraStatus");

const recordedVideo =
    document.getElementById("recordedVideo");

const recordStatus =
    document.getElementById("recordStatus");

const analysisStatus =
    document.getElementById("analysisStatus");

const liveCount =
    document.getElementById("liveCount");

const skipCount =
    document.getElementById("skipCount");

const totalSkipsBox =
    document.getElementById("totalSkips");

const taskBox =
    document.getElementById("skipTask");

const progressBar =
    document.getElementById("skipProgress");


let cameraStream = null;

let mediaRecorder = null;

let recordedChunks = [];

let recording = false;

let poseLandmarker = null;

let cameraRunning = false;


// ==========================================
// STORED COUNT
// ==========================================

let totalSkips =
    Number(
        localStorage.getItem("skipCount") || 0
    );

let sessionSkips = 0;

updateUI();


// ==========================================
// UPDATE UI
// ==========================================

function updateUI() {

    skipCount.textContent =
        sessionSkips;

    liveCount.textContent =
        sessionSkips;

    totalSkipsBox.textContent =
        totalSkips;

    taskBox.textContent =
        Math.min(totalSkips, 1000)
        + " / 1000";

    progressBar.style.width =
        Math.min(totalSkips / 10, 100)
        + "%";
}


// ==========================================
// OPEN CAMERA
// ==========================================

async function openCamera() {

    try {

        cameraStatus.textContent =
            "📷 Requesting camera permission...";

        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    facingMode: "user",
                    width: {
                        ideal: 720
                    },
                    height: {
                        ideal: 1280
                    }
                },

                audio: false

            });


        camera.srcObject =
            cameraStream;


        camera.onloadedmetadata =
            async function () {

                canvas.width =
                    camera.videoWidth;

                canvas.height =
                    camera.videoHeight;

                await camera.play();

                recordBtn.disabled =
                    false;

                cameraRunning =
                    true;

                cameraStatus.innerHTML =
                    "🟢 Camera active.<br>" +
                    "Stand where your complete body is visible.";

                await startPoseTracking();

            };


        cameraBtn.textContent =
            "📷 Camera Active";


    }
    catch (error) {

        console.error(error);

        cameraStatus.innerHTML =
            "❌ Camera error<br><br>" +
            error.message +
            "<br><br>" +
            "Check browser camera permission.";
    }
}


// ==========================================
// START RECORDING
// ==========================================

function startRecording() {

    if (!cameraStream) {

        cameraStatus.textContent =
            "Open the camera first.";

        return;
    }


    recordedChunks = [];


    let options = {
        mimeType: "video/webm"
    };


    if (
        !MediaRecorder.isTypeSupported(
            "video/webm"
        )
    ) {

        options = {};
    }


    mediaRecorder =
        new MediaRecorder(
            cameraStream,
            options
        );


    mediaRecorder.ondataavailable =
        function (event) {

            if (event.data.size > 0) {

                recordedChunks.push(
                    event.data
                );
            }
        };


    mediaRecorder.onstop =
        function () {

            createRecordedVideo();
        };


    mediaRecorder.start();


    recording = true;

    recordBtn.textContent =
        "⏹ Stop Recording";

    recordBtn.style.background =
        "#dc2626";

    recordStatus.textContent =
        "🔴 Recording workout...";

}


// ==========================================
// STOP RECORDING
// ==========================================

function stopRecording() {

    if (!mediaRecorder) {
        return;
    }

    mediaRecorder.stop();

    recording = false;

    recordBtn.textContent =
        "🔴 Start Recording";

    recordBtn.style.background =
        "";

    recordStatus.textContent =
        "⏳ Preparing recorded video...";
}


// ==========================================
// TOGGLE RECORDING
// ==========================================

function toggleRecording() {

    if (recording) {

        stopRecording();

    } else {

        startRecording();

    }
}


// ==========================================
// CREATE RECORDED VIDEO
// ==========================================

function createRecordedVideo() {

    const blob =
        new Blob(
            recordedChunks,
            {
                type: "video/webm"
            }
        );


    const url =
        URL.createObjectURL(blob);


    recordedVideo.src =
        url;

    recordedVideo.style.display =
        "block";


    recordedVideo.controls =
        true;


    recordStatus.innerHTML =
        "✅ Workout recorded successfully.<br>" +
        "Your video is ready for AI analysis.";


    analysisStatus.textContent =
        "Ready to analyze the recorded workout.";

}


// ==========================================
// LOAD MEDIAPIPE
// ==========================================

async function loadPoseLandmarker() {

    if (poseLandmarker) {

        return poseLandmarker;
    }


    analysisStatus.innerHTML =
        "🤖 Loading advanced body AI...";


    /*
     * MediaPipe Tasks Vision is loaded
     * through the module in index.html.
     */

    const vision =
        await import(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304"
        );


    const {
        FilesetResolver,
        PoseLandmarker
    } = vision;


    const filesetResolver =
        await FilesetResolver.forVisionTasks(

            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"

        );


    poseLandmarker =
        await PoseLandmarker.createFromOptions(

            filesetResolver,

            {

                baseOptions: {

                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

                    delegate: "GPU"

                },

                runningMode: "VIDEO",

                numPoses: 1,

                minPoseDetectionConfidence:
                    0.5,

                minPosePresenceConfidence:
                    0.5,

                minTrackingConfidence:
                    0.5

            }

        );


    return poseLandmarker;
}


// ==========================================
// LIVE POSE TRACKING
// ==========================================

let lastVideoTime = -1;

let lastHipY = null;

let jumpState = "ground";

let liveLastJump = 0;


async function startPoseTracking() {

    try {

        const landmarker =
            await loadPoseLandmarker();


        function detectFrame() {

            if (!cameraRunning) {
                return;
            }


            if (
                camera.readyState >= 2 &&
                camera.currentTime !== lastVideoTime
            ) {

                lastVideoTime =
                    camera.currentTime;


                const now =
                    performance.now();


                const result =
                    landmarker.detectForVideo(
                        camera,
                        now
                    );


                processPose(result);
            }


            requestAnimationFrame(
                detectFrame
            );
        }


        detectFrame();


    }
    catch (error) {

        console.error(error);

        cameraStatus.innerHTML =
            "❌ Advanced AI error<br><br>" +
            error.message;
    }
}


// ==========================================
// PROCESS BODY
// ==========================================

function processPose(result) {

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

        cameraStatus.textContent =
            "🟡 Looking for your body...";

        return;
    }


    const landmarks =
        result.landmarks[0];


    drawSkeleton(landmarks);


    /*
     * MediaPipe landmarks:
     *
     * 23 = left hip
     * 24 = right hip
     * 27 = left ankle
     * 28 = right ankle
     */


    const leftHip =
        landmarks[23];

    const rightHip =
        landmarks[24];

    const leftAnkle =
        landmarks[27];

    const rightAnkle =
        landmarks[28];


    if (
        !leftHip ||
        !rightHip ||
        !leftAnkle ||
        !rightAnkle
    ) {

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
     * Distance between hips and feet.
     */

    const vertical =
        ankleY - hipY;


    if (lastHipY === null) {

        lastHipY =
            vertical;

        return;
    }


    const movement =
        vertical - lastHipY;


    lastHipY =
        lastHipY * 0.75 +
        vertical * 0.25;


    /*
     * Smaller Y means the feet
     * moved upward.
     */

    const currentTime =
        performance.now();


    /*
     * UPWARD PHASE
     */

    if (
        movement < -0.012 &&
        jumpState === "ground"
    ) {

        jumpState =
            "air";
    }


    /*
     * DOWNWARD PHASE
     */

    if (
        movement > 0.012 &&
        jumpState === "air"
    ) {

        /*
         * Prevent duplicate counting.
         */

        if (
            currentTime -
            liveLastJump >
            250
        ) {

            sessionSkips++;

            liveLastJump =
                currentTime;

            updateUI();
        }


        jumpState =
            "ground";
    }


    cameraStatus.innerHTML =
        "🟢 Advanced body tracking active<br>" +
        "🦴 Body landmarks detected: " +
        landmarks.length;

}


// ==========================================
// DRAW BODY SKELETON
// ==========================================

function drawSkeleton(landmarks) {

    const connections = [

        [11, 12],

        [11, 13],
        [13, 15],

        [12, 14],
        [14, 16],

        [11, 23],
        [12, 24],

        [23, 24],

        [23, 25],
        [25, 27],

        [24, 26],
        [26, 28]

    ];


    ctx.lineWidth = 4;


    connections.forEach(
        function (connection) {

            const a =
                landmarks[connection[0]];

            const b =
                landmarks[connection[1]];


            if (!a || !b) {
                return;
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
    );


    landmarks.forEach(
        function (point) {

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
    );
}


// ==========================================
// ANALYZE RECORDED VIDEO
// ==========================================

async function analyzeRecordedVideo() {

    if (!recordedVideo.src) {

        analysisStatus.textContent =
            "❌ Record a video first.";

        return;
    }


    analysisStatus.innerHTML =
        "🤖 Recorded video is ready.<br><br>" +
        "The live AI counter already tracked your movement while recording.";


    /*
     * Add the live session result
     * to the saved total.
     */

    totalSkips += sessionSkips;


    localStorage.setItem(
        "skipCount",
        totalSkips
    );


    updateUI();


    analysisStatus.innerHTML =
        "✅ Workout analysis complete!<br><br>" +

        "Session skips: " +
        sessionSkips +
        "<br>" +

        "Total skips: " +
        totalSkips;
}


// ==========================================
// PAGE EXIT
// ==========================================

window.addEventListener(
    "beforeunload",
    function () {

        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(
                    function (track) {
                        track.stop();
                    }
                );
        }
    }
);