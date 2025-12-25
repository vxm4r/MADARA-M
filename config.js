import { fileURLToPath } from 'url'
import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'

// ============================================================
// 🔧 SOLO Bot Configuration - الإعدادات الرئيسية
// ============================================================

// ==================== معلومات المطورين والمالكين ====================
global.owner = [
  ['212717127742', 'ITACHI-VX', true], // [رقم، اسم، هل هو المالك الرئيسي]
  ['212717127742', 'ITACHI-VX', true]
]
global.mods = [] // قائمة المشرفين
global.prems = [] // قائمة المستخدمين المميزين

// ==================== إعدادات البوت العامة ====================
global.BOT_NAME = 'MADARA BOT'
global.BOT_VERSION = '1.0.0'
global.BOT_AUTHOR = 'ITACHI'
global.BOT_PHONE = '212708534476' // رقم البوت بدون رمز الدولة
global.PREFIX = '.' // بادئة الأوامر الافتراضية

// ==================== إعدادات الجلسات والتنصيب ====================
global.SESSION_NAME = 'MADARA-SESSIONN' // اسم مجلد الجلسة الرئيسية
global.SUB_SESSION_DIR = 'jadibot' // اسم مجلد الجلسات المتعددة (Jadibot)
global.SUB_BOT_LIMIT = 20 // الحد الأقصى لعدد الجلسات المتعددة (Jadibot)
global.CAN_INSTALL = true // التحكم في إتاحة أمر التنصيب (تشغيل/إيقاف)
global.DEVELOPER_MODE = false // true: البوت يرد على المطورين فقط، false: البوت يرد على الجميع

// ==================== إعدادات قاعدة البيانات ====================
global.DATABASE_PATH = './data/database.json'

// ==================== إعدادات الرد التلقائي ====================
global.AUTO_REPLY_DM = process.env.AUTO_REPLY_DM === 'true' // الرد التلقائي في الخاص
global.AUTO_REPLY_MENTION = process.env.AUTO_REPLY_MENTION === 'true' // الرد التلقائي عند الإشارة في المجموعات
global.AUTO_SAVE_INTERVAL = 30000 // 30 ثانية

// ==================== إعدادات الأمان والميزات ====================
global.ANTI_SPAM_COOLDOWN = 3000 // 3 ثواني
global.RATE_LIMIT_MESSAGES = 5 // عدد الرسائل المسموحة
global.RATE_LIMIT_WINDOW = 60000 // في الدقيقة
global.FEATURES = {
    ANTI_LINK: true,
    ANTI_BOT: false,
    WELCOME_MESSAGE: true,
    AUTO_LEVELUP: true,
    REACTION_SYSTEM: true,
    ECONOMY_SYSTEM: true,
    GAME_SYSTEM: true
}

// ==================== إعدادات الأداء والكاش ====================
global.CACHE_TTL = 30000 // مدة بقاء الكاش بالميلي ثانية
global.CLEANUP_INTERVAL = 300000 // 5 دقائق

// ==================== إعدادات الاتصال المتقدمة ====================
global.CONNECTION_OPTIONS = {
    printQRInTerminal: true,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    retryRequestDelayMs: 1000,
    maxRetries: 3
}

// ==================== إعدادات API (إذا لزم الأمر) ====================
global.APIs = {
  // Add your API keys here
}
global.APIKeys = {
  // Add your API keys here
}

// ==================== نظام المراقبة الحية (Hot-Reloading) ====================
let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'config.js'"))
  import(`${file}?update=${Date.now()}`)
})
