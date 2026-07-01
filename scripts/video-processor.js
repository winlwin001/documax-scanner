const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Enable CORS for API requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

/**
 * Endpoint to process video files and burn/embed subtitles using FFmpeg.
 * Expects multipart/form-data:
 * - video: Uploaded MP4 file
 * - subtitles: Uploaded SRT subtitle file
 * - hardcode: String "true" or "false"
 */
app.post('/process-video', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'subtitles', maxCount: 1 }
]), (req, res) => {
  const videoFile = req.files['video'] ? req.files['video'][0] : null;
  const subtitleFile = req.files['subtitles'] ? req.files['subtitles'][0] : null;
  const hardcode = req.body.hardcode === 'true';

  if (!videoFile || !subtitleFile) {
    return res.status(400).json({ error: 'Missing video or subtitles file.' });
  }

  // Paths for input files and processed output
  const inputVideoPath = path.resolve(videoFile.path);
  const inputSrtPath = path.resolve(subtitleFile.path).replace(/\\/g, '/'); // Escape backslashes for FFmpeg path filter
  const outputFileName = `processed_${Date.now()}.mp4`;
  const outputVideoPath = path.resolve('uploads', outputFileName);

  let ffmpegCommand = '';

  if (hardcode) {
    // 1. HARDCODED (BURNED-IN) SUBTITLES FILTER
    // Command: ffmpeg -i input.mp4 -vf "subtitles=subs.srt" output.mp4
    ffmpegCommand = `ffmpeg -y -i "${inputVideoPath}" -vf "subtitles='${inputSrtPath}'" -c:a copy "${outputVideoPath}"`;
  } else {
    // 2. SOFT SUBTITLES MULTIPLEXING
    // Command: ffmpeg -i input.mp4 -i subs.srt -c copy -c:s mov_text output.mp4
    ffmpegCommand = `ffmpeg -y -i "${inputVideoPath}" -i "${inputSrtPath}" -c copy -c:s mov_text "${outputVideoPath}"`;
  }

  console.log(`[FFmpeg] Processing video. Mode: ${hardcode ? 'HARDCODE' : 'SOFT-SUB'}`);
  console.log(`[FFmpeg] Command: ${ffmpegCommand}`);

  // Execute FFmpeg process
  exec(ffmpegCommand, (error, stdout, stderr) => {
    // Cleanup uploaded temp files immediately
    fs.unlink(inputVideoPath, () => {});
    fs.unlink(inputSrtPath, () => {});

    if (error) {
      console.error(`[FFmpeg] Processing failed: ${error.message}`);
      return res.status(500).json({ error: `Video processing failed: ${error.message}` });
    }

    console.log(`[FFmpeg] Processing successful. File generated: ${outputVideoPath}`);

    // Stream the output file to the client and delete it from server storage once completed
    res.download(outputVideoPath, outputFileName, (downloadError) => {
      if (downloadError) {
        console.error(`[Server] Error sending file to client: ${downloadError.message}`);
      }
      fs.unlink(outputVideoPath, () => {
        console.log(`[Server] Deleted temporary output file: ${outputVideoPath}`);
      });
    });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🚀 FFmpeg Video Processing Server is running on port ${PORT}`);
  console.log(`👉 POST /process-video | Form-Data: video, subtitles, hardcode`);
  console.log(`================================================================`);
});
