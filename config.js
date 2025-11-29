// ============================================================
// 🔧 SOLO Bot Configuration
// ============================================================

export const config = {
    // ==================== معلومات البوت ====================
    BOT_NAME: 'SOLO Bot',
    BOT_VERSION: '2.0.0',
    BOT_AUTHOR: 'KING',
    BOT_PHONE: '+201005199558',
    
    // ==================== معرفات المطورين والمسؤولين ====================
    DEVELOPERS: [
        '201005199558@s.whatsapp.net',
        '201005199558'
    ],
    
    ADMINS: [
        '201005199558@s.whatsapp.net'
    ],
    
    // ==================== إعدادات الاتصال ====================
    SESSION_NAME: 'SOLO_SESSION',
    SESSION_PATH: './session',
    
    // ==================== إعدادات قاعدة البيانات ====================
    DATABASE_PATH: './data/bot_data.json',
    AUTO_SAVE_INTERVAL: 30000, // 30 ثانية
    
    // ==================== إعدادات الأمان ====================
    ANTI_SPAM_COOLDOWN: 3000, // 3 ثواني
    MAX_RETRIES: 10,
    RATE_LIMIT_MESSAGES: 5, // عدد الرسائل المسموحة
    RATE_LIMIT_WINDOW: 60000, // في الدقيقة
    
    // ==================== إعدادات الألعاب ====================
    GAME_TIMEOUT: 300000, // 5 دقائق
    MAX_GAME_PLAYERS: 10,
    
    // ==================== إعدادات الاقتصاد ====================
    STARTING_COINS: 10,
    STARTING_DIAMONDS: 3,
    DAILY_REWARD: 100,
    
    // ==================== إعدادات المجموعات ====================
    DEFAULT_WELCOME_MESSAGE: 'أهلا وسهلا بك في المجموعة! 👋',
    DEFAULT_GOODBYE_MESSAGE: 'وداعا! نتمنى أن تكون قضيت وقتا رائعا معنا! 👋',
    
    // ==================== إعدادات الميزات ====================
    FEATURES: {
        ANTI_LINK: true,
        ANTI_BOT: false,
        ANTI_SPAM: true,
        WELCOME_MESSAGE: true,
        AUTO_LEVELUP: true,
        REACTION_SYSTEM: true,
        ECONOMY_SYSTEM: true,
        GAME_SYSTEM: true
    },
    
    // ==================== إعدادات الرسائل ====================
    PREFIX: '.',
    COMMAND_TIMEOUT: 10000,
    
    // ==================== إعدادات الأداء ====================
    CACHE_TTL: 30000, // مدة بقاء الكاش بالميلي ثانية
    MAX_CACHE_SIZE: 1000,
    CLEANUP_INTERVAL: 300000, // 5 دقائق
    
    // ==================== إعدادات الإنتاج ====================
    DEBUG_MODE: false,
    LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
    
    // ==================== إعدادات الاتصال المتقدمة ====================
    CONNECTION_OPTIONS: {
        printQRInTerminal: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        retryRequestDelayMs: 1000,
        maxRetries: 3
    }
};

export default config;
