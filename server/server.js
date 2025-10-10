// server.js - Now with caching to prevent extra API calls
const path = require('path');
const express = require('express');
const fs = require('fs');
const { default: YTDlpWrap } = require('yt-dlp-wrap');
const OpenAI = require('openai');

// --- CONFIGURATION ---
const app = express();
const port = 3000;
const openai = new OpenAI({
  apiKey: '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', // 👈 Replace this
});
const ytDlpWrap = new YTDlpWrap();
const cacheDir = path.join(__dirname, 'transcript_cache');

// --- SELF-UPDATING YT-DLP ---
(async () => {
  try {
    console.log('Checking for yt-dlp updates...');
    await YTDlpWrap.downloadFromGithub();
    console.log('yt-dlp is up to date.');
  } catch (error) {
    console.error('Failed to update yt-dlp:', error);
  }
})();

// --- MIDDLEWARE ---
app.use(express.json());

// --- ROUTES ---
app.post('/transcribe', async (req, res) => {
  const { videoId } = req.body;
  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required' });
  }

  if (openai.apiKey === 'YOUR_OPENAI_API_KEY_HERE') {
    return res.status(500).json({ error: 'Server configuration error: OpenAI API key is missing.' });
  }

  const downloadDir = path.join(__dirname, 'downloads');
  const audioFilePath = path.join(downloadDir, `${videoId}.m4a`);
  const cachedTranscriptPath = path.join(cacheDir, `${videoId}.txt`);

  try {
    // --- CACHING LOGIC ---
    if (fs.existsSync(cachedTranscriptPath)) {
      console.log(`Cache hit for video ID: ${videoId}. Serving from file.`);
      const cachedTranscript = fs.readFileSync(cachedTranscriptPath, 'utf-8');
      return res.json({ transcript: cachedTranscript });
    }

    console.log(`Cache miss for video ID: ${videoId}. Fetching new transcript.`);
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }

    console.log('Downloading audio...');
    // --- ENHANCED LOGGING ---
    // We will now capture the output from yt-dlp to see exactly what it's doing.
    let ytDlpStdErr = '';
    const ytDlpProcess = ytDlpWrap.exec([
      `https://www.youtube.com/watch?v=${videoId}`,
      '--no-playlist',
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '-o', audioFilePath,
    ]);

    ytDlpProcess.on('stderr', (data) => {
        ytDlpStdErr += data.toString();
        console.error(`yt-dlp stderr: ${data.toString()}`);
    });

    // Wait for the process to finish
    await new Promise((resolve, reject) => {
        ytDlpProcess.on('close', resolve);
        ytDlpProcess.on('error', reject);
    });
    
    console.log('Audio download process finished.');

    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`yt-dlp failed to download the audio file. Stderr: ${ytDlpStdErr}`);
    }

    console.log('Transcribing with OpenAI Whisper...');
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),
      model: 'whisper-1',
    });
    const newTranscript = transcriptionResponse.text;
    
    console.log('Transcription successful.');

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir);
    }
    fs.writeFileSync(cachedTranscriptPath, newTranscript, 'utf-8');
    console.log(`Saved new transcript to cache at ${cachedTranscriptPath}`);
    
    res.json({ transcript: newTranscript });

  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).json({ error: `Failed to process video: ${error.message}` });
  } finally {
    if (fs.existsSync(audioFilePath)) {
      fs.unlinkSync(audioFilePath);
      console.log(`Cleaned up ${audioFilePath}`);
    }
  }
});

// --- SERVER START ---
app.listen(port, () => {
  // --- FIX: Corrected the IP address typo ---
  console.log(`Backend server listening at http://127.0.0.1:${port}`);
});

