chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'generateQuiz') {
    (async () => {
      try {
        // Directly call the function that gets the quiz from your AI server.
        const quiz = await fetchAIQuizFromServer(message.videoId);
        
        if (!quiz) {
          throw new Error("The server returned an empty quiz.");
        }
        
        sendResponse({ status: 'success', data: quiz });

      } catch (error) {
        console.error("An error occurred in generateQuiz listener:", error.message);
        sendResponse({ status: 'error', message: `Failed to generate quiz: ${error.message}` });
      }
    })();

    // Return true to indicate you will send a response asynchronously.
    return true;
  }
});


// New function to call your server's quiz generation endpoint
async function fetchAIQuizFromServer(videoId) {
  const backendUrl = `https://quiz-bot-cp9e.onrender.com/generate-quiz`; 
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
    // The server now sends back the complete quiz JSON
    return data.quiz; 
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error(`Could not connect to the local backend server at ${backendUrl}. Please ensure the server is running (using 'node server.js').`);
    }
    throw error;
  }
}
