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
  button.innerHTML = `
    <span class="yt-quiz-button-text">🧠 Generate Quiz</span>
    <div class="yt-quiz-progress-bar"></div>
  `;
  button.id = 'yt-quiz-button';
  button.classList.add('yt-quiz-generate-button');
  
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
  button.addEventListener('click', () => handleQuizGeneration());
}

/**
 * Handles the logic for requesting a quiz from the background script.
 */
function handleQuizGeneration() {
  const button = document.getElementById('yt-quiz-button');
  const buttonText = button.querySelector('.yt-quiz-button-text');
  
  button.classList.add('loading');
  buttonText.textContent = 'Working... 🧠';
  button.disabled = true;

  try {
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId) throw new Error("Could not find YouTube video ID.");

    chrome.runtime.sendMessage({
      type: 'generateQuiz',
      videoId: videoId
    }, (response) => {
      if (chrome.runtime.lastError) {
        showError('An error occurred: ' + chrome.runtime.lastError.message);
        resetButton();
      } else if (response.status === 'success') {
        button.style.display = 'none';
        displayQuiz(response.data);
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
  
  // If a quiz is already open, remove it before creating a new one.
  if (document.getElementById('yt-quiz-container')) {
    closeQuiz();
  }

  quizData = data;
  currentQuestionIndex = 0;
  score = 0;

  const quizHtmlUrl = chrome.runtime.getURL('quiz.html');
  const response = await fetch(quizHtmlUrl);
  const quizHtml = await response.text();

  // Create a temporary div to inject the HTML into the body safely
  const tempWrapper = document.createElement('div');
  tempWrapper.innerHTML = quizHtml;
  // Append the actual quiz container from the HTML, not the wrapper
  document.body.appendChild(tempWrapper.firstElementChild);

  // Now that it's in the DOM, find it by its ID to ensure we have the correct element.
  quizContainer = document.getElementById('yt-quiz-container');
  if (!quizContainer) {
    showError("Failed to initialize the quiz container.");
    return;
  }

  setupQuizListeners();
  showQuestion(currentQuestionIndex);
}

// --- Quiz UI and Logic ---

// Sets up event listeners for the quiz buttons.
function setupQuizListeners() {
  const query = (selector) => quizContainer.querySelector(selector);

  // Add listeners for BOTH close buttons
  query('#yt-quiz-x-close').addEventListener('click', closeQuiz);
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

  query('#yt-quiz-question').textContent = questionData.question;
  const optionButtons = queryAll('.yt-quiz-option'); 

  optionButtons.forEach(button => {
    const optionKey = button.dataset.option;
    if (questionData.options && questionData.options[optionKey]) {
      button.textContent = `${optionKey}) ${questionData.options[optionKey]}`;
      button.classList.remove('selected', 'correct', 'incorrect', 'hidden');
      button.disabled = false;
    } else {
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

    queryAll('.yt-quiz-option').forEach(btn => btn.disabled = true);

    if (selectedAnswer === correctAnswer) {
        score++;
        selectedOption.classList.add('correct');
        feedback.textContent = "Correct!";
        feedback.className = 'correct-feedback';
    } else {
        selectedOption.classList.add('incorrect');
        feedback.textContent = `Incorrect. The right answer was ${correctAnswer}.`;
        feedback.className = 'incorrect-feedback';
        
        const correctButton = query(`.yt-quiz-option[data-option="${correctAnswer}"]`);
        if(correctButton) correctButton.classList.add('correct');
    }

    query('#yt-quiz-submit').classList.add('hidden');
    query('#yt-quiz-next').classList.remove('hidden');

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

// **FIXED** This function is now more robust.
function closeQuiz() {
  // Always find the element by its ID before trying to remove it.
  const container = document.getElementById('yt-quiz-container');
  if (container) {
    container.remove();
  }
  quizContainer = null; // Reset the global variable
  resetButton(true);
}

// --- Utility Functions ---

/**
 * Resets the state of the "Generate Quiz" button.
 * @param {boolean} shouldShow - If the button should be made visible.
 */
function resetButton(shouldShow = false) {
  const button = document.getElementById('yt-quiz-button');
  if (button) {
    const buttonText = button.querySelector('.yt-quiz-button-text');
    button.classList.remove('loading');
    if (buttonText) {
        buttonText.textContent = '🧠 Generate Quiz';
    }
    button.disabled = false;
    button.onclick = () => handleQuizGeneration();
    if (shouldShow) {
        button.style.display = 'block';
    }
  }
}

/**
 * Shows an error message to the user.
 */
function showError(message) {
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

    errorClearTimer = setTimeout(() => {
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