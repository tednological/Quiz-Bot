// server.js - UPDATED to generate quiz directly from YouTube URL using Gemini

const path = require('path');
const express = require('express');
const fs = require('fs');
// Remove: const { default: YTDlpWrap } = require('yt-dlp-wrap');
// Remove: const OpenAI = require('openai');

// --- Google Generative AI SDK (FOR SERVER-SIDE USE) ---
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- CONFIGURATION ---
const app = express();
const port = 3000;

// IMPORTANT: Use environment variables for API keys in production!
const GEMINI_API_KEY = 'AIzaSyA1-HqCeDNt4Jf4y99em818BB8u0RucMdI'; // 👈 REPLACE THIS WITH YOUR GEMINI API KEY!
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const cacheDir = path.join(__dirname, 'quiz_cache'); 



// --- MIDDLEWARE ---
app.use(express.json());

// --- ROUTES ---
// Renamed from '/transcribe' to '/generate-quiz' for clarity
app.post('/generate-quiz', async (req, res) => {
  const { videoId } = req.body; // Expecting videoId from the client
  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required' });
  }

  if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.status(500).json({ error: 'Server configuration error: Gemini API key is missing.' });
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const cachedQuizPath = path.join(cacheDir, `${videoId}.json`); // Cache JSON quiz

  try {
    // --- CACHING LOGIC for the final quiz ---
    if (fs.existsSync(cachedQuizPath)) {
      console.log(`Cache hit for video ID: ${videoId}. Serving quiz from file.`);
      const cachedQuiz = fs.readFileSync(cachedQuizPath, 'utf-8');
      return res.json({ quiz: JSON.parse(cachedQuiz) });
    }

    console.log(`Cache miss for video ID: ${videoId}. Generating new quiz.`);

    // --- Gemini API Call with YouTube URL ---
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Use 1.5-flash or gemini-pro

    const prompt = `
      You are an assistant designed to create quizzes from video content.
      Based on the provided YouTube video, generate a 5-question multiple-choice quiz.
      
      RULES:
      - The "options" field must be an object with keys "A", "B", "C", and "D".
      - The "correctAnswer" must be one of those keys ("A", "B", "C", or "D").
      - Your entire response must be a single, valid JSON array.
      - DO NOT include any introductory text, explanations, or markdown formatting like \`\`\`json.
      - Your output should be only the raw JSON array and nothing else.

      EXAMPLE:
      [
        { "question": "What is the main topic?", "options": { "A": "Topic 1", "B": "Topic 2", "C": "Topic 3", "D": "Topic 4" }, "correctAnswer": "C" }
      ]
      
      Please generate the quiz based on the content of this video.
    `;

    // Pass the prompt and the YouTube URL directly to generateContent
    const result = await model.generateContent(
      [
        prompt,
        { fileData: { fileUri: youtubeUrl, mimeType: "video/mp4" } }
      ],
      { timeout: 300000 } // 👈 Add this timeout option
    );
    
    const response = await result.response;
    const rawText = response.text();
    
    // Clean and parse the JSON response from the model
    const cleanedJson = rawText.replace(/```json\n|```/g, '').trim();
    const quiz = JSON.parse(cleanedJson);

    // Save the new quiz to cache
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir);
    }
    fs.writeFileSync(cachedQuizPath, JSON.stringify(quiz, null, 2), 'utf-8');
    console.log(`Saved new quiz to cache at ${cachedQuizPath}`);
    
    res.json({ quiz: quiz }); // Send the quiz back to the client

  } catch (error) {
    console.error('An error occurred:', error);
    // You might want to include error.response.text() for more debug info
    res.status(500).json({ error: `Failed to generate quiz: ${error.message}` });
  }
  // No finally block needed for cleanup since we don't download local files anymore.
});

// --- SERVER START ---
app.listen(port, () => {
  console.log(`Backend server listening at http://127.0.0.1:${port}`);
});