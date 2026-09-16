// SkipFit AI V2.3 - AI DIAGNOSTIC TEST

const skipVideo = document.getElementById("skipVideo");
const skipPreview = document.getElementById("skipVideoPreview");
const skipStatus = document.getElementById("skipStatus");
const skipCountEl = document.getElementById("skipCount");
const totalSkipsEl = document.getElementById("totalSkips");
const skipTask = document.getElementById("skipTask");
const skipProgress = document.getElementById("skipProgress");

let skipCount = Number(localStorage.getItem("skipCount") || 0);
let detector = null;

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


// ===============================
// VIDEO SELECTION
// ===============================

if (skipVideo) {

    skipVideo.addEventListener("change", function () {

        const file = this.files[0];

        if (!file) return;

        const url = URL.createObjectURL(file);

        skipPreview.src = url;
        skipPreview.style.display = "block";

        skipStatus.innerHTML =
            "✅ Video selected.<br>" +
            "File: " + file.name;
    });
}


// ===============================
// LOAD AI
// ===============================

async function loadAI() {

    skipStatus.innerHTML =
        "1️⃣ Checking AI libraries...";

    if (!window.tf) {

        skipStatus.innerHTML =
            "❌ TensorFlow.js is NOT loaded.<br>" +
            "Your index.html needs the TensorFlow script.";

        return null;
    }

    skipStatus.innerHTML =
        "2️⃣ TensorFlow.js found.<br>" +
        "Version: " + tf.version.tfjs;

    if (!window.poseDetection) {

        skipStatus.innerHTML =
            "❌ Pose Detection library is NOT loaded.";

        return null;
    }

    skipStatus.innerHTML =
        "3️⃣ Pose Detection library found.<br>" +
        "Loading MoveNet...";

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
            "✅ MoveNet AI loaded successfully!";

        return detector;

    } catch (error) {

        console.error(error);

        skipStatus.innerHTML =
            "❌ MoveNet failed to load.<br>" +
            error.message;

        return null;
    }
}


// ===============================
// ANALYZE SKIPPING
// ===============================

async function analyzeSkipping() {

    if (!skipVideo || !skipVideo.files.length) {

        skipStatus.innerHTML =
            "❌ Please select a video first.";

        return;
    }

    const ai = await loadAI();

    if (!ai) return;

    const video = skipPreview;

    if (!video) {

        skipStatus.innerHTML =
            "❌ Video preview element missing.";

        return;
    }

    skipStatus.innerHTML =
        "4️⃣ Reading video...";

    try {

        await waitForVideo(video);

        const duration = video.duration;

        if (!duration || !isFinite(duration)) {

            skipStatus.innerHTML =
                "❌ Video duration could not be read.";

            return;
        }

        skipStatus.innerHTML =
            "5️⃣ Video ready.<br>" +
            "Duration: " +
            duration.toFixed(1) +
            " seconds.<br>" +
            "Starting body detection...";

        let totalFrames = 0;
        let bodyFrames = 0;
        let ankleFrames = 0;

        const movement = [];

        // Analyze approximately 5 frames per second.
        const interval = 0.20;

        for (
            let time = 0;
            time < duration;
            time += interval
        ) {

            await seekVideo(video, time);

            totalFrames++;

            try {

                const poses =
                    await ai.estimatePoses(video);

                if (
                    poses &&
                    poses.length > 0 &&
                    poses[0].keypoints
                ) {

                    bodyFrames++;

                    const points =
                        poses[0].keypoints;

                    const leftAnkle =
                        findPoint(points, "left_ankle");

                    const rightAnkle =
                        findPoint(points, "right_ankle");

                    const leftHip =
                        findPoint(points, "left_hip");

                    const rightHip =
                        findPoint(points, "right_hip");

                    if (
                        leftAnkle &&
                        rightAnkle &&
                        leftHip &&
                        rightHip
                    ) {

                        ankleFrames++;

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

                        movement.push({
                            time: time,
                            ankle: ankleY,
                            hip: hipY
                        });
                    }
                }

            } catch (error) {

                console.log(
                    "Frame error:",
                    error
                );
            }

            const percent =
                Math.round(
                    (time / duration) * 100
                );

            skipStatus.innerHTML =
                "🤖 Analyzing video...<br>" +
                percent + "% complete<br><br>" +
                "Frames checked: " +
                totalFrames +
                "<br>" +
                "Body detected: " +
                bodyFrames +
                "<br>" +
                "Feet + hips detected: " +
                ankleFrames;
        }


        // ===============================
        // DIAGNOSTIC RESULT
        // ===============================

        let detected = 0;

        if (movement.length >= 5) {

            detected =
                detectSkipping(movement);
        }

        skipStatus.innerHTML =
            "🏁 AI TEST COMPLETE<br><br>" +

            "Video frames checked: " +
            totalFrames +
            "<br>" +

            "Frames with body detected: " +
            bodyFrames +
            "<br>" +

            "Frames with feet + hips detected: " +
            ankleFrames +
            "<br>" +

            "Movement cycles detected: " +
            detected +
            "<br><br>" +

            "AI is connected. We can now calibrate the skipping counter.";

        // Only add a positive result.
        if (detected > 0) {

            skipCount += detected;

            localStorage.setItem(
                "skipCount",
                skipCount
            );

            updateScreen();
        }

    } catch (error) {

        console.error(error);

        skipStatus.innerHTML =
            "❌ Analysis error:<br>" +
            error.message;
    }
}


// ===============================
// WAIT FOR VIDEO
// ===============================

function waitForVideo(video) {

    return new Promise((resolve, reject) => {

        if (
            video.readyState >= 2 &&
            video.duration
        ) {
            resolve();
            return;
        }

        const loaded = () => {
            cleanup();
            resolve();
        };

        const failed = () => {
            cleanup();
            reject(
                new Error(
                    "Video could not be loaded."
                )
            );
        };

        function cleanup() {

            video.removeEventListener(
                "loadedmetadata",
                loaded
            );

            video.removeEventListener(
                "error",
                failed
            );
        }

        video.addEventListener(
            "loadedmetadata",
            loaded
        );

        video.addEventListener(
            "error",
            failed
        );
    });
}


// ===============================
// SEEK VIDEO
// ===============================

function seekVideo(video, time) {

    return new Promise(resolve => {

        const target =
            Math.min(
                time,
                Math.max(
                    0,
                    video.duration - 0.05
                )
            );

        const finished = () => {

            video.removeEventListener(
                "seeked",
                finished
            );

            resolve();
        };

        video.addEventListener(
            "seeked",
            finished
        );

        video.currentTime = target;
    });
}


// ===============================
// FIND KEYPOINT
// ===============================

function findPoint(points, name) {

    const point =
        points.find(
            p => p.name === name
        );

    if (!point) return null;

    if (
        typeof point.score === "number" &&
        point.score < 0.25
    ) {
        return null;
    }

    return point;
}


// ===============================
// SIMPLE MOVEMENT TEST
// ===============================

function detectSkipping(data) {

    if (data.length < 5)
        return 0;

    const signal =
        data.map(item => {

            return (
                item.ankle -
                item.hip
            );
        });

    // Smooth signal
    const smooth = [];

    for (
        let i = 0;
       