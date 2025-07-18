// Game canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas scaling system
let gameScale = 1;
let baseWidth = 800;
let baseHeight = 600;
let scaledWidth = baseWidth;
let scaledHeight = baseHeight;

// Frame rate independent physics
let lastTime = 0;
let deltaTime = 0;
let targetFPS = 60;
let isAndroid = /Android/i.test(navigator.userAgent);
let isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Canvas scaling functions
function resizeCanvas() {
    const container = document.querySelector('.canvas-container');
    const containerRect = container.getBoundingClientRect();
    
    // Calculate available space
    const maxWidth = Math.min(window.innerWidth - 40, containerRect.width || window.innerWidth - 40);
    const maxHeight = window.innerHeight - 200; // Leave space for UI
    
    // Calculate scale to fit screen while maintaining aspect ratio
    const scaleX = maxWidth / baseWidth;
    const scaleY = maxHeight / baseHeight;
    gameScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond original size
    
    // Apply scaling
    scaledWidth = baseWidth * gameScale;
    scaledHeight = baseHeight * gameScale;
    
    // Set canvas size
    canvas.width = baseWidth;
    canvas.height = baseHeight;
    canvas.style.width = scaledWidth + 'px';
    canvas.style.height = scaledHeight + 'px';
    
    // Reset goose position if needed
    if (goose.y > canvas.height - goose.height) {
        goose.y = canvas.height / 2;
    }
}

function getCanvasMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function getCanvasTouchPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const touch = e.touches[0] || e.changedTouches[0];
    return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
    };
}

// Game variables
let gameState = 'start'; // 'start', 'playing', 'paused', 'gameOver', 'menu'
let score = 0;
let highScore = localStorage.getItem('flyingGeeseHighScore') || 0;
let soundEnabled = localStorage.getItem('flyingGeeseSoundEnabled') !== 'false';

// Game modes
let currentGameMode = localStorage.getItem('flyingGeeseGameMode') || 'classic';
let gameMode = {
    classic: { name: 'Classic', description: 'Original gameplay' },
    timeAttack: { name: 'Time Attack', description: '60 seconds to score as much as possible' },
    survival: { name: 'Survival', description: 'No power-ups, pure skill' },
    zen: { name: 'Zen Mode', description: 'Relaxed gameplay, no collisions' }
};

// Time Attack mode
let timeAttackDuration = 60 * 60; // 60 seconds at 60fps
let timeRemaining = timeAttackDuration;

// Customization options
let customization = JSON.parse(localStorage.getItem('flyingGeeseCustomization') || '{"gooseColor": "#FFFFFF", "theme": "default", "trailEffect": false}');

// Difficulty progression
let gameSpeed = 3;
let pipeSpawnRate = 120; // frames between pipes
let currentDifficulty = 1;

// Power-ups system
let powerUps = [];
let activePowerUps = {
    invincible: 0,
    slowMotion: 0,
    doublePoints: 0
};

// Achievement system
let achievements = JSON.parse(localStorage.getItem('flyingGeeseAchievements') || '{}');
let achievementPopups = [];

// Game statistics
let gameStats = JSON.parse(localStorage.getItem('flyingGeeseStats') || '{"gamesPlayed": 0, "totalScore": 0, "bestStreak": 0, "currentStreak": 0}');

// Visual effects
let particles = [];
let screenShake = 0;
let scorePopups = [];

// Audio system
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let audioInitialized = false;

function initAudio() {
    if (!audioInitialized && soundEnabled) {
        audioInitialized = true;
    }
}

function playSound(frequency, duration, type = 'sine', volume = 0.1) {
    if (!soundEnabled || !audioInitialized) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playFlapSound() {
    playSound(200, 0.1, 'square', 0.05);
}

function playScoreSound() {
    playSound(523, 0.2, 'sine', 0.08); // C note
    setTimeout(() => playSound(659, 0.2, 'sine', 0.08), 100); // E note
}

function playCollisionSound() {
    playSound(150, 0.3, 'sawtooth', 0.1);
}

function playPowerUpSound() {
    playSound(440, 0.3, 'sine', 0.08); // A note
    setTimeout(() => playSound(554, 0.3, 'sine', 0.08), 150); // C# note
}

function playAchievementSound() {
    // Triumphant chord progression
    playSound(523, 0.4, 'sine', 0.06); // C
    setTimeout(() => playSound(659, 0.4, 'sine', 0.06), 100); // E
    setTimeout(() => playSound(784, 0.4, 'sine', 0.06), 200); // G
    setTimeout(() => playSound(1047, 0.6, 'sine', 0.08), 300); // High C
}

// Particle system
class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 3 + 1;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // gravity
        this.life--;
        this.vx *= 0.99; // air resistance
    }
    
    draw() {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }
}

function createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = Math.random() * 3 + 1;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        particles.push(new Particle(x, y, vx, vy, color, 30));
    }
}

// Score popup system
class ScorePopup {
    constructor(x, y, text) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.life = 60;
        this.maxLife = 60;
    }
    
    update() {
        this.y -= 1;
        this.life--;
    }
    
    draw() {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// Power-up system
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 30;
        this.height = 30;
        this.collected = false;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.age = 0;
    }
    
    update() {
        this.x -= gameSpeed;
        this.age++;
        this.y += Math.sin(this.age * 0.1 + this.bobOffset) * 0.5; // floating effect
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.rotate(this.age * 0.05);
        
        // Draw power-up based on type
        switch(this.type) {
            case 'invincible':
                ctx.fillStyle = '#FFD700';
                ctx.strokeStyle = '#FFA500';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, this.width/2, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                // Shield symbol
                ctx.fillStyle = '#FFF';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('🛡️', 0, 5);
                break;
                
            case 'slowMotion':
                ctx.fillStyle = '#87CEEB';
                ctx.strokeStyle = '#4682B4';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, this.width/2, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                // Clock symbol
                ctx.fillStyle = '#FFF';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('⏰', 0, 5);
                break;
                
            case 'doublePoints':
                ctx.fillStyle = '#32CD32';
                ctx.strokeStyle = '#228B22';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(0, 0, this.width/2, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                // Star symbol
                ctx.fillStyle = '#FFF';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('⭐', 0, 5);
                break;
        }
        
        ctx.restore();
    }
    
    checkCollision(goose) {
        return goose.x < this.x + this.width &&
               goose.x + goose.width > this.x &&
               goose.y < this.y + this.height &&
               goose.y + goose.height > this.y;
    }
}

// Achievement system
class Achievement {
    constructor(id, name, description, condition, icon) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.condition = condition;
        this.icon = icon;
        this.unlocked = achievements[id] || false;
    }
    
    check() {
        if (!this.unlocked && this.condition()) {
            this.unlock();
        }
    }
    
    unlock() {
        this.unlocked = true;
        achievements[this.id] = true;
        localStorage.setItem('flyingGeeseAchievements', JSON.stringify(achievements));
        
        // Show achievement popup
        achievementPopups.push({
            text: `🏆 ${this.name}`,
            description: this.description,
            life: 180,
            maxLife: 180
        });
        
        // Play achievement sound
        playAchievementSound();
    }
}

// Achievement popup system
class AchievementPopup {
    constructor(text, description) {
        this.text = text;
        this.description = description;
        this.life = 180;
        this.maxLife = 180;
        this.y = 50;
    }
    
    update() {
        this.life--;
    }
    
    draw() {
        const alpha = Math.min(1, this.life / 60);
        ctx.save();
        ctx.globalAlpha = alpha;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(canvas.width/2 - 200, this.y - 20, 400, 60);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width/2 - 200, this.y - 20, 400, 60);
        
        // Text
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, canvas.width/2, this.y);
        
        ctx.fillStyle = '#FFF';
        ctx.font = '14px Arial';
        ctx.fillText(this.description, canvas.width/2, this.y + 20);
        
        ctx.restore();
    }
}

// Game objects
const goose = {
    x: 100,
    y: canvas.height / 2,
    width: 40,
    height: 30,
    velocity: 0,
    gravity: 0.5,
    jumpPower: -8,
    color: '#FFFFFF'
};

const pipes = [];
const pipeWidth = 60;
const pipeGap = 150;
let pipeTimer = 0;

// Game functions
function drawGoose() {
    // Draw goose body (simple oval)
    ctx.fillStyle = goose.color;
    ctx.beginPath();
    ctx.ellipse(goose.x + goose.width/2, goose.y + goose.height/2, 
                goose.width/2, goose.height/2, 0, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw goose beak
    ctx.fillStyle = '#FFA500';
    ctx.beginPath();
    ctx.moveTo(goose.x + goose.width, goose.y + goose.height/2);
    ctx.lineTo(goose.x + goose.width + 10, goose.y + goose.height/2 - 5);
    ctx.lineTo(goose.x + goose.width + 10, goose.y + goose.height/2 + 5);
    ctx.closePath();
    ctx.fill();
    
    // Draw goose eye
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(goose.x + goose.width * 0.7, goose.y + goose.height * 0.3, 3, 0, 2 * Math.PI);
    ctx.fill();
}

function drawPipes() {
    ctx.fillStyle = '#228B22';
    pipes.forEach(pipe => {
        // Top pipe
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.topHeight);
        // Bottom pipe
        ctx.fillRect(pipe.x, pipe.topHeight + pipeGap, pipeWidth, 
                     canvas.height - pipe.topHeight - pipeGap);
    });
}

function drawBackground() {
    // Sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#98FB98');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Simple clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 3; i++) {
        const x = (i * 300) + 50;
        const y = 50 + (i * 30);
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, 2 * Math.PI);
        ctx.arc(x + 25, y, 25, 0, 2 * Math.PI);
        ctx.arc(x + 50, y, 20, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function updateGoose() {
    if (gameState === 'playing') {
        // Frame-rate independent physics with platform-specific adjustments
        const gravityMultiplier = isAndroid ? 0.8 : 1.0; // Reduce gravity on Android
        const normalizedGravity = goose.gravity * gravityMultiplier * (deltaTime / 16.67); // Normalize to 60fps
        const normalizedVelocity = goose.velocity * (deltaTime / 16.67);
        
        goose.velocity += normalizedGravity;
        goose.y += normalizedVelocity;
        
        // Keep goose in bounds
        if (goose.y < 0) goose.y = 0;
        if (goose.y + goose.height > canvas.height) {
            gameState = 'gameOver';
            playCollisionSound();
            createParticles(goose.x + goose.width/2, goose.y + goose.height/2, 8, '#FF4444');
            screenShake = 10;
        }
    }
}

function updateDifficulty() {
    // Increase difficulty every 5 points
    const newDifficulty = Math.floor(score / 5) + 1;
    if (newDifficulty > currentDifficulty) {
        currentDifficulty = newDifficulty;
        gameSpeed = Math.min(3 + (currentDifficulty - 1) * 0.5, 8); // Max speed of 8
        pipeSpawnRate = Math.max(120 - (currentDifficulty - 1) * 10, 80); // Min spawn rate of 80 frames
        
        // Show difficulty increase notification
        scorePopups.push(new ScorePopup(canvas.width/2, canvas.height/3, `Level ${currentDifficulty}!`));
        createParticles(canvas.width/2, canvas.height/3, 8, '#FF69B4');
    }
}

function spawnPowerUp() {
    // 15% chance to spawn power-up when scoring
    if (Math.random() < 0.15) {
        const types = ['invincible', 'slowMotion', 'doublePoints'];
        const type = types[Math.floor(Math.random() * types.length)];
        const y = Math.random() * (canvas.height - 200) + 100;
        powerUps.push(new PowerUp(canvas.width, y, type));
    }
}

function updatePowerUps() {
    if (gameState === 'playing') {
        // Update power-ups
        powerUps.forEach(powerUp => {
            powerUp.update();
            
            // Check collision with goose
            if (!powerUp.collected && powerUp.checkCollision(goose)) {
                powerUp.collected = true;
                activatePowerUp(powerUp.type);
                playPowerUpSound();
                createParticles(powerUp.x + powerUp.width/2, powerUp.y + powerUp.height/2, 10, '#FFD700');
            }
        });
        
        // Remove off-screen power-ups
        powerUps = powerUps.filter(powerUp => powerUp.x + powerUp.width > 0 && !powerUp.collected);
        
        // Update active power-up timers
        Object.keys(activePowerUps).forEach(key => {
            if (activePowerUps[key] > 0) {
                activePowerUps[key]--;
            }
        });
    }
}

function activatePowerUp(type) {
    switch(type) {
        case 'invincible':
            activePowerUps.invincible = 300; // 5 seconds at 60fps
            goose.color = '#FFD700'; // Golden color
            scorePopups.push(new ScorePopup(goose.x, goose.y - 30, 'Invincible!'));
            break;
        case 'slowMotion':
            activePowerUps.slowMotion = 360; // 6 seconds
            scorePopups.push(new ScorePopup(goose.x, goose.y - 30, 'Slow Motion!'));
            break;
        case 'doublePoints':
            activePowerUps.doublePoints = 600; // 10 seconds
            scorePopups.push(new ScorePopup(goose.x, goose.y - 30, 'Double Points!'));
            break;
    }
}

function updatePipes() {
    if (gameState === 'playing') {
        // Apply slow motion effect
        const currentSpeed = activePowerUps.slowMotion > 0 ? gameSpeed * 0.5 : gameSpeed;
        
        // Move existing pipes
        pipes.forEach(pipe => {
            pipe.x -= currentSpeed;
        });
        
        // Remove pipes that are off screen and score
        if (pipes.length > 0 && pipes[0].x + pipeWidth < 0) {
            pipes.shift();
            
            // Calculate score based on active power-ups
            const pointsToAdd = activePowerUps.doublePoints > 0 ? 2 : 1;
            score += pointsToAdd;
            
            playScoreSound();
            scorePopups.push(new ScorePopup(canvas.width/2, canvas.height/2, `+${pointsToAdd}`));
            createParticles(canvas.width/2, canvas.height/2, 5, '#FFD700');
            updateScore();
            updateDifficulty();
            spawnPowerUp();
            checkAchievements();
        }
        
        // Add new pipes
        pipeTimer++;
        const currentSpawnRate = activePowerUps.slowMotion > 0 ? pipeSpawnRate * 1.5 : pipeSpawnRate;
        if (pipeTimer > currentSpawnRate) {
            const topHeight = Math.random() * (canvas.height - pipeGap - 100) + 50;
            pipes.push({
                x: canvas.width,
                topHeight: topHeight
            });
            pipeTimer = 0;
        }
    }
}

function checkCollisions() {
    if (gameState !== 'playing') return;
    
    // Skip collision if invincible
    if (activePowerUps.invincible > 0) return;
    
    pipes.forEach(pipe => {
        // Enhanced collision detection with smaller hitbox for better gameplay
        const gooseHitbox = {
            x: goose.x + 5,
            y: goose.y + 5,
            width: goose.width - 10,
            height: goose.height - 10
        };
        
        // Check if goose is in pipe's x range
        if (gooseHitbox.x < pipe.x + pipeWidth && gooseHitbox.x + gooseHitbox.width > pipe.x) {
            // Check if goose hits top or bottom pipe
            if (gooseHitbox.y < pipe.topHeight || 
                gooseHitbox.y + gooseHitbox.height > pipe.topHeight + pipeGap) {
                gameOver();
            }
        }
    });
}

function gameOver() {
    gameState = 'gameOver';
    playCollisionSound();
    createParticles(goose.x + goose.width/2, goose.y + goose.height/2, 12, '#FF4444');
    screenShake = 15;
    
    // Update game statistics
    gameStats.gamesPlayed++;
    gameStats.totalScore += score;
    if (score === 0) {
        gameStats.currentStreak = 0;
    } else {
        gameStats.currentStreak++;
        if (gameStats.currentStreak > gameStats.bestStreak) {
            gameStats.bestStreak = gameStats.currentStreak;
        }
    }
    localStorage.setItem('flyingGeeseStats', JSON.stringify(gameStats));
    
    // Reset power-up effects
    activePowerUps.invincible = 0;
    activePowerUps.slowMotion = 0;
    activePowerUps.doublePoints = 0;
    goose.color = '#FFFFFF';
}

// Achievement definitions
const gameAchievements = [
    new Achievement('firstFlight', 'First Flight', 'Score your first point', () => score >= 1),
    new Achievement('skyHigh', 'Sky High', 'Reach a score of 10', () => score >= 10),
    new Achievement('cloudSurfer', 'Cloud Surfer', 'Reach a score of 25', () => score >= 25),
    new Achievement('masterFlyer', 'Master Flyer', 'Reach a score of 50', () => score >= 50),
    new Achievement('speedDemon', 'Speed Demon', 'Reach level 5 difficulty', () => currentDifficulty >= 5),
    new Achievement('powerCollector', 'Power Collector', 'Collect 5 power-ups in one game', () => {
        return (activePowerUps.invincible > 0 ? 1 : 0) + 
               (activePowerUps.slowMotion > 0 ? 1 : 0) + 
               (activePowerUps.doublePoints > 0 ? 1 : 0) >= 1; // Simplified for demo
    }),
    new Achievement('survivor', 'Survivor', 'Play 10 games', () => gameStats.gamesPlayed >= 10),
    new Achievement('dedicated', 'Dedicated Player', 'Accumulate 100 total points', () => gameStats.totalScore >= 100),
    new Achievement('streakMaster', 'Streak Master', 'Get a 5-game winning streak', () => gameStats.bestStreak >= 5)
];

function checkAchievements() {
    gameAchievements.forEach(achievement => {
        achievement.check();
    });
}

// Game mode functions
function applyGameModeRules() {
    switch(currentGameMode) {
        case 'timeAttack':
            if (gameState === 'playing') {
                timeRemaining--;
                if (timeRemaining <= 0) {
                    gameState = 'gameOver';
                    scorePopups.push(new ScorePopup(canvas.width/2, canvas.height/2, 'Time Up!'));
                }
            }
            break;
        case 'survival':
            // No power-ups spawn in survival mode
            break;
        case 'zen':
            // No collisions in zen mode
            break;
    }
}

function initializeGameMode() {
    switch(currentGameMode) {
        case 'timeAttack':
            timeRemaining = timeAttackDuration;
            break;
        case 'survival':
            powerUps.length = 0; // Clear any existing power-ups
            break;
        case 'zen':
            // Zen mode settings
            break;
    }
}

function drawGameModeUI() {
    ctx.font = '16px Arial';
    ctx.textAlign = 'right';
    
    switch(currentGameMode) {
        case 'timeAttack':
            const seconds = Math.ceil(timeRemaining / 60);
            ctx.fillStyle = seconds <= 10 ? '#FF4444' : '#FFFFFF';
            ctx.fillText(`Time: ${seconds}s`, canvas.width - 10, 40);
            break;
        case 'survival':
            ctx.fillStyle = '#FF6B6B';
            ctx.fillText('SURVIVAL MODE', canvas.width - 10, 40);
            break;
        case 'zen':
            ctx.fillStyle = '#87CEEB';
            ctx.fillText('ZEN MODE', canvas.width - 10, 40);
            break;
    }
    
    // Show current game mode
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '14px Arial';
    ctx.fillText(gameMode[currentGameMode].name, canvas.width - 10, 60);
}

// Trail effect system
let trailPoints = [];

function updateTrail() {
    if (customization.trailEffect && gameState === 'playing') {
        trailPoints.push({
            x: goose.x + goose.width/2,
            y: goose.y + goose.height/2,
            life: 30
        });
    }
    
    trailPoints = trailPoints.filter(point => {
        point.life--;
        return point.life > 0;
    });
}

function drawTrail() {
    if (!customization.trailEffect) return;
    
    trailPoints.forEach((point, index) => {
        const alpha = point.life / 30;
        const size = alpha * 3;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = customization.gooseColor;
        ctx.beginPath();
        ctx.arc(point.x, point.y, size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    });
}

// Statistics and leaderboard system
function getDetailedStats() {
    return {
        ...gameStats,
        averageScore: gameStats.gamesPlayed > 0 ? (gameStats.totalScore / gameStats.gamesPlayed).toFixed(1) : 0,
        achievementsUnlocked: Object.keys(achievements).filter(key => achievements[key]).length,
        totalAchievements: gameAchievements.length,
        completionRate: ((Object.keys(achievements).filter(key => achievements[key]).length / gameAchievements.length) * 100).toFixed(1)
    };
}

function drawStatsOverlay() {
    if (gameState !== 'menu') return;
    
    const stats = getDetailedStats();
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('STATISTICS', canvas.width/2, 60);
    
    // Stats
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px Arial';
    let yPos = 120;
    const statLines = [
        `Games Played: ${stats.gamesPlayed}`,
        `Total Score: ${stats.totalScore}`,
        `Average Score: ${stats.averageScore}`,
        `Best Streak: ${stats.bestStreak}`,
        `High Score: ${highScore}`,
        `Achievements: ${stats.achievementsUnlocked}/${stats.totalAchievements} (${stats.completionRate}%)`
    ];
    
    statLines.forEach(line => {
        ctx.fillText(line, canvas.width/2, yPos);
        yPos += 35;
    });
    
    // Achievement list
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('ACHIEVEMENTS', canvas.width/2, yPos + 30);
    
    ctx.font = '16px Arial';
    yPos += 70;
    gameAchievements.forEach(achievement => {
        ctx.fillStyle = achievement.unlocked ? '#32CD32' : '#666666';
        const status = achievement.unlocked ? '✓' : '✗';
        ctx.fillText(`${status} ${achievement.name}: ${achievement.description}`, canvas.width/2, yPos);
        yPos += 25;
    });
    
    // Instructions
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '18px Arial';
    ctx.fillText('Press ESC to return to game', canvas.width/2, canvas.height - 30);
}

function jump() {
    initAudio(); // Initialize audio on first user interaction
    
    if (gameState === 'start') {
        gameState = 'playing';
        playFlapSound();
        createParticles(goose.x + goose.width/2, goose.y + goose.height/2, 3, '#FFFFFF');
    } else if (gameState === 'playing') {
        goose.velocity = goose.jumpPower;
        playFlapSound();
        createParticles(goose.x + goose.width/2, goose.y + goose.height/2, 3, '#FFFFFF');
    } else if (gameState === 'gameOver') {
        resetGame();
    }
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        document.getElementById('pauseBtn').textContent = '▶️ Resume';
    } else if (gameState === 'paused') {
        gameState = 'playing';
        document.getElementById('pauseBtn').textContent = '⏸️ Pause';
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('flyingGeeseSoundEnabled', soundEnabled);
    const soundBtn = document.getElementById('soundBtn');
    if (soundEnabled) {
        soundBtn.textContent = '🔊 Sound';
        soundBtn.classList.remove('muted');
    } else {
        soundBtn.textContent = '🔇 Muted';
        soundBtn.classList.add('muted');
    }
}

function resetGame() {
    gameState = 'start';
    goose.y = canvas.height / 2;
    goose.velocity = 0;
    goose.color = '#FFFFFF';
    pipes.length = 0;
    particles.length = 0;
    scorePopups.length = 0;
    powerUps.length = 0;
    achievementPopups.length = 0;
    pipeTimer = 0;
    score = 0;
    screenShake = 0;
    gameSpeed = 3;
    pipeSpawnRate = 120;
    currentDifficulty = 1;
    
    // Reset power-ups
    activePowerUps.invincible = 0;
    activePowerUps.slowMotion = 0;
    activePowerUps.doublePoints = 0;
    
    updateScore();
    document.getElementById('pauseBtn').textContent = '⏸️ Pause';
    removePauseOverlay();
}

function updateScore() {
    document.getElementById('score').textContent = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('flyingGeeseHighScore', highScore);
    }
    document.getElementById('highScore').textContent = highScore;
}

function showPauseOverlay() {
    const canvasContainer = document.querySelector('.canvas-container');
    let overlay = document.getElementById('pauseOverlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'pauseOverlay';
        overlay.className = 'pause-overlay';
        overlay.innerHTML = `
            <h2>PAUSED</h2>
            <p>Press P or click Resume to continue</p>
            <p>Press SPACE to flap when playing</p>
        `;
        canvasContainer.appendChild(overlay);
    }
}

function removePauseOverlay() {
    const overlay = document.getElementById('pauseOverlay');
    if (overlay) {
        overlay.remove();
    }
}

function updateParticles() {
    particles = particles.filter(particle => {
        particle.update();
        return particle.life > 0;
    });
}

function drawParticles() {
    particles.forEach(particle => particle.draw());
}

function updateScorePopups() {
    scorePopups = scorePopups.filter(popup => {
        popup.update();
        return popup.life > 0;
    });
}

function drawScorePopups() {
    scorePopups.forEach(popup => popup.draw());
}

function updateScreenShake() {
    if (screenShake > 0) {
        screenShake--;
    }
}

function applyScreenShake() {
    if (screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * screenShake;
        const shakeY = (Math.random() - 0.5) * screenShake;
        ctx.translate(shakeX, shakeY);
    }
}

function drawGameState() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';
    
    if (gameState === 'start') {
        ctx.fillText('Click or Press SPACE to Start!', canvas.width/2, canvas.height/2);
        ctx.font = '18px Arial';
        ctx.fillText('Press P to pause during gameplay', canvas.width/2, canvas.height/2 + 40);
    } else if (gameState === 'gameOver') {
        ctx.fillText('Game Over!', canvas.width/2, canvas.height/2 - 30);
        ctx.font = '20px Arial';
        ctx.fillText('Click or Press SPACE to Restart', canvas.width/2, canvas.height/2 + 10);
    }
}

function drawPowerUps() {
    powerUps.forEach(powerUp => {
        if (!powerUp.collected) {
            powerUp.draw();
        }
    });
}

function drawPowerUpStatus() {
    // Draw active power-up indicators
    let yOffset = 20;
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    
    if (activePowerUps.invincible > 0) {
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`🛡️ Invincible: ${Math.ceil(activePowerUps.invincible / 60)}s`, 10, yOffset);
        yOffset += 25;
    }
    
    if (activePowerUps.slowMotion > 0) {
        ctx.fillStyle = '#87CEEB';
        ctx.fillText(`⏰ Slow Motion: ${Math.ceil(activePowerUps.slowMotion / 60)}s`, 10, yOffset);
        yOffset += 25;
    }
    
    if (activePowerUps.doublePoints > 0) {
        ctx.fillStyle = '#32CD32';
        ctx.fillText(`⭐ Double Points: ${Math.ceil(activePowerUps.doublePoints / 60)}s`, 10, yOffset);
        yOffset += 25;
    }
    
    // Draw difficulty level
    ctx.fillStyle = '#FF69B4';
    ctx.fillText(`Level: ${currentDifficulty}`, 10, yOffset);
}

function updateAchievementPopups() {
    achievementPopups = achievementPopups.filter(popup => {
        popup.life--;
        return popup.life > 0;
    });
}

function drawAchievementPopups() {
    achievementPopups.forEach(popup => {
        const alpha = Math.min(1, popup.life / 60);
        ctx.save();
        ctx.globalAlpha = alpha;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(canvas.width/2 - 200, 50 - 20, 400, 60);
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width/2 - 200, 50 - 20, 400, 60);
        
        // Text
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(popup.text, canvas.width/2, 50);
        
        ctx.fillStyle = '#FFF';
        ctx.font = '14px Arial';
        ctx.fillText(popup.description, canvas.width/2, 70);
        
        ctx.restore();
    });
}

function gameLoop(currentTime) {
    // Calculate delta time for frame-rate independent physics
    if (lastTime === 0) lastTime = currentTime;
    deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    // Clamp delta time to prevent large jumps
    deltaTime = Math.min(deltaTime, 33.33); // Max 30fps minimum
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply screen shake
    ctx.save();
    applyScreenShake();
    
    // Draw everything
    drawBackground();
    drawTrail(); // Draw trail effect
    drawPipes();
    drawPowerUps();
    drawGoose();
    drawParticles();
    drawScorePopups();
    
    // Update game state
    if (gameState !== 'paused' && gameState !== 'menu') {
        updateGoose();
        updatePipes();
        updatePowerUps();
        
        // Apply game mode specific rules
        applyGameModeRules();
        
        // Skip collisions in zen mode
        if (currentGameMode !== 'zen') {
            checkCollisions();
        }
        
        updateParticles();
        updateScorePopups();
        updateAchievementPopups();
        updateScreenShake();
        updateTrail();
    }
    
    // Restore canvas transform
    ctx.restore();
    
    // Draw UI elements (not affected by screen shake)
    if (gameState !== 'menu') {
        drawGameState();
        drawPowerUpStatus();
        drawGameModeUI();
        drawAchievementPopups();
    } else {
        drawStatsOverlay();
    }
    
    // Handle pause overlay
    if (gameState === 'paused') {
        showPauseOverlay();
    } else {
        removePauseOverlay();
    }
    
    // Continue the game loop
    requestAnimationFrame(gameLoop);
}

// Event listeners
canvas.addEventListener('click', jump);

// Enhanced touch support for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    jump();
});

// Selective touch prevention - only prevent scrolling on canvas
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

// Allow scrolling on the rest of the page
document.addEventListener('touchmove', (e) => {
    // Only prevent default if touching the canvas
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const isOnCanvas = touch.clientX >= rect.left && 
                      touch.clientX <= rect.right && 
                      touch.clientY >= rect.top && 
                      touch.clientY <= rect.bottom;
    
    if (isOnCanvas) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        jump();
    } else if (e.code === 'KeyP') {
        e.preventDefault();
        togglePause();
    }
});

// Button event listeners
document.getElementById('pauseBtn').addEventListener('click', togglePause);
document.getElementById('soundBtn').addEventListener('click', toggleSound);
document.getElementById('statsBtn').addEventListener('click', toggleStats);
document.getElementById('modeBtn').addEventListener('click', showModeSelector);

// Phase 3: Advanced control event listeners
document.getElementById('gameModeSelect').addEventListener('change', changeGameMode);
document.getElementById('gooseColorPicker').addEventListener('change', changeGooseColor);
document.getElementById('trailToggle').addEventListener('change', toggleTrail);

// Enhanced keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        jump();
    } else if (e.code === 'KeyP') {
        e.preventDefault();
        togglePause();
    } else if (e.code === 'Escape') {
        e.preventDefault();
        if (gameState === 'menu') {
            gameState = 'start';
        }
    } else if (e.code === 'KeyS') {
        e.preventDefault();
        toggleStats();
    }
});

// Phase 3: New functions
function toggleStats() {
    if (gameState === 'menu') {
        gameState = 'start';
    } else {
        gameState = 'menu';
    }
}

function showModeSelector() {
    // Toggle visibility of advanced controls
    const advancedControls = document.querySelector('.advanced-controls');
    if (advancedControls.style.display === 'none') {
        advancedControls.style.display = 'block';
    } else {
        advancedControls.style.display = 'none';
    }
}

function changeGameMode() {
    const select = document.getElementById('gameModeSelect');
    currentGameMode = select.value;
    localStorage.setItem('flyingGeeseGameMode', currentGameMode);
    
    // Reset game when changing modes
    if (gameState === 'playing') {
        resetGame();
    }
    
    // Initialize new game mode
    initializeGameMode();
    
    // Show mode change notification
    scorePopups.push(new ScorePopup(canvas.width/2, canvas.height/3, `${gameMode[currentGameMode].name} Mode!`));
}

function changeGooseColor() {
    const colorPicker = document.getElementById('gooseColorPicker');
    customization.gooseColor = colorPicker.value;
    goose.color = customization.gooseColor;
    localStorage.setItem('flyingGeeseCustomization', JSON.stringify(customization));
}

function toggleTrail() {
    const trailToggle = document.getElementById('trailToggle');
    customization.trailEffect = trailToggle.checked;
    localStorage.setItem('flyingGeeseCustomization', JSON.stringify(customization));
    
    if (!customization.trailEffect) {
        trailPoints.length = 0; // Clear existing trail
    }
}

function initializeCustomization() {
    // Set UI elements to match saved customization
    document.getElementById('gooseColorPicker').value = customization.gooseColor;
    document.getElementById('trailToggle').checked = customization.trailEffect;
    document.getElementById('gameModeSelect').value = currentGameMode;
    
    // Apply customization to game
    goose.color = customization.gooseColor;
}

// Initialize sound button state
function initializeSoundButton() {
    const soundBtn = document.getElementById('soundBtn');
    if (soundEnabled) {
        soundBtn.textContent = '🔊 Sound';
        soundBtn.classList.remove('muted');
    } else {
        soundBtn.textContent = '🔇 Muted';
        soundBtn.classList.add('muted');
    }
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Window resize handler for responsive canvas
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeCanvas, 100); // Delay to ensure orientation change is complete
});

// Initialize game
resizeCanvas(); // Set initial canvas size
updateScore();
initializeSoundButton();
initializeCustomization();
gameLoop();
