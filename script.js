// SkipFit AI V2.4
// Frame-by-frame skipping counter

const skipVideo = document.getElementById("skipVideo");
const skipPreview = document.getElementById("skipVideoPreview");
const skipStatus = document.getElementById("skipStatus");

const skipCountEl = document.getElementById("skipCount");
const totalSkipsEl = document.getElementById("totalSkips");
const skipTask = document.getElementById("skipTask");
const skipProgress = document.getElementById("skipProgress");

let skipCount = Number(localStorage.getItem("skipCount") || 0);
let detector = null;

let processing = false;
let frameCount = 0;
let bodyDetected = 0;

let previousAnkleY = null;
let previousMovement = null;

let jumping = false;
let lastCountTime = -1;


// -------------------------------
// SCREEN
// -------------------------------

function updateScreen() {

    if (skipCountEl)
        skipCountEl.textContent = skipCount;

    if (totalSkipsEl)
        totalSkipsEl.textContent = skipCount;

    if (skipTask)
        skipTask.textContent =
            Math.min(skipCount, 1000) + "/1000";

    if (skipProgress)
        skipProgress.style.width =
            Math.min((skipCount / 1000) * 100, 100) + "%";
}

updateScreen();


// -------------------------------
// VIDEO SELECT
// -------------------------------

if (skipVideo) {

    skipVideo.addEventListener("change", function () {

        const file = this.files[0];

        if (!file) return;

        skipPreview.src =
            URL.createObjectURL(file);

        skipPreview.style.display = "block";

        skipStatus.innerHTML =
            "✅ Video selected.<br>" +
            file.name;
    });
}


// -------------------------------
// LOAD MOVENET
// -------------------------------

async function loadAI() {

    skipStatus.innerHTML =
        "🤖 Loading body-tracking AI...";

    if (!window.tf) {

        skipStatus.innerHTML =
            "❌ TensorFlow.js not loaded.";

        return false;
    }

    if (!window.poseDetection) {

        skipStatus.innerHTML =
            "❌ Pose Detection library not loaded.";

        return false;
    }

    try {

        await tf.ready();

        detector =
            await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                {
                    modelType:
                        poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
                }
            );

        skipStatus.innerHTML =
            "✅ MoveNet ready.<br>" +
            "Starting frame-by-frame analysis...";

        return true;

    } catch (error) {

        console.error(error);

        skipStatus.innerHTML =
            "❌ AI loading error:<br>" +
            error.message;

        return false;
    }
}


// -------------------------------
// ANALYZE VIDEO
// -------------------------------

async function analyzeSkipping() {

    if (
        !skipVideo ||
        !skipVideo.files ||
        !skipVideo.files.length
    ) {

        skipStatus.innerHTML =
            "❌ Choose a skipping video first.";

        return;
    }

    if (processing) return;

    processing = true;

    frameCount = 0;
    bodyDetected = 0;

    previousAnkleY = null;
    previousMovement = null;

    jumping = false;
    lastCountTime = -10;

    const ready = await loadAI();

    if (!ready) {

        processing = false;
        return;
    }

    const video = skipPreview;

    video.muted = true;
    video.playsInline = true;

    try {

        await waitVideo(video);

        // Start from beginning
        video.currentTime = 0;

        await waitSeek(video);

        skipStatus.innerHTML =
            "🎥 Playing video.<br>" +
            "AI is analyzing every available frame...";

        await video.play();

        if (
            "requestVideoFrameCallback"
            in HTMLVideoElement.prototype
        ) {

            processWithVideoFrames(video);

        } else {

            processWithTimer(video);
        }

    } catch (error) {

        console.error(error);

        skipStatus.innerHTML =
            "❌ Video analysis error:<br>" +
            error.message;

        processing = false;
    }
}


// -------------------------------
// MODERN FRAME PROCESSING
// -------------------------------

function processWithVideoFrames(video) {

    const processFrame =
        async function(now, metadata) {

        if (!processing)
            return;

        if (video.ended) {

            finishAnalysis();
            return;
        }

        await analyzeCurrentFrame(video);

        video.requestVideoFrameCallback(
            processFrame
        );
    };

    video.requestVideoFrameCallback(
        processFrame
    );
}


// -------------------------------
// FALLBACK FOR OLDER BROWSERS
// -------------------------------

function processWithTimer(video) {

    const timer =
        setInterval(async function() {

            if (!processing) {

                clearInterval(timer);
                return;
            }

            if (video.ended) {

                clearInterval(timer);

                finishAnalysis();

                return;
            }

            await analyzeCurrentFrame(video);

        }, 150);
}


// -------------------------------
// ANALYZE ONE FRAME
// -------------------------------

async function analyzeCurrentFrame(video) {

    frameCount++;

    try {

        const poses =
            await detector.estimatePoses(video);

        if (
            !poses ||
            !poses.length ||
            !poses[0].keypoints
        ) {

            showProgress();
            return;
        }

        const points =
            poses[0].keypoints;

        const leftAnkle =
            getPoint(points, "left_ankle");

        const rightAnkle =
            getPoint(points, "right_ankle");

        const leftHip =
            getPoint(points, "left_hip");

        const rightHip =
            getPoint(points, "right_hip");

        if (
            !leftAnkle ||
            !rightAnkle ||
            !leftHip ||
            !rightHip
        ) {

            showProgress();
            return;
        }

        bodyDetected++;

        const ankleY =
            (
                leftAnkle.y +
                rightAnkle.y
            ) / 2;

        const hipY =
            (
                leftHip.y +
                rightHip.y
            ) / 2;

        // Movement relative to body size
        const bodySize =
            Math.max(
                Math.abs(ankleY - hipY),
                1
            );

        const movement =
            (ankleY - hipY) / bodySize;

        detectJump(
            movement,
            video.currentTime
        );

        showProgress();

    } catch (error) {

        console.log(
            "Frame error:",
            error
        );
    }
}


// -------------------------------
// JUMP DETECTION
// -------------------------------

function detectJump(movement, time) {

    if (previousMovement === null) {

        previousMovement = movement;
        return;
    }

    const difference =
        movement -
        previousMovement;

    /*
       When jumping, the ankles move
       upward relative to the hips.
    */

    if (
        difference < -0.025 &&
        !jumping
    ) {

        jumping = true;
    }


    /*
       When the feet come back down,
       count one completed repetition.
    */

    if (
        difference > 0.025 &&
        jumping
    ) {

        if (
            time - lastCountTime > 0.25
        ) {

            skipCount++;

            lastCountTime = time;

            localStorage.setItem(
                "skipCount",
                skipCount
            );

            updateScreen();
        }

        jumping = false;
    }

    previousMovement = movement;
}


// -------------------------------
// KEYPOINT
// -------------------------------

function getPoint(points, name) {

    const point =
        points.find(
            p => p.name === name
        );

    if (!point)
        return null;

    if (
        typeof point.score === "number" &&
        point.score < 0.25
    )
        return null;

    return point;
}


// -------------------------------
// PROGRESS DISPLAY
// -------------------------------

function showProgress() {

    if (!skipStatus)
        return;

    let seconds = 0;

    if (
        skipPreview &&
        isFinite(skipPreview.currentTime)
    ) {
        seconds =
            skipPreview.currentTime.toFixed(1);
    }

    skipStatus.innerHTML =
        "🤖 Frame-by-frame AI analysis<br><br>" +
        "Time: " + seconds + " sec<br>" +
        "Frames processed: " + frameCount + "<br>" +
        "Body detected: " + bodyDetected + "<br>" +
        "Skips detected: " + skipCount;
}


// -------------------------------
// FINISH
// -------------------------------

function finishAnalysis() {

    processing = false;

    updateScreen();

    skipStatus.innerHTML =
        "✅ Analysis complete!<br><br>" +
        "Frames processed: " +
        frameCount +
        "<br>" +
        "Body detected: " +
        bodyDetected +
        "<br>" +
        "Total skips detected: " +
        skipCount;
}


// -------------------------------
// VIDEO READY
// -------------------------------

function waitVideo(video) {

    return new Promise(function(resolve) {

        if (
            video.readyState >= 2 &&
            video.duration
        ) {

            resolve();
            return;
        }

        video.addEventListener(
            "loadeddata",
            resolve,
            { once: true }
        );
    });
}


function waitSeek(video) {

    return new Promise(function(resolve) {

        function done() {

            video.removeEventListener(
                "seeked",
                done
            );

            resolve();
        }

        video.addEventListener(
            "seeked",
            done
        );

        video.currentTime = 0;
    });
}