// ==========================================
// SKIPFIT AI V3
// REAL FRAME-BY-FRAME MOVEMENT COUNTER
// ==========================================

const videoInput = document.getElementById("skipVideo");
const video = document.getElementById("skipVideoPreview");
const statusBox = document.getElementById("skipStatus");

const countBox = document.getElementById("skipCount");
const totalBox = document.getElementById("totalSkips");
const taskBox = document.getElementById("skipTask");
const progressBar = document.getElementById("skipProgress");

let detector = null;
let analyzing = false;

let totalSkips =
    Number(localStorage.getItem("skipCount") || 0);


// ==========================================
// UPDATE UI
// ==========================================

function updateUI() {

    if (countBox)
        countBox.textContent = totalSkips;

    if (totalBox)
        totalBox.textContent = totalSkips;

    if (taskBox)
        taskBox.textContent =
            Math.min(totalSkips, 1000) + "/1000";

    if (progressBar)
        progressBar.style.width =
            Math.min(totalSkips / 10, 100) + "%";
}

updateUI();


// ==========================================
// VIDEO SELECTED
// ==========================================

if (videoInput) {

    videoInput.addEventListener("change", function () {

        const file = this.files[0];

        if (!file)
            return;

        video.src = URL.createObjectURL(file);

        video.muted = true;
        video.playsInline = true;

        video.style.display = "block";

        statusBox.innerHTML =
            "✅ Video selected<br>" +
            file.name;
    });
}


// ==========================================
// LOAD MOVENET
// ==========================================

async function loadMoveNet() {

    if (detector)
        return detector;

    statusBox.innerHTML =
        "🤖 Loading MoveNet AI...";

    if (!window.tf) {

        throw new Error(
            "TensorFlow.js is missing from index.html"
        );
    }

    if (!window.poseDetection) {

        throw new Error(
            "MoveNet library is missing from index.html"
        );
    }

    await tf.ready();

    detector =
        await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            {
                modelType:
                    poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
            }
        );

    return detector;
}


// ==========================================
// ANALYZE BUTTON
// ==========================================

async function analyzeSkipping() {

    if (analyzing)
        return;

    if (
        !videoInput ||
        !videoInput.files ||
        !videoInput.files.length
    ) {

        statusBox.textContent =
            "❌ Select a video first.";

        return;
    }

    analyzing = true;

    try {

        // Load AI
        const ai =
            await loadMoveNet();

        statusBox.innerHTML =
            "🤖 AI loaded.<br>" +
            "Preparing video...";

        await waitForVideo();

        if (
            !video.duration ||
            !isFinite(video.duration)
        ) {

            throw new Error(
                "Video duration is unavailable."
            );
        }

        // Reset video
        video.pause();

        video.currentTime = 0;

        await waitForSeek();

        // Reset detector
        let previousFoot = null;
        let previousTime = 0;

        let direction = 0;

        let goingUp = false;

        let videoSkips = 0;

        let frames = 0;
        let detectedFrames = 0;

        const duration =
            video.duration;

        statusBox.innerHTML =
            "🎥 Starting frame-by-frame AI analysis...";

        /*
         * We process the video at approximately
         * 10 frames per second.
         *
         * This is intentionally lighter for
         * mobile devices.
         */

        const frameStep = 0.10;

        for (
            let t = 0;
            t < duration;
            t += frameStep
        ) {

            await seekTo(t);

            frames++;

            let pose;

            try {

                const poses =
                    await ai.estimatePoses(video);

                if (
                    !poses ||
                    poses.length === 0
                ) {

                    updateProgress(
                        t,
                        duration,
                        frames,
                        detectedFrames,
                        videoSkips
                    );

                    continue;
                }

                pose = poses[0];

            } catch (error) {

                console.log(
                    "Pose error:",
                    error
                );

                continue;
            }


            // ----------------------------------
            // FIND BODY POINTS
            // ----------------------------------

            const leftAnkle =
                keypoint(
                    pose,
                    "left_ankle"
                );

            const rightAnkle =
                keypoint(
                    pose,
                    "right_ankle"
                );

            const leftHip =
                keypoint(
                    pose,
                    "left_hip"
                );

            const rightHip =
                keypoint(
                    pose,
                    "right_hip"
                );


            if (
                !leftAnkle ||
                !rightAnkle ||
                !leftHip ||
                !rightHip
            ) {

                continue;
            }

            detectedFrames++;


            // ----------------------------------
            // AVERAGE BOTH FEET
            // ----------------------------------

            const footY =
                (
                    leftAnkle.y +
                    rightAnkle.y
                ) / 2;

            const hipY =
                (
                    leftHip.y +
                    rightHip.y
                ) / 2;


            /*
             * Normalize the feet position.
             * This makes the system less dependent
             * on how close the camera is.
             */

            const bodyLength =
                Math.max(
                    Math.abs(
                        footY - hipY
                    ),
                    1
                );

            const relativeFoot =
                (footY - hipY) /
                bodyLength;


            // ----------------------------------
            // MOVEMENT
            // ----------------------------------

            if (
                previousFoot !== null
            ) {

                const movement =
                    relativeFoot -
                    previousFoot;

                /*
                 * Negative movement:
                 * feet moving upward.
                 */

                if (
                    movement < -0.015 &&
                    direction !== -1
                ) {

                    direction = -1;
                    goingUp = true;
                }


                /*
                 * Positive movement:
                 * feet moving downward.
                 */

                if (
                    movement > 0.015 &&
                    goingUp &&
                    direction !== 1
                ) {

                    direction = 1;

                    /*
                     * One complete jump cycle.
                     */

                    if (
                        t -
                        previousTime >
                        0.20
                    {

                        videoSkips++;

                        previousTime = t;
                    }

                    goingUp = false;
                }
            }


            previousFoot =
                relativeFoot;


            // ----------------------------------
            // LIVE DISPLAY
            // ----------------------------------

            updateProgress(
                t,
                duration,
                frames,
                detectedFrames,
                videoSkips
            );
        }


        // ======================================
        // ADD RESULT
        // ======================================

        totalSkips += videoSkips;

        localStorage.setItem(
            "skipCount",
            totalSkips
        );

        updateUI();


        statusBox.innerHTML =
            "✅ AI analysis finished!<br><br>" +

            "Frames analyzed: " +
            frames +
            "<br>" +

            "Body detected: " +
            detectedFrames +
            "<br>" +

            "Skips detected in video: " +
            videoSkips +
            "<br><br>" +

            "Total SkipFit count: " +
            totalSkips;


    } catch (error) {

        console.error(
            "SkipFit V3 ERROR:",
            error
        );

        statusBox.innerHTML =
            "❌ V3 AI ERROR<br><br>" +
            error.message;

    } finally {

        analyzing = false;
    }
}


// ==========================================
// GET KEYPOINT
// ==========================================

function keypoint(pose, name) {

    if (
        !pose ||
        !pose.keypoints
    )
        return null;

    const point =
        pose.keypoints.find(
            p => p.name === name
        );

    if (!point)
        return null;

    if (
        typeof point.score === "number" &&
        point.score < 0.30
    )
        return null;

    return point;
}


// ==========================================
// SEEK VIDEO
// ==========================================

function seekTo(time) {

    return new Promise(
        function(resolve) {

            function finished() {

                video.removeEventListener(
                    "seeked",
                    finished
                );

                resolve();
            }

            video.addEventListener(
                "seeked",
                finished
            );

            video.currentTime =
                Math.min(
                    time,
                    video.duration - 0.01
                );
        }
    );
}


// ==========================================
// VIDEO READY
// ==========================================

function waitForVideo() {

    return new Promise(
        function(resolve, reject) {

            if (
                video.readyState >= 2
            ) {

                resolve();
                return;
            }

            function loaded() {

                video.removeEventListener(
                    "loadeddata",
                    loaded
                );

                resolve();
            }

            function failed() {

                reject(
                    new Error(
                        "The video could not be decoded."
                    )
                );
            }

            video.addEventListener(
                "loadeddata",
                loaded,
                { once: true }
            );

            video.addEventListener(
                "error",
                failed,
                { once: true }
            );
        }
    );
}


// ==========================================
// SEEK READY
// ==========================================

function waitForSeek() {

    return new Promise(
        function(resolve) {

            if (
                Math.abs(
                    video.currentTime
                ) < 0.05
            ) {

                resolve();
                return;
            }

            video.addEventListener(
                "seeked",
                resolve,
                { once: true }
            );
        }
    );
}


// ==========================================
// PROGRESS
// ==========================================

function updateProgress(
    current,
    duration,
    frames,
    detected,
    skips
) {

    const percent =
        Math.round(
            (current / duration) * 100
        );

    statusBox.innerHTML =
        "🤖 AI analyzing frame-by-frame...<br><br>" +

        "Progress: " +
        percent +
        "%<br>" +

        "Frames analyzed: " +
        frames +
        "<br>" +

        "Body detected: " +
        detected +
        "<br>" +

        "Skips detected: " +
        skips;
}