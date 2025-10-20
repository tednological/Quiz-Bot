// --- Global State ---
let quizData = [];
let currentQuestionIndex = 0;
let score = 0;
let quizContainer = null;
let selectedOption = null;
let errorClearTimer = null;
// --- Core Functions ---

// Creates the "Generate Quiz" button on the YouTube page.
function createQuizButton() {
  if (document.getElementById('yt-quiz-button')) {
    return;
  }

  const button = document.createElement('button');
  button.innerHTML = '🧠 Generate Quiz';
  button.id = 'yt-quiz-button';
  
  // Styling for the button
  Object.assign(button.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '9999',
    backgroundColor: '#ff0000', 
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s ease-in-out',
  });
  
  button.onmouseover = () => button.style.transform = 'scale(1.05)';
  button.onmouseout = () => button.style.transform = 'scale(1)';


  document.body.appendChild(button);
  button.addEventListener('click', () => handleQuizGeneration('fast'));
}

/**
 * Handles the logic for requesting a quiz from the background script.
 * @param {string} method - The transcript method ('fast' or 'whisper').
 */
function handleQuizGeneration(method) {
  const button = document.getElementById('yt-quiz-button');
  button.innerHTML = 'Working... 🧠';
  button.disabled = true;

  try {
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId) throw new Error("Could not find YouTube video ID.");

    chrome.runtime.sendMessage({
      type: 'generateQuiz',
      method: method,
      videoId: videoId
    }, (response) => {
      if (chrome.runtime.lastError) {
        showError('An error occurred: ' + chrome.runtime.lastError.message);
        resetButton();
      } else if (response.status === 'success') {
        button.style.display = 'none'; // Hide generate button
        displayQuiz(response.data);
      } else if (response.status === 'fallback') {
        button.innerHTML = 'Transcript not found. Try AI? (Slower)';
        button.disabled = false;
        button.onclick = () => handleQuizGeneration('ai');
      } else {
        showError('Failed to generate quiz: ' + response.message);
        resetButton();
      }
    });
  } catch (error) {
    showError('An error occurred: ' + error.message);
    resetButton();
  }
}

/**
 * Injects the quiz HTML into the page and starts the quiz.
 * @param {Array} data - The array of quiz questions and answers.
 */
async function displayQuiz(data) {
  if (!data || data.length === 0) {
      showError("The generated quiz was empty.");
      resetButton();
      return;
  }
  
  quizData = data;
  currentQuestionIndex = 0;
  score = 0;

  // Fetch the quiz HTML template
  const quizHtmlUrl = chrome.runtime.getURL('quiz.html');
  const response = await fetch(quizHtmlUrl);
  const quizHtml = await response.text();

  // Create and inject the container
  quizContainer = document.createElement('div');
  quizContainer.innerHTML = quizHtml;
  document.body.appendChild(quizContainer);

  setupQuizListeners();
  showQuestion(currentQuestionIndex);
}


// --- Quiz UI and Logic ---

// Sets up event listeners for the quiz buttons.
function setupQuizListeners() {
  // Use querySelector on the container to avoid conflicts
  const query = (selector) => quizContainer.querySelector(selector);

  query('#yt-quiz-close').addEventListener('click', closeQuiz);
  query('#yt-quiz-submit').addEventListener('click', handleSubmit);
  query('#yt-quiz-next').addEventListener('click', handleNext);
  query('#yt-quiz-restart').addEventListener('click', handleRestart);

  query('#yt-quiz-options').addEventListener('click', (e) => {
    if (e.target.classList.contains('yt-quiz-option')) {
      handleOptionSelect(e.target);
    }
  });
}

/**
 * Displays a specific question by its index.
 * @param {number} index - The index of the question in the quizData array.
 */
function showQuestion(index) {
  const query = (selector) => quizContainer.querySelector(selector);
  const queryAll = (selector) => quizContainer.querySelectorAll(selector);
  
  const questionData = quizData[index];
  
  // Reset state
  selectedOption = null;
  query('#yt-quiz-feedback').classList.add('hidden');
  query('#yt-quiz-submit').classList.remove('hidden');
  query('#yt-quiz-next').classList.add('hidden');
  query('#yt-quiz-submit').disabled = true;

  // Populate question and options
  query('#yt-quiz-question').textContent = questionData.question;
  const optionButtons = queryAll('.yt-quiz-option'); 

  optionButtons.forEach(button => {
    const optionKey = button.dataset.option;
    if (questionData.options && questionData.options[optionKey]) {
      button.textContent = `${optionKey}) ${questionData.options[optionKey]}`;
      button.classList.remove('selected', 'correct', 'incorrect', 'hidden');
      button.disabled = false;
    } else {
      // Hide button if option doesn't exist for this question
      button.classList.add('hidden');
    }
  });
}

function handleOptionSelect(button) {
  const queryAll = (selector) => quizContainer.querySelectorAll(selector);
  selectedOption = button;
  
  queryAll('.yt-quiz-option').forEach(btn => btn.classList.remove('selected'));
  button.classList.add('selected');
  
  quizContainer.querySelector('#yt-quiz-submit').disabled = false;
}

function handleSubmit() {
    if (!selectedOption) return;

    const query = (selector) => quizContainer.querySelector(selector);
    const queryAll = (selector) => quizContainer.querySelectorAll(selector);
    const feedback = query('#yt-quiz-feedback');
    const correctAnswer = quizData[currentQuestionIndex].correctAnswer;
    const selectedAnswer = selectedOption.dataset.option;

    // Disable all options
    queryAll('.yt-quiz-option').forEach(btn => btn.disabled = true);

    // Provide feedback
    if (selectedAnswer === correctAnswer) {
        score++;
        selectedOption.classList.add('correct');
        feedback.textContent = "Correct!";
        feedback.className = 'correct-feedback';
    } else {
        selectedOption.classList.add('incorrect');
        feedback.textContent = `Incorrect. The right answer was ${correctAnswer}.`;
        feedback.className = 'incorrect-feedback';
        
        // Also highlight the correct answer
        const correctButton = query(`.yt-quiz-option[data-option="${correctAnswer}"]`);
        if(correctButton) correctButton.classList.add('correct');
    }

    // Toggle navigation buttons
    query('#yt-quiz-submit').classList.add('hidden');
    query('#yt-quiz-next').classList.remove('hidden');

    // Check if it's the last question
    if (currentQuestionIndex >= quizData.length - 1) {
        query('#yt-quiz-next').textContent = "Show Results";
    }
}


function handleNext() {
  currentQuestionIndex++;
  if (currentQuestionIndex < quizData.length) {
    showQuestion(currentQuestionIndex);
  } else {
    showResults();
  }
}

function showResults() {
  const query = (selector) => quizContainer.querySelector(selector);
  query('#yt-quiz-question-area').classList.add('hidden');
  query('#yt-quiz-navigation').classList.add('hidden');
  
  const resultsArea = query('#yt-quiz-results');
  resultsArea.classList.remove('hidden');
  
  query('#yt-quiz-score').textContent = score;
  query('#yt-quiz-total').textContent = quizData.length;
}

function handleRestart() {
    const query = (selector) => quizContainer.querySelector(selector);
    score = 0;
    currentQuestionIndex = 0;
    
    query('#yt-quiz-results').classList.add('hidden');
    query('#yt-quiz-question-area').classList.remove('hidden');
    query('#yt-quiz-navigation').classList.remove('hidden');
    query('#yt-quiz-next').textContent = "Next Question";

    showQuestion(currentQuestionIndex);
}

function closeQuiz() {
  if (quizContainer) {
    document.body.removeChild(quizContainer);
    quizContainer = null;
  }
  resetButton(true); // Show the generate button again
}


// --- Utility Functions ---

/**
 * Resets the state of the "Generate Quiz" button.
 * @param {boolean} shouldShow - If the button should be made visible.
 */
function resetButton(shouldShow = false) {
  const button = document.getElementById('yt-quiz-button');
  if (button) {
    button.innerHTML = '🧠 Generate Quiz';
    button.disabled = false;
    button.onclick = () => handleQuizGeneration('fast');
    if (shouldShow) {
        button.style.display = 'block';
    }
  }
}

/**
 * Shows an error message to the user. Replaces alert().
 */
function showError(message) {
    // Clear any existing timer to prevent the old timeout from firing
    if (errorClearTimer) {
        clearTimeout(errorClearTimer);
    }

    let errorBox = document.getElementById('yt-quiz-error-box');
    if (!errorBox) {
        errorBox = document.createElement('div');
        errorBox.id = 'yt-quiz-error-box';
        Object.assign(errorBox.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '10001',
            backgroundColor: '#dc3545',
            color: 'white',
            padding: '15px',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            fontSize: '16px',
        });
        document.body.appendChild(errorBox);
    }
    errorBox.textContent = message;

    // Set a new timer to remove the error box
    errorClearTimer = setTimeout(() => {
        // Before removing, check if the element is still in the document
        if (errorBox && document.body.contains(errorBox)) {
            document.body.removeChild(errorBox);
        }
    }, 5000); 
}
// --- Page Load Logic ---

/**
 * Observes page changes to inject the button on navigation.
 */
const observePage = () => {
  if (window.location.pathname === '/watch') {
    // A small delay ensures the page is ready
    setTimeout(createQuizButton, 1000);
  }
};

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.target.nodeName === 'TITLE') {
      observePage();
      break;
    }
  }
});

const titleElement = document.querySelector('head > title');
if (titleElement) {
  observer.observe(titleElement, { childList: true });
}

observePage();
