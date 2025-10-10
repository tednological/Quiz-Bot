import { GoogleGenerativeAI } from './google-ai-sdk.min.mjs';
const GEMINI_API_KEY = 'AIzaSyA1-HqCeDNt4Jf4y99em818BB8u0RucMdI'; 

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'generateQuiz') {
    // Return a promise to handle the asynchronous response
    (async () => {
      try {
        let transcript;
        if (message.method === 'fast') {
          transcript = await fetchYouTubeTranscript(message.videoId);
          if (!transcript) {
            // Handle the fallback within the promise
            console.warn("Fast method failed, triggering fallback.");
            sendResponse({ status: 'fallback', message: "The fetched transcript was empty." });
            return; // Important to exit after sending response
          }
        } else if (message.method === 'ai') {
          transcript = await fetchAITranscript(message.videoId);
          if (!transcript || transcript.trim() === '') {
            throw new Error("The AI-generated transcript was empty.");
          }
        } else {
          throw new Error("Invalid method specified.");
        }

        const quiz = await callGeminiAPI(transcript);
        sendResponse({ status: 'success', data: quiz });

      } catch (error) {
        // A single catch block can handle errors from all async operations
        console.error("An error occurred in generateQuiz listener:", error.message);
        
        // If the error was a fallback case, we already sent the response.
        // Otherwise, send a generic error.
        if (message.method === 'fast' && !error.message.includes("AI-generated")) {
           sendResponse({ status: 'fallback', message: error.message });
        } else {
           sendResponse({ status: 'error', message: `Failed to generate quiz: ${error.message}` });
        }
      }
    })();

    // Return true to indicate you will send a response asynchronously
    return true;
  }
});

// The "fast" method using a third-party API
async function fetchYouTubeTranscript(videoId) {
  const apiUrl = `https://www.youtube-transcript.io/api/youtube/v1/transcript?videoId=${videoId}`;
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`Fast API failed with status: ${response.status}`);
  const transcriptData = await response.json();
  if (!transcriptData || transcriptData.length === 0) throw new Error("Transcript is empty or unavailable for this video.");
  return transcriptData.map(segment => segment.text).join(' ');
}

// The "AI" method calling your backend server (server.js)
async function fetchAITranscript(videoId) {
  // Ensure this matches the address your Node.js server is listening on
  const backendUrl = `http://127.0.0.1:3000/transcribe`; 
  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: videoId })
    });

    const data = await response.json(); 
    if (!response.ok) {
      throw new Error(data.error || `Backend server failed with status: ${response.status}`);
    }
    return data.transcript;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Could not connect to the local backend server at ${backendUrl}. Please ensure the server is running (using 'node server.js').`);
    }
    throw error;
  }
}
// background.js - Updated to use ES Module import


async function callGeminiAPI(transcript) {
  if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    throw new Error('Gemini API key is not set in background.js');
  }

  try {
    // Because we used 'import', we can now use GoogleGenerativeAI directly.
    // No more 'self.generativeAI'.
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are a helpful assistant designed to output JSON.
      Based on the following video transcript, generate a 4-question multiple-choice quiz.
      
      RULES:
      - The "options" field must be an object with keys "A", "B", "C", and "D".
      - The "correctAnswer" must be one of those keys ("A", "B", "C", or "D").
      - Your entire response must be a single, valid JSON array.
      - DO NOT include any introductory text, explanations, or markdown formatting like \`\`\`json.
      - Your output should be only the raw JSON array and nothing else.

      EXAMPLE:
      [
        { "question": "How do I look up information?", "options": { "A": "Ask your dog.", "B": "Ask your neighbor.", "C": "Type your question into Google.", "D": "Ask your cat." }, "correctAnswer": "C" }
      ]
      
      TRANSCRIPT:
      """
      ${transcript}
      """
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const rawText = response.text();
    
    const cleanedJson = rawText.replace(/```json\n|```/g, '').trim();
    return JSON.parse(cleanedJson);

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(`Failed to generate quiz: ${error.message}`);
  }
}
