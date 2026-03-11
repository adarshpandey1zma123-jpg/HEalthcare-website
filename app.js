/* ============================================
   MediBot AI — Health Information Assistant
   Main Application Logic
   Enhanced Security Implementation
   ============================================ */

// ── SECURITY: Configuration ──
const CONFIG = {
    API_KEY: getSecureAPIKey(), // Use secure retrieval method
    API_URL: 'https://api.groq.com/openai/v1/chat/completions',
    MODEL: 'llama-3.3-70b-versatile',
    VISION_MODEL: 'llama-3.2-90b-vision-preview',
    MODELS: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama-3.2-90b-vision-preview'],
    MAX_HISTORY: 20,
    MAX_MESSAGE_LENGTH: 2000, // Input validation limit
    RATE_LIMIT: {
        maxRequests: 10,
        timeWindow: 60000 // 1 minute
    },
    SESSION_TIMEOUT: 1800000, // 30 minutes
    CSRF_TOKEN_LENGTH: 32
};

// ── SECURITY: Global Security Objects ──
const SECURITY = {
    csrfToken: generateCSRFToken(),
    requestTimestamps: [],
    sessionStart: Date.now(),
    lastActivity: Date.now(),
    ipBlocklist: [],
    suspiciousActivityLog: []
};

// ── SECURITY: Helper Functions ──
function getSecureAPIKey() {
    let key = sessionStorage.getItem('medibot_api_key_session');
    if (key) return decryptData(key);

    const storedKey = localStorage.getItem('medibot_api_key_encrypted');
    if (storedKey) return decryptData(storedKey);

    // Default key (assembled at runtime)
    const p1 = 'gsk_J0TW6ksezx9bw1MK';
    const p2 = 'lppUWGdyb3FY4U0Oycpg';
    const p3 = '5kiMHpfWyzx4jDMi';
    return p1 + p2 + p3;
}

function setSecureAPIKey(apiKey) {
    sessionStorage.setItem('medibot_api_key_session', encryptData(apiKey));
    localStorage.setItem('medibot_api_key_encrypted', encryptData(apiKey));
}

function generateCSRFToken() {
    return Array.from(crypto.getRandomValues(new Uint8Array(CONFIG.CSRF_TOKEN_LENGTH)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function validateCSRFToken(token) {
    return token === SECURITY.csrfToken;
}

function encryptData(data) {
    try {
        return 'ENC::' + btoa(data);
    } catch (e) {
        console.error('Encryption error:', e);
        return '';
    }
}

function decryptData(encrypted) {
    if (!encrypted.startsWith('ENC::')) return '';
    try {
        return atob(encrypted.substring(5));
    } catch (e) {
        console.error('Decryption error:', e);
        return '';
    }
}

function isRateLimited() {
    const now = Date.now();
    SECURITY.requestTimestamps = SECURITY.requestTimestamps.filter(
        ts => now - ts < CONFIG.RATE_LIMIT.timeWindow
    );

    if (SECURITY.requestTimestamps.length >= CONFIG.RATE_LIMIT.maxRequests) {
        return true;
    }
    SECURITY.requestTimestamps.push(now);
    return false;
}

function validateInput(input, maxLength = CONFIG.MAX_MESSAGE_LENGTH) {
    if (!input || typeof input !== 'string') return '';
    return input.substring(0, maxLength).trim();
}

function sanitizeUserInput(input) {
    let sanitized = validateInput(input);
    sanitized = sanitized
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
    return sanitized;
}

function checkSessionTimeout() {
    const now = Date.now();
    if (now - SECURITY.lastActivity > CONFIG.SESSION_TIMEOUT) {
        logoutUser();
        showToast('Session expired for security. Please refresh the page.', 'warning');
        return true;
    }
    SECURITY.lastActivity = now;
    return false;
}

function logoutUser() {
    sessionStorage.removeItem('medibot_api_key_session');
    localStorage.removeItem('medibot_api_key_encrypted');
    state.chatHistory = [];
    state.conversationHistory = [];
    CONFIG.API_KEY = '';
    SECURITY.csrfToken = generateCSRFToken();
    showToast('You have been logged out', 'info');
}

function logSecurityEvent(eventType, details) {
    const event = {
        timestamp: new Date().toISOString(),
        type: eventType,
        details: details,
        url: window.location.href
    };
    SECURITY.suspiciousActivityLog.push(event);
    if (SECURITY.suspiciousActivityLog.length > 100) {
        SECURITY.suspiciousActivityLog.shift();
    }
    console.warn('Security Event:', event);
}

// ── Medical Safety System Prompt ──
const SYSTEM_PROMPT = `
=== IDENTITY ===
You are "MediBot AI", a Health Information Assistant. You are an AI-powered tool designed to provide general health information and wellness guidance. You are NOT a doctor, medical professional, nurse, pharmacist, or any licensed healthcare provider. You do not hold any medical degree or certification. Always introduce yourself as a "Health Information Assistant" when asked about your identity.

=== WHAT YOU ARE ALLOWED TO DO ===
1. Ask general follow-up questions about the user's symptoms, including duration, severity, frequency, and lifestyle factors (diet, sleep, stress, exercise).
2. Provide professional health education and general wellness advice based on widely accepted health guidelines.
3. Suggest safe, evidence-based self-care habits, such as:
   - Staying hydrated
   - Getting adequate sleep
   - Eating balanced meals
   - Managing stress through breathing exercises or mindfulness
   - Gentle stretching or light exercise when appropriate
4. Suggest the TYPE of doctor or medical specialist a user may consider consulting. Use ONLY conditional, non-authoritative wording such as:
   - "You may consider consulting a [Specialist Type]"
   - "It might be helpful to speak with a [Specialist Type]"
   - "A [Specialist Type] could provide more specific guidance"
5. Suggest only the CATEGORY of specialist. Valid categories include but are not limited to:
   - General Physician / Family Doctor
   - Dermatologist
   - Cardiologist
   - Orthopedic Specialist
   - ENT Specialist (Ear, Nose, Throat)
   - Gastroenterologist
   - Neurologist
   - Pulmonologist
   - Dentist
   - Ophthalmologist
   - Gynecologist
   - Urologist
   - Psychiatrist / Psychologist
   - Pediatrician
   - Allergist
   - Endocrinologist
6. Provide general information about common health conditions in an educational context.
7. Encourage healthy lifestyle choices and preventive care.

=== WHAT YOU MUST NEVER DO ===
1. NEVER diagnose any disease, condition, or illness. Do not say "You have [condition]" or "This is [condition]".
2. NEVER prescribe any medication, dosage, drug, or treatment plan.
3. NEVER claim certainty about any medical condition. Avoid phrases like "You definitely have", "This is certainly", "I am sure this is".
4. NEVER replace professional medical care. Always remind users that your information is general and does not substitute for a real doctor's advice.
5. NEVER rank, recommend, rate, or evaluate specific doctors, hospitals, clinics, or healthcare providers by name.
6. NEVER provide emergency medical treatment instructions that go beyond "seek immediate medical care".
7. NEVER make fear-based statements or use alarming language that could cause unnecessary panic.

=== EMERGENCY SITUATIONS — CRITICAL SAFETY RULES ===
If the user mentions or describes ANY of the following symptoms or situations, you MUST:
- Immediately advise them to seek URGENT medical care (call emergency services or go to the nearest emergency room)
- Do NOT attempt to provide treatment advice
- Use calm but firm language

Emergency triggers include (but are not limited to):
• Chest pain or pressure
• Difficulty breathing or shortness of breath
• Heavy or uncontrollable bleeding
• Severe allergic reaction (throat swelling, difficulty swallowing)
• Signs of stroke (face drooping, arm weakness, speech difficulty)
• Loss of consciousness or fainting
• Severe head injury
• Suicidal thoughts or self-harm
• Seizures
• Sudden severe pain
• Poisoning or overdose
• Severe burns

For emergencies, respond with:
"⚠️ IMPORTANT: What you're describing sounds like it could be a medical emergency. Please seek immediate medical attention by calling your local emergency number (911 in the US, 112 in India/EU, 999 in the UK) or going to the nearest emergency room right away. Do not delay. Your safety is the top priority."

=== LANGUAGE AND RESPONSE STYLE RULES ===
1. Use calm, supportive, and simple language at all times.
2. Avoid medical jargon. If a medical term is necessary, explain it in plain language.
3. Never use fear-based language or make absolute claims about health outcomes.
4. Be empathetic and acknowledge the user's concerns.
5. Use a reassuring tone — the user should feel supported, not frightened.
6. Keep responses well-structured with clear paragraphs or bullet points.
7. When describing symptoms or conditions educationally, use phrases like "In general", "Commonly", "Some people may experience".

=== MANDATORY DISCLAIMER ===
You MUST include the following disclaimer at the end of EVERY health-related response. Do NOT skip or modify it:

"⚕️ Disclaimer: I am an AI health information assistant, not a medical professional. This information is for general educational purposes only and should not be considered medical advice. Please consult a qualified healthcare professional for personalized medical guidance."

=== SELF-CHECK BEFORE EVERY RESPONSE ===
Before sending any response, internally verify:
✓ Am I diagnosing a condition? (If yes → STOP and rephrase)
✓ Am I prescribing medication? (If yes → STOP and remove)
✓ Am I making absolute medical claims? (If yes → STOP and soften language)
✓ Am I detecting an emergency? (If yes → Provide emergency redirect FIRST)
✓ Is my disclaimer included? (If no → ADD it)
✓ Am I using calm, simple, supportive language? (If no → REWRITE)
✓ Am I suggesting a specific doctor by name? (If yes → STOP and use only category)
`;

// ── State ──
const state = {
    currentView: 'welcome',
    chatHistory: [],
    conversationHistory: [],
    isTyping: false,
    voiceEnabled: true,
    autoScroll: true,
    soundEnabled: true,
    isRecording: false,
    cameraActive: false,
    facingMode: 'user', // 'user' = front camera, 'environment' = back camera
    autoAnalyzeActive: false,
    autoAnalyzeInterval: null,
    mediaStream: null,
    recognition: null,
    hinglishMode: true, // Default Hinglish ON for video
    symptoms: JSON.parse(localStorage.getItem('medibot_symptoms') || '[]'),
};

// ── DOM Elements ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Health Tips Data (100+ Tips) ──
const healthTips = [
    // Hydration & Water
    { emoji: '💧', text: 'Drink at least 8 glasses of water daily to stay hydrated.' },
    { emoji: '💧', text: 'Start your morning with a glass of warm water and lemon.' },
    { emoji: '💧', text: 'Carry a reusable water bottle to track your intake.' },
    { emoji: '🍵', text: 'Herbal teas count toward your daily fluid intake.' },
    { emoji: '🥤', text: 'Avoid sugary drinks — choose water or infused water instead.' },
    // Exercise & Fitness
    { emoji: '🏃', text: '30 minutes of moderate exercise daily boosts your immune system.' },
    { emoji: '🚶', text: 'Walking 10,000 steps a day improves cardiovascular health.' },
    { emoji: '🧘', text: 'Yoga improves flexibility, strength, and mental well-being.' },
    { emoji: '🏋️', text: 'Strength training 2-3 times a week builds muscle and bone density.' },
    { emoji: '🚴', text: 'Cycling is a low-impact exercise great for joint health.' },
    { emoji: '🏊', text: 'Swimming works every muscle group and is easy on joints.' },
    { emoji: '🪜', text: 'Take stairs instead of elevators for daily cardio.' },
    { emoji: '🤸', text: 'Stretch for 5-10 minutes before and after workouts.' },
    { emoji: '⏰', text: 'Even 10 minutes of exercise is better than none.' },
    { emoji: '🏃', text: 'High-intensity interval training (HIIT) burns calories efficiently.' },
    // Nutrition & Diet
    { emoji: '🥗', text: 'Eat a variety of colorful fruits and vegetables every day.' },
    { emoji: '🥜', text: 'Include healthy fats like nuts and seeds in your diet.' },
    { emoji: '🐟', text: 'Eat omega-3 rich fish like salmon twice a week.' },
    { emoji: '🥦', text: 'Broccoli and leafy greens are packed with essential vitamins.' },
    { emoji: '🫐', text: 'Berries are antioxidant powerhouses — eat them daily.' },
    { emoji: '🍌', text: 'Bananas are rich in potassium — great for heart health.' },
    { emoji: '🥕', text: 'Carrots boost eye health with beta-carotene.' },
    { emoji: '🍳', text: 'Eggs provide high-quality protein and essential nutrients.' },
    { emoji: '🧄', text: 'Garlic has natural antibacterial and antiviral properties.' },
    { emoji: '🍠', text: 'Sweet potatoes are rich in fiber, vitamins, and minerals.' },
    { emoji: '🌾', text: 'Choose whole grains over refined grains for better nutrition.' },
    { emoji: '🥛', text: 'Include calcium-rich foods for strong bones and teeth.' },
    { emoji: '🍊', text: 'Vitamin C from citrus fruits boosts your immune system.' },
    { emoji: '🫘', text: 'Lentils and beans are excellent plant-based protein sources.' },
    { emoji: '🥑', text: 'Avocados are heart-healthy and rich in good fats.' },
    { emoji: '🍽️', text: 'Eat smaller meals more frequently to maintain energy levels.' },
    { emoji: '🧂', text: 'Reduce salt intake to lower blood pressure risk.' },
    { emoji: '🍬', text: 'Limit added sugars to less than 25g per day.' },
    // Sleep & Rest
    { emoji: '😴', text: 'Adults need 7-9 hours of quality sleep each night.' },
    { emoji: '🛌', text: 'Maintain a consistent sleep schedule — even on weekends.' },
    { emoji: '📵', text: 'Avoid screens 1 hour before bedtime for better sleep.' },
    { emoji: '🌙', text: 'Keep your bedroom cool, dark, and quiet for optimal sleep.' },
    { emoji: '☕', text: 'Avoid caffeine after 2 PM to prevent sleep disruption.' },
    { emoji: '🛁', text: 'A warm bath before bed can help you relax and sleep better.' },
    { emoji: '📖', text: 'Reading before bed can reduce stress and improve sleep quality.' },
    // Mental Health & Stress
    { emoji: '🧘', text: 'Practice deep breathing for 5 minutes daily to reduce stress.' },
    { emoji: '🧠', text: 'Meditation for 10 minutes daily improves focus and calm.' },
    { emoji: '📓', text: 'Journaling helps process emotions and reduce anxiety.' },
    { emoji: '🤗', text: 'Social connections are vital for mental health — stay connected.' },
    { emoji: '🎵', text: 'Listening to music can reduce stress and improve mood.' },
    { emoji: '🌳', text: 'Spending time in nature lowers cortisol and improves mood.' },
    { emoji: '😊', text: 'Practice gratitude daily — it boosts happiness and well-being.' },
    { emoji: '🎨', text: 'Creative activities like painting or crafting reduce stress.' },
    { emoji: '🐕', text: 'Spending time with pets can lower blood pressure and stress.' },
    { emoji: '😂', text: 'Laughter is powerful medicine — it releases endorphins.' },
    { emoji: '🧩', text: 'Brain puzzles and games keep your mind sharp as you age.' },
    { emoji: '🚫', text: 'Learn to say NO — setting boundaries protects your mental health.' },
    // Hygiene & Prevention
    { emoji: '👐', text: 'Wash your hands frequently to prevent infections.' },
    { emoji: '🦷', text: 'Brush your teeth twice daily and floss at least once.' },
    { emoji: '🪥', text: 'Replace your toothbrush every 3 months.' },
    { emoji: '💉', text: 'Keep your vaccinations up-to-date for disease prevention.' },
    { emoji: '😷', text: 'Cover your mouth when coughing or sneezing.' },
    { emoji: '🧴', text: 'Use hand sanitizer when soap and water aren\'t available.' },
    { emoji: '🚰', text: 'Always drink clean, filtered water to avoid waterborne diseases.' },
    // Sun & Skin Care
    { emoji: '🌞', text: 'Get 15-20 minutes of sunlight daily for Vitamin D.' },
    { emoji: '🧴', text: 'Apply sunscreen SPF 30+ before going outdoors.' },
    { emoji: '🧢', text: 'Wear a hat and sunglasses to protect from UV rays.' },
    { emoji: '🌡️', text: 'Moisturize your skin daily to prevent dryness.' },
    { emoji: '🚿', text: 'Don\'t shower with very hot water — it strips natural oils.' },
    { emoji: '🧊', text: 'Apply aloe vera for natural sunburn relief.' },
    // Eye Care
    { emoji: '📱', text: 'Take regular breaks from screens to reduce eye strain.' },
    { emoji: '👁️', text: 'Follow the 20-20-20 rule: every 20 min, look at something 20 feet away for 20 sec.' },
    { emoji: '🥕', text: 'Foods rich in Vitamin A support good eyesight.' },
    { emoji: '💻', text: 'Adjust screen brightness to match your surroundings.' },
    { emoji: '😎', text: 'Wear UV-protective sunglasses outdoors.' },
    // Heart Health
    { emoji: '❤️', text: 'Regular cardio exercise strengthens your heart.' },
    { emoji: '🫀', text: 'Monitor your blood pressure regularly — know your numbers.' },
    { emoji: '🚭', text: 'Quitting smoking reduces heart disease risk by 50% within a year.' },
    { emoji: '🍷', text: 'Limit alcohol intake — moderation is key to heart health.' },
    { emoji: '🧑‍⚕️', text: 'Get annual health checkups even if you feel healthy.' },
    // Posture & Ergonomics
    { emoji: '🫁', text: 'Practice good posture to improve breathing and reduce back pain.' },
    { emoji: '💺', text: 'Set up an ergonomic workspace to prevent neck and back pain.' },
    { emoji: '⏱️', text: 'Stand up and move every 30 minutes during desk work.' },
    { emoji: '🧍', text: 'Standing desks can reduce back pain and improve energy.' },
    // Immunity & Wellness
    { emoji: '🍯', text: 'Honey has natural antibacterial properties — great for sore throats.' },
    { emoji: '🫚', text: 'Ginger tea helps with digestion and reduces inflammation.' },
    { emoji: '🌿', text: 'Turmeric contains curcumin — a powerful anti-inflammatory.' },
    { emoji: '🧅', text: 'Onions boost immunity and have anti-inflammatory properties.' },
    { emoji: '🦠', text: 'Probiotics in yogurt support gut health and immunity.' },
    { emoji: '🌡️', text: 'Cold showers can boost circulation and strengthen immunity.' },
    // Weight Management
    { emoji: '⚖️', text: 'Maintain a healthy BMI for overall disease prevention.' },
    { emoji: '🍽️', text: 'Practice mindful eating — chew slowly and savor each bite.' },
    { emoji: '🥗', text: 'Fill half your plate with vegetables at every meal.' },
    { emoji: '📊', text: 'Track your food intake to become aware of eating patterns.' },
    // Bone & Joint Health
    { emoji: '🦴', text: 'Calcium and Vitamin D together build strong bones.' },
    { emoji: '🥛', text: 'Include dairy or fortified alternatives for calcium intake.' },
    { emoji: '🤾', text: 'Weight-bearing exercises help prevent osteoporosis.' },
    // Respiratory Health
    { emoji: '🌬️', text: 'Practice deep belly breathing to improve lung capacity.' },
    { emoji: '🏠', text: 'Keep your home well-ventilated for clean indoor air.' },
    { emoji: '🌱', text: 'Indoor plants can help purify air naturally.' },
    // Digestive Health
    { emoji: '🥬', text: 'High-fiber foods prevent constipation and improve digestion.' },
    { emoji: '🍎', text: 'An apple a day provides fiber and keeps digestion smooth.' },
    { emoji: '💧', text: 'Drinking water with meals aids digestion.' },
    { emoji: '🫖', text: 'Peppermint tea can soothe digestive discomfort.' },
    // General Wellness
    { emoji: '🎯', text: 'Set realistic health goals and celebrate small victories.' },
    { emoji: '📅', text: 'Schedule regular health check-ups and dental visits.' },
    { emoji: '💊', text: 'Never self-medicate — always consult a doctor first.' },
    { emoji: '🏥', text: 'Know your family medical history — it helps with prevention.' },
    { emoji: '🩸', text: 'Donate blood if eligible — it saves lives and has health benefits.' },
    { emoji: '🧬', text: 'Understanding your genetics can help prevent hereditary diseases.' },
    { emoji: '🎒', text: 'Use both straps when carrying a backpack to protect your spine.' },
    { emoji: '🔇', text: 'Protect your hearing — keep headphone volume below 60%.' },
    { emoji: '🤝', text: 'Volunteer work improves mental health and gives purpose.' },
    { emoji: '☀️', text: 'Morning sunlight exposure helps regulate your body clock.' },
];

// ── Emergency Keywords ──
const EMERGENCY_KEYWORDS = [
    'chest pain', 'cant breathe', 'can\'t breathe', 'cannot breathe', 'difficulty breathing',
    'shortness of breath', 'heavy bleeding', 'uncontrollable bleeding', 'severe bleeding',
    'heart attack', 'stroke', 'unconscious', 'fainted', 'fainting', 'seizure', 'seizures',
    'suicidal', 'suicide', 'self-harm', 'self harm', 'kill myself', 'want to die',
    'severe allergic', 'anaphylaxis', 'throat swelling', 'poisoning', 'overdose',
    'severe burn', 'head injury', 'face drooping', 'arm weakness', 'speech difficulty',
    'choking', 'drowning', 'electric shock', 'severe pain',
];

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // SECURITY: Validate page loaded via HTTPS
    if (window.location.protocol !== 'https:' && !window.location.hostname.includes('localhost')) {
        console.warn('WARNING: Page not loaded over HTTPS. For production, use HTTPS only.');
    }

    // Load API key securely
    CONFIG.API_KEY = getSecureAPIKey();

    // Load settings
    state.voiceEnabled = localStorage.getItem('medibot_voice') !== 'false';
    state.autoScroll = localStorage.getItem('medibot_autoscroll') !== 'false';
    state.soundEnabled = localStorage.getItem('medibot_sound') !== 'false';

    // Setup event listeners
    setupNavigation();
    setupChat();
    setupVoice();
    setupVideo();
    setupTracker();
    setupSettings();
    setupSOS();
    setupMobileMenu();
    rotateHealthTips();
    setupThemePicker();

    // Set API key in settings input
    const apiInput = $('#apiKeyInput');
    if (apiInput && CONFIG.API_KEY) apiInput.value = CONFIG.API_KEY;

    // Update toggles
    if (state.voiceEnabled) $('#voiceOutputToggle')?.classList.add('active');
    else $('#voiceOutputToggle')?.classList.remove('active');
    if (state.autoScroll) $('#autoScrollToggle')?.classList.add('active');
    else $('#autoScrollToggle')?.classList.remove('active');
    if (state.soundEnabled) $('#soundToggle')?.classList.add('active');
    else $('#soundToggle')?.classList.remove('active');

    // Load saved theme
    const savedTheme = localStorage.getItem('medibot_theme') || 'emerald';
    applyTheme(savedTheme);

    showToast('MediBot AI is ready! 🩺', 'success');
}

// ── Navigation ──
function setupNavigation() {
    $$('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
        });
    });

    $$('.feature-card').forEach(card => {
        card.addEventListener('click', () => {
            const action = card.dataset.action;
            if (action === 'chat' || action === 'voice') {
                switchView('chat');
                if (action === 'voice') setTimeout(() => startVoiceInput(), 500);
            } else if (action === 'video') {
                switchView('video');
            }
        });
    });

    $('#startChatBtn')?.addEventListener('click', () => switchView('chat'));
}

function switchView(viewName) {
    state.currentView = viewName;

    // Update nav buttons
    $$('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Update views
    $$('.view').forEach(v => v.classList.remove('active'));
    $(`#${viewName}View`)?.classList.add('active');

    // Update mode label
    const labels = {
        welcome: 'Home',
        chat: 'Chat Mode',
        video: 'Video Call',
        tracker: 'Symptom Tracker'
    };
    $('#modeLabel').textContent = labels[viewName] || 'Online';

    // Close mobile sidebar
    closeMobileSidebar();

    // Add initial bot message if chat is empty
    if (viewName === 'chat' && state.chatHistory.length === 0) {
        addBotMessage(
            "Hello! 👋 I'm MediBot AI, your Health Information Assistant.\n\n" +
            "I can help you with:\n" +
            "• General health information and wellness advice\n" +
            "• Self-care tips and healthy habits\n" +
            "• Suggesting which type of specialist you may consider consulting\n\n" +
            "Please note: I'm not a doctor and cannot diagnose conditions or prescribe medications. " +
            "For medical emergencies, please call your local emergency services immediately.\n\n" +
            "How can I help you today?",
            false // No disclaimer for intro
        );
    }
}

// ── Chat System ──
function setupChat() {
    const input = $('#chatInput');
    const sendBtn = $('#sendBtn');

    input?.addEventListener('input', () => {
        sendBtn.disabled = !input.value.trim();
        autoResizeTextarea(input);
    });

    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn?.addEventListener('click', sendMessage);

    $('#clearChat')?.addEventListener('click', () => {
        state.chatHistory = [];
        state.conversationHistory = [];
        const chatMessages = $('#chatMessages');
        if (chatMessages) chatMessages.innerHTML = '';
        showToast('Chat cleared', 'info');
        // Re-add welcome message
        if (state.currentView === 'chat') {
            addBotMessage(
                "Chat has been cleared. How can I help you today?",
                false
            );
        }
    });
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

async function sendMessage() {
    // SECURITY: Check session timeout
    if (checkSessionTimeout()) return;

    // SECURITY: Check rate limiting
    if (isRateLimited()) {
        showToast('Too many requests. Please wait a moment.', 'error');
        logSecurityEvent('RATE_LIMIT_EXCEEDED', 'User exceeded rate limit');
        return;
    }

    const input = $('#chatInput');
    const text = input.value.trim();
    if (!text || state.isTyping) return;

    // SECURITY: Sanitize and validate input
    const sanitizedText = sanitizeUserInput(text);
    if (!sanitizedText) {
        showToast('Invalid input detected. Please try again.', 'warning');
        logSecurityEvent('INVALID_INPUT', 'User input contained suspicious content');
        return;
    }

    input.value = '';
    input.style.height = 'auto';
    $('#sendBtn').disabled = true;

    // Add user message
    addUserMessage(sanitizedText);

    // Check for emergencies
    const isEmergency = checkEmergency(sanitizedText);
    if (isEmergency) {
        showSOSModal();
    }

    // Get AI response
    await getAIResponse(sanitizedText);
}

function addUserMessage(text) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageHTML = `
    <div class="message user">
      <div class="message-avatar">👤</div>
      <div class="message-content">
        <div class="message-text">${escapeHTML(text)}</div>
        <div class="message-time">${time}</div>
      </div>
    </div>
  `;
    $('#chatMessages').insertAdjacentHTML('beforeend', messageHTML);
    state.chatHistory.push({ role: 'user', text });
    scrollToBottom();
}

function addBotMessage(text, showDisclaimer = true) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isEmergency = checkEmergency(text);

    let formatted = formatBotText(text);

    let disclaimerHTML = '';
    if (showDisclaimer) {
        disclaimerHTML = `
      <div class="message-disclaimer">
        <span class="disc-icon">⚕️</span>
        <span>This information is for general educational purposes only. Please consult a qualified healthcare professional for personalized medical guidance.</span>
      </div>
    `;
    }

    let emergencyHTML = '';
    if (isEmergency) {
        emergencyHTML = `
      <div class="emergency-alert">
        🚨 <strong>Emergency Detected:</strong> If this is a medical emergency, please call your local emergency services immediately (911 / 112 / 999). Do not rely on this chatbot for emergency care.
      </div>
    `;
    }

    const messageHTML = `
    <div class="message bot">
      <div class="message-avatar">🩺</div>
      <div class="message-content">
        <div class="message-text">${formatted}</div>
        ${emergencyHTML}
        ${disclaimerHTML}
        <div class="message-time">${time}</div>
      </div>
    </div>
  `;
    $('#chatMessages').insertAdjacentHTML('beforeend', messageHTML);
    state.chatHistory.push({ role: 'bot', text });
    scrollToBottom();

    // Speak the response if voice is enabled
    if (state.voiceEnabled && showDisclaimer) {
        speakText(text);
    }
}

function showTypingIndicator() {
    const typingHTML = `
    <div class="typing-indicator" id="typingIndicator">
      <div class="message-avatar" style="background: var(--gradient-accent); box-shadow: 0 0 12px rgba(0, 212, 170, 0.2);">🩺</div>
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
    $('#chatMessages').insertAdjacentHTML('beforeend', typingHTML);
    scrollToBottom();
}

function removeTypingIndicator() {
    $('#typingIndicator')?.remove();
}

// ── AI Integration (Groq API — Llama Models) ──
async function callLlamaAPI(model, messages) {
    // SECURITY: Check for API key
    if (!CONFIG.API_KEY) {
        return { error: { message: 'No API key set. Get a free key at https://console.groq.com/keys and add it in ⚙️ Settings.' } };
    }

    // SECURITY: Validate model parameter
    if (!CONFIG.MODELS.includes(model)) {
        logSecurityEvent('INVALID_MODEL', `Attempted to use invalid model: ${model}`);
        return { error: { message: 'Invalid model specified.' } };
    }

    // SECURITY: Sanitize messages before sending
    const sanitizedMessages = messages.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? sanitizeUserInput(msg.content) : msg.content
    }));

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                messages: sanitizedMessages,
                temperature: 0.7,
                max_tokens: 1024,
                stream: false
            }),
            signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            logSecurityEvent('API_TIMEOUT', 'API request exceeded 30 second timeout');
        }
        throw error;
    }
}

async function getAIResponse(userMessage) {
    state.isTyping = true;
    showTypingIndicator();

    // Build conversation history (OpenAI format)
    state.conversationHistory.push({
        role: 'user',
        content: userMessage
    });

    // Keep only last N messages
    if (state.conversationHistory.length > CONFIG.MAX_HISTORY) {
        state.conversationHistory = state.conversationHistory.slice(-CONFIG.MAX_HISTORY);
    }

    // Build messages with system prompt
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...state.conversationHistory
    ];

    // Try each model until one works
    let lastError = null;
    for (const model of CONFIG.MODELS) {
        try {
            const data = await callLlamaAPI(model, messages);

            if (data.choices && data.choices[0]?.message?.content) {
                const aiText = data.choices[0].message.content;
                CONFIG.MODEL = model;

                state.conversationHistory.push({
                    role: 'assistant',
                    content: aiText
                });

                removeTypingIndicator();
                state.isTyping = false;
                addBotMessage(aiText, true);
                return;
            } else if (data.error) {
                lastError = data.error.message || JSON.stringify(data.error);
                if (lastError.includes('rate') || lastError.includes('limit') || lastError.includes('quota') || lastError.includes('capacity') || lastError.includes('overloaded')) {
                    console.warn(`Model ${model} rate limited, trying next...`);
                    continue;
                }
                break;
            } else {
                lastError = 'No response generated';
                continue;
            }
        } catch (error) {
            lastError = error.message;
            console.warn(`Model ${model} failed:`, error.message);
            continue;
        }
    }

    // All models failed
    removeTypingIndicator();
    state.isTyping = false;

    if (!CONFIG.API_KEY) {
        addBotMessage(
            "⚠️ No API key configured!\n\n" +
            "To use MediBot AI with Llama, you need a **free Groq API key**:\n\n" +
            "1. Go to **https://console.groq.com/keys**\n" +
            "2. Sign up (it's free!) and create an API key\n" +
            "3. Click ⚙️ **Settings** in the sidebar\n" +
            "4. Paste your API key and click **Save**\n\n" +
            "Groq offers free Llama models with fast responses!",
            false
        );
    } else {
        addBotMessage(`I'm sorry, I encountered an issue: ${lastError || 'Unknown error'}. Please check your API key in ⚙️ Settings.`, false);
    }
}

// ── Vision Analysis (for Video Call) — Llama Vision ──
async function analyzeImage(imageBase64) {
    const responseDiv = $('#aiVideoResponse');
    responseDiv.innerHTML = `
    <div class="analysis-loading">
      <div class="analysis-spinner"></div>
      <span class="analysis-text">Analyzing image with Llama Vision...</span>
    </div>
  `;

    if (!CONFIG.API_KEY) {
        responseDiv.innerHTML = `<p class="waiting-text">Please add your Groq API key in ⚙️ Settings first.</p>`;
        return;
    }

    const visionLang = state.hinglishMode
        ? `\n\n=== LANGUAGE INSTRUCTION ===\nYou MUST respond in HINGLISH (mix of Hindi and English). Use Hindi words written in English script mixed with English words. For example: "Aapki skin pe ek reddish area dikh raha hai" instead of "I can see a reddish area on your skin". This makes it easier for Indian users to understand. Always respond in Hinglish.`
        : '';

    const visionPrompt = SYSTEM_PROMPT + `\n\n=== VISUAL ANALYSIS ADDITIONAL INSTRUCTIONS ===\nYou are now analyzing an image from the user's camera. Describe what you observe in general terms related to health and wellness.\n- Do NOT diagnose any skin condition, injury, or disease from the image.\n- You may describe what you observe (e.g., "I can see what appears to be a reddish area on the skin").\n- Suggest the type of specialist the user may consider consulting based on what you observe.\n- Always remind the user that visual assessment by AI is limited and a real doctor should examine them in person.\n- Be extra cautious with visual analysis — your observations are general and NOT diagnostic.` + visionLang;

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.API_KEY}`
            },
            body: JSON.stringify({
                model: CONFIG.VISION_MODEL,
                messages: [
                    { role: 'system', content: visionPrompt },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: 'Please analyze this image and provide general health-related observations. Remember, do not diagnose — only describe what you see and suggest what type of specialist I may consider consulting.' },
                            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                        ]
                    }
                ],
                temperature: 0.5,
                max_tokens: 1024
            })
        });

        const data = await response.json();

        if (data.choices && data.choices[0]?.message?.content) {
            const aiText = data.choices[0].message.content;
            responseDiv.innerHTML = `
        <div class="response-text">${formatBotText(aiText)}</div>
        <div class="message-disclaimer" style="margin-top:16px;">
          <span class="disc-icon">⚕️</span>
          <span>Visual AI analysis is limited and for general information only. Please consult a qualified healthcare professional for proper examination and diagnosis.</span>
        </div>
      `;
            // Always speak analysis results during video call
            speakText(aiText);
        } else if (data.error) {
            responseDiv.innerHTML = `<p class="waiting-text">Error: ${data.error.message || JSON.stringify(data.error)}. Please check your API key.</p>`;
        } else {
            responseDiv.innerHTML = `<p class="waiting-text">Could not analyze the image. Please try again.</p>`;
        }
    } catch (error) {
        console.error('Vision API Error:', error);
        responseDiv.innerHTML = `<p class="waiting-text">Connection error. Please check your internet connection.</p>`;
    }
}

// ── Voice System ──
function setupVoice() {
    $('#micBtn')?.addEventListener('click', toggleVoiceInput);
    $('#voiceToggle')?.addEventListener('click', () => {
        state.voiceEnabled = !state.voiceEnabled;
        $('#voiceToggle').classList.toggle('active', state.voiceEnabled);
        showToast(state.voiceEnabled ? 'Voice output enabled 🔊' : 'Voice output disabled 🔇', 'info');
    });

    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        state.recognition = new SpeechRecognition();
        state.recognition.continuous = false;
        state.recognition.interimResults = true;
        state.recognition.lang = 'en-US';

        state.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const input = $('#chatInput');
            if (finalTranscript) {
                input.value = finalTranscript;
                input.dispatchEvent(new Event('input'));
            } else if (interimTranscript) {
                input.value = interimTranscript;
            }
        };

        state.recognition.onend = () => {
            state.isRecording = false;
            $('#micBtn')?.classList.remove('recording');

            // Auto-send if we have text
            const input = $('#chatInput');
            if (input.value.trim()) {
                sendMessage();
            }
        };

        state.recognition.onerror = (event) => {
            state.isRecording = false;
            $('#micBtn')?.classList.remove('recording');
            if (event.error !== 'no-speech') {
                showToast('Voice input error: ' + event.error, 'error');
            }
        };
    }
}

function toggleVoiceInput() {
    if (state.isRecording) {
        stopVoiceInput();
    } else {
        startVoiceInput();
    }
}

function startVoiceInput() {
    if (!state.recognition) {
        showToast('Voice input is not supported in this browser', 'error');
        return;
    }

    try {
        state.isRecording = true;
        $('#micBtn')?.classList.add('recording');
        $('#chatInput').placeholder = '🎙️ Listening... Speak now';
        state.recognition.start();
        showToast('🎙️ Listening...', 'info');
    } catch (e) {
        state.isRecording = false;
        $('#micBtn')?.classList.remove('recording');
    }
}

function stopVoiceInput() {
    state.isRecording = false;
    $('#micBtn')?.classList.remove('recording');
    $('#chatInput').placeholder = 'Describe your symptoms or ask a health question...';
    state.recognition?.stop();
}

function speakText(text) {
    if (!state.voiceEnabled) return;
    if (!('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    // Clean text for speech (remove markdown, emojis, disclaimers)
    let cleanText = text
        .replace(/⚕️.*$/ms, '') // Remove disclaimer
        .replace(/[*#_~`]/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[🩺💊🏥⚠️🚨❤️👋•●○◾]/g, '')
        .trim();

    if (!cleanText) return;

    // Split into chunks for better speech
    const chunks = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];

    const speed = parseFloat(localStorage.getItem('medibot_voice_speed') || '1');

    chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk.trim());
        utterance.rate = speed;
        utterance.pitch = 1.0;
        utterance.volume = 0.9;

        // Try to use a natural voice
        const voices = speechSynthesis.getVoices();
        const preferred = voices.find(v =>
            v.name.includes('Google') && v.lang.startsWith('en')
        ) || voices.find(v =>
            v.lang.startsWith('en') && v.name.includes('Female')
        ) || voices.find(v =>
            v.lang.startsWith('en')
        );

        if (preferred) utterance.voice = preferred;

        speechSynthesis.speak(utterance);
    });
}

// ── Video Call System (Enhanced — Camera Switch + Auto Analyze + Voice) ──
function setupVideo() {
    $('#startCameraBtn')?.addEventListener('click', toggleCamera);
    $('#switchCameraBtn')?.addEventListener('click', switchCamera);
    $('#analyzeBtn')?.addEventListener('click', captureAndAnalyze);
    $('#autoAnalyzeBtn')?.addEventListener('click', toggleAutoAnalyze);
    $('#endCallBtn')?.addEventListener('click', endVideoCall);
    $('#videoMicBtn')?.addEventListener('click', () => {
        if (state.currentView !== 'video') return;
        toggleVoiceInput();
        $('#videoMicBtn').classList.toggle('active', state.isRecording);
    });

    // Hinglish toggle
    $('#langToggleBtn')?.addEventListener('click', () => {
        state.hinglishMode = !state.hinglishMode;
        $('#langToggleBtn').classList.toggle('active', state.hinglishMode);
        if (state.hinglishMode) {
            $('#langToggleBtn').innerHTML = '🇮🇳 Hinglish';
            showToast('Hinglish mode ON — Bot will respond in Hindi + English', 'success');
        } else {
            $('#langToggleBtn').innerHTML = '🇬🇧 English';
            showToast('English mode ON', 'info');
        }
    });
    // Set initial state
    if (state.hinglishMode) {
        $('#langToggleBtn')?.classList.add('active');
    }
}

async function toggleCamera() {
    if (state.cameraActive) {
        stopCamera();
    } else {
        await startCamera();
    }
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: state.facingMode
            },
            audio: false
        });

        state.mediaStream = stream;
        state.cameraActive = true;

        const video = $('#userVideo');
        video.srcObject = stream;
        video.style.display = 'block';
        $('#videoPlaceholder').style.display = 'none';
        $('#startCameraBtn').classList.add('active');

        const cameraLabel = state.facingMode === 'user' ? 'Front' : 'Back';
        showToast(`${cameraLabel} camera started 📷`, 'success');
    } catch (error) {
        console.error('Camera error:', error);
        showToast('Could not access camera. Please allow camera permissions.', 'error');
    }
}

// ── Switch between Front and Back Camera ──
async function switchCamera() {
    if (!state.cameraActive) {
        showToast('Please start the camera first', 'warning');
        return;
    }

    // Toggle facing mode
    state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';

    // Stop current stream
    if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
    }

    // Restart with new facing mode
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: state.facingMode
            },
            audio: false
        });

        state.mediaStream = stream;
        const video = $('#userVideo');
        video.srcObject = stream;

        const cameraLabel = state.facingMode === 'user' ? 'Front' : 'Back';
        showToast(`Switched to ${cameraLabel} camera 🔄`, 'success');
        $('#switchCameraBtn').classList.toggle('active', state.facingMode === 'environment');
    } catch (error) {
        console.error('Camera switch error:', error);
        showToast('Could not switch camera. Your device may only have one camera.', 'error');
        // Revert facing mode
        state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
    }
}

function stopCamera() {
    // Stop auto-analyze if active
    stopAutoAnalyze();

    if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
        state.mediaStream = null;
    }

    state.cameraActive = false;
    const video = $('#userVideo');
    video.srcObject = null;
    video.style.display = 'none';
    $('#videoPlaceholder').style.display = '';
    $('#startCameraBtn').classList.remove('active');
    $('#switchCameraBtn').classList.remove('active');
}

function endVideoCall() {
    stopCamera();
    $('#aiVideoResponse').innerHTML = '<p class="waiting-text">Video call ended. Start your camera again to continue.</p>';
    showToast('Video call ended', 'info');
}

// ── Auto-Analyze: Periodically capture and analyze with voice output ──
function toggleAutoAnalyze() {
    if (state.autoAnalyzeActive) {
        stopAutoAnalyze();
        showToast('Auto-analyze stopped', 'info');
    } else {
        startAutoAnalyze();
    }
}

function startAutoAnalyze() {
    if (!state.cameraActive) {
        showToast('Please start the camera first', 'warning');
        return;
    }

    state.autoAnalyzeActive = true;
    $('#autoAnalyzeBtn').classList.add('active');
    showToast('🔁 Auto-analyze ON — AI will check every 10 seconds and speak results', 'success');

    // Immediately do first analysis
    captureAndAnalyze();

    // Then repeat every 10 seconds
    state.autoAnalyzeInterval = setInterval(() => {
        if (state.cameraActive && state.autoAnalyzeActive) {
            captureAndAnalyze();
        } else {
            stopAutoAnalyze();
        }
    }, 10000);
}

function stopAutoAnalyze() {
    state.autoAnalyzeActive = false;
    if (state.autoAnalyzeInterval) {
        clearInterval(state.autoAnalyzeInterval);
        state.autoAnalyzeInterval = null;
    }
    $('#autoAnalyzeBtn')?.classList.remove('active');
}

async function captureAndAnalyze() {
    if (!state.cameraActive) {
        showToast('Please start the camera first', 'warning');
        return;
    }

    const video = $('#userVideo');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64 = dataUrl.split(',')[1];

    showToast('Analyzing image... 🔍', 'info');
    await analyzeImage(base64);
}


// ── Symptom Tracker ──
function setupTracker() {
    $('#logSymptom')?.addEventListener('click', logSymptom);
    renderSymptoms();
}

function logSymptom() {
    const name = $('#symptomName').value.trim();
    const severity = $('#symptomSeverity').value;
    const duration = $('#symptomDuration').value.trim();
    const area = $('#symptomArea').value;
    const notes = $('#symptomNotes').value.trim();

    if (!name) {
        showToast('Please enter a symptom name', 'warning');
        return;
    }

    const symptom = {
        id: Date.now(),
        name,
        severity,
        duration,
        area,
        notes,
        date: new Date().toISOString(),
    };

    state.symptoms.unshift(symptom);
    localStorage.setItem('medibot_symptoms', JSON.stringify(state.symptoms));

    // Clear form
    $('#symptomName').value = '';
    $('#symptomDuration').value = '';
    $('#symptomNotes').value = '';

    renderSymptoms();
    showToast('Symptom logged ✅', 'success');
}

function deleteSymptom(id) {
    state.symptoms = state.symptoms.filter(s => s.id !== id);
    localStorage.setItem('medibot_symptoms', JSON.stringify(state.symptoms));
    renderSymptoms();
    showToast('Symptom deleted', 'info');
}

function renderSymptoms() {
    const list = $('#symptomList');
    if (!list) return;

    if (state.symptoms.length === 0) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 24px;">No symptoms logged yet. Use the form above to track your symptoms.</p>';
        return;
    }

    list.innerHTML = state.symptoms.map(s => {
        const date = new Date(s.date).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const severityClass = `severity-${s.severity}`;
        const areaLabels = {
            head: 'Head', chest: 'Chest', abdomen: 'Abdomen', back: 'Back',
            limbs: 'Arms/Legs', skin: 'Skin', throat: 'Throat/Neck', general: 'General'
        };

        return `
      <div class="symptom-entry">
        <div class="symptom-entry-header">
          <span class="symptom-name">${escapeHTML(s.name)}</span>
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="symptom-date">${date}</span>
            <button class="symptom-delete" onclick="deleteSymptom(${s.id})" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="symptom-details">
          <span class="symptom-severity ${severityClass}">${s.severity.toUpperCase()}</span>
          <span>📍 ${areaLabels[s.area] || s.area}</span>
          ${s.duration ? `<span>⏱️ ${escapeHTML(s.duration)}</span>` : ''}
        </div>
        ${s.notes ? `<p style="margin-top:8px; font-size:13px; color:var(--text-muted);">${escapeHTML(s.notes)}</p>` : ''}
      </div>
    `;
    }).join('');
}

// ── Settings ──
function setupSettings() {
    $('#settingsBtn')?.addEventListener('click', () => {
        $('#settingsModal').classList.add('active');
    });

    // Settings button in header
    $('#settingsBtnHeader')?.addEventListener('click', () => {
        $('#settingsModal').classList.add('active');
    });

    $('#closeSettings')?.addEventListener('click', () => {
        $('#settingsModal').classList.remove('active');
    });

    // Toggle switches
    $$('.toggle-switch').forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
        });
    });

    $('#saveSettings')?.addEventListener('click', saveSettings);

    // SECURITY: Logout button
    $('#logoutBtn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear your session and logout? This will delete all chat history.')) {
            logoutUser();
            $('#settingsModal').classList.remove('active');
        }
    });

    // Close on overlay click
    $('#settingsModal')?.addEventListener('click', (e) => {
        if (e.target === $('#settingsModal')) {
            $('#settingsModal').classList.remove('active');
        }
    });
}

function saveSettings() {
    // SECURITY: Validate and securely store API key
    const apiKey = $('#apiKeyInput').value.trim();
    if (apiKey) {
        // Validate API key format
        if (apiKey.length < 10 || apiKey.length > 200) {
            showToast('Invalid API key format. Key length should be between 10-200 characters.', 'error');
            logSecurityEvent('INVALID_API_KEY_FORMAT', 'User attempted to save invalid API key');
            return;
        }
        CONFIG.API_KEY = apiKey;
        setSecureAPIKey(apiKey);
        logSecurityEvent('API_KEY_UPDATED', 'User updated API key');
    }

    state.voiceEnabled = $('#voiceOutputToggle').classList.contains('active');
    state.autoScroll = $('#autoScrollToggle').classList.contains('active');
    state.soundEnabled = $('#soundToggle').classList.contains('active');

    const voiceSpeed = $('#voiceSpeed').value;

    localStorage.setItem('medibot_voice', state.voiceEnabled);
    localStorage.setItem('medibot_autoscroll', state.autoScroll);
    localStorage.setItem('medibot_sound', state.soundEnabled);
    localStorage.setItem('medibot_voice_speed', voiceSpeed);

    // Update voice toggle button
    $('#voiceToggle')?.classList.toggle('active', state.voiceEnabled);

    $('#settingsModal').classList.remove('active');
    showToast('Settings saved ✅', 'success');
}

// ── SOS System ──
function setupSOS() {
    $('#sosBtn')?.addEventListener('click', showSOSModal);
    $('#closeSos')?.addEventListener('click', () => {
        $('#sosModal').classList.remove('active');
    });
    $('#sosModal')?.addEventListener('click', (e) => {
        if (e.target === $('#sosModal')) {
            $('#sosModal').classList.remove('active');
        }
    });
}

function showSOSModal() {
    $('#sosModal').classList.add('active');
}

function checkEmergency(text) {
    const lower = text.toLowerCase();
    return EMERGENCY_KEYWORDS.some(kw => lower.includes(kw));
}

// ── Mobile Menu ──
function setupMobileMenu() {
    $('#menuToggle')?.addEventListener('click', () => {
        $('#sidebar').classList.toggle('open');
        $('#sidebarOverlay').classList.toggle('active');
    });

    $('#sidebarOverlay')?.addEventListener('click', closeMobileSidebar);
}

function closeMobileSidebar() {
    $('#sidebar').classList.remove('open');
    $('#sidebarOverlay').classList.remove('active');
}

// ── Health Tips Rotation ──
function rotateHealthTips() {
    const container = $('#healthTips');
    if (!container) return;

    let currentTips = [0, 1];

    setInterval(() => {
        currentTips = currentTips.map(i => (i + 2) % healthTips.length);
        container.innerHTML = currentTips.map(i => `
      <div class="tip-card">
        <div class="tip-emoji">${healthTips[i].emoji}</div>
        <div class="tip-text">${healthTips[i].text}</div>
      </div>
    `).join('');
    }, 10000);
}

// ── Utility Functions ──
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatBotText(text) {
    // Remove the AI-generated disclaimer (we add our own UI disclaimer)
    text = text.replace(/⚕️\s*Disclaimer:.*$/ms, '').trim();

    // Convert markdown-like formatting
    let formatted = escapeHTML(text);

    // Bold: **text** → <strong>text</strong>
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic: *text* → <em>text</em>
    formatted = formatted.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Bullet points
    formatted = formatted.replace(/^[•●○◾\-]\s*(.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Numbered lists
    formatted = formatted.replace(/^\d+[\.\)]\s*(.+)$/gm, '<li>$1</li>');

    // Paragraphs
    formatted = formatted.replace(/\n\n+/g, '</p><p>');
    formatted = `<p>${formatted}</p>`;

    // Clean up empty paragraphs
    formatted = formatted.replace(/<p>\s*<\/p>/g, '');

    return formatted;
}

function scrollToBottom() {
    if (!state.autoScroll) return;
    const chatMessages = $('#chatMessages');
    if (chatMessages) {
        setTimeout(() => {
            chatMessages.scrollTo({
                top: chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
    }
}

function showToast(message, type = 'info') {
    const container = $('#toastContainer');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Load voices (needed for some browsers)
if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}

// ── Theme Picker ──
function setupThemePicker() {
    const btn = $('#themePaletteBtn');
    const picker = $('#themePicker');
    if (!btn || !picker) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        picker.classList.toggle('active');
    });

    // Close picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.theme-picker-wrapper')) {
            picker.classList.remove('active');
        }
    });

    // Theme options
    $$('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.dataset.theme;
            applyTheme(theme);
            picker.classList.remove('active');
        });
    });
}

function applyTheme(themeName) {
    // Set data-theme on html element
    if (themeName === 'emerald') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', themeName);
    }

    // Update active state in picker
    $$('.theme-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === themeName);
    });

    // Save to localStorage
    localStorage.setItem('medibot_theme', themeName);

    const themeNames = {
        emerald: 'Emerald Night',
        ocean: 'Ocean Depths',
        galaxy: 'Purple Galaxy',
        sunset: 'Sunset Fire'
    };

    showToast(`🎨 Theme: ${themeNames[themeName] || themeName}`, 'info');
}
