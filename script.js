<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>SkipFit AI</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #0b0f14;
      color: white;
      font-family: Arial, sans-serif;
    }

    header {
      text-align: center;
      padding: 20px 10px;
      border-bottom: 1px solid #222;
    }

    header h1 {
      margin: 0;
      font-size: 30px;
    }

    header p {
      margin: 6px 0;
      opacity: .8;
    }

    header small {
      opacity: .6;
    }

    main {
      max-width: 700px;
      margin: auto;
      padding: 15px;
    }

    .card {
      background: #121820;
      border-radius: 18px;
      padding: 15px;
      box-shadow: 0 8px 30px rgba(0,0,0,.3);
    }

    #status {
      text-align: center;
      padding: 10px;
      margin-bottom: 12px;
      border-radius: 10px;
      background: #18212b;
      font-size: 14px;
    }

    .video-box {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #000;
      border-radius: 14px;
      overflow: hidden;
    }

    video,
    canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    #camera {
      display: none;
    }

    #fileVideo {
      display: none;
    }

    .info {
      display: flex;
      justify-content: space-around;
      gap: 6px;
      margin: 12px 0;
    }

    .info div {
      flex: 1;
      text-align: center;
      padding: 10px 4px;
      background: #18212b;
      border-radius: 10px;
      font-size: 12px;
    }

    .ok {
      color: #65ff9b;
    }

    .bad {
      color: #ff7373;
    }

    .stage {
      text-align: center;
      font-size: 15px;
      font-weight: bold;
      margin: 12px 0;
    }

    .count-title {
      text-align: center;
      opacity: .6;
      font-size: 14px;
    }

    #skipCount {
      text-align: center;
      font-size: 64px;
      font-weight: bold;
      margin: 3px 0 15px;
    }

    .buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    button,
    label.file-button {
      width: 100%;
      border: 0;
      border-radius: 12px;
      padding: 14px;
      font-size: 15px;
      font-weight: bold;
      background: #263341;
      color: white;
      text-align: center;
      cursor: pointer;
    }

    button:disabled {
      opacity: .4;
    }

    input[type="file"] {
      display: none;
    }

    .primary {
      background: #1677ff !important;
    }

    .danger {
      background: #8e3030 !important;
    }

    .progress-box {
      margin-top: 14px;
    }

    progress {
      width: 100%;
      height: 12px;
    }

    .help {
      margin-top: 18px;
      padding: 12px;
      background: #18212b;
      border-radius: 12px;
      line-height: 1.5;
      font-size: 13px;
      opacity: .85;
    }

    @media(max-width:500px) {
      #skipCount {
        font-size: 52px;
      }

      .buttons {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>

<body>

<header>
  <h1>SkipFit AI</h1>
  <p>By Aditya Kumar Yadav</p>
  <small>AI Skipping Counter</small>
</header>

<main>

  <section class="card">

    <div id="status">
      Starting AI...
    </div>

    <div class="video-box">

      <video
        id="camera"
        autoplay
        muted
        playsinline>
      </video>

      <video
        id="fileVideo"
        muted
        playsinline>
      </video>

      <canvas id="overlay"></canvas>

    </div>

    <div class="info">

      <div id="head">
        HEAD ○
      </div>

      <div id="hands">
        HANDS ○
      </div>

      <div id="legs">
        LEGS ○
      </div>

    </div>

    <div id="stage" class="stage">
      AI STARTING
    </div>

    <div class="count-title">
      SKIPS
    </div>

    <div id="skipCount">
      0
    </div>

    <div class="buttons">

      <button
        id="startBtn"
        class="primary">
        📷 START CAMERA
      </button>

      <button
        id="switchBtn"
        disabled>
        🔄 SWITCH CAMERA
      </button>

      <button
        id="stopBtn"
        class="danger"
        disabled>
        ⛔ STOP
      </button>

      <label
        for="videoFile"
        class="file-button">
        📁 CHOOSE VIDEO
      </label>

      <input
        id="videoFile"
        type="file"
        accept="video/*">

      <button
        id="analyzeBtn"
        class="primary"
        disabled>
        🧠 ANALYZE VIDEO
      </button>

    </div>

    <div class="progress-box">
      <progress
        id="progressBar"
        value="0"
        max="100">
      </progress>
    </div>

    <div class="help">

      <b>Camera mode</b>
      <br>
      Keep your full body visible. Start the camera and make 5 normal jumps for calibration.

      <br><br>

      <b>Video mode</b>
      <br>
      Choose a real video containing skipping. Then press ANALYZE VIDEO.

      <br><br>

      The AI first looks for the body using head, hands and legs, then analyzes movement frame by frame.

    </div>

  </section>

</main>

<script type="module" src="script.js"></script>

</body>
</html>