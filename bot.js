// ============================================================
// 🤖 SOLO Bot - Main Entry Point
// ============================================================

import { makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs-extra';
import readline from 'readline';
import path from 'path';
import chalk from 'chalk';
import gradient from 'gradient-string';
import { config } from './config.js';
import { Handler } from './systems/handler.js';
import { EconomySystem } from './systems/economy.js';
import { GroupManager } from './systems/groupManager.js';

const logger = pino({ level: 'silent' });

class SOLOBot {
    constructor() {
        this.sock = null;
        this.authState = null;
        this.saveCreds = null;
        this.isConnected = false;
        this.startTime = Date.now();
        this.connectionRetries = 0;
        this.maxRetries = config.MAX_RETRIES;
        this.config = config;
        this.handler = null;
        this.economy = null;
        this.groupManager = null;
        
        global.bot = this;
    }

    /**
     * تهيئة البوت
     */
    async initialize() {
        try {
            console.clear();
            this.showBanner();
            this.createDirectories();
            await this.initializeAuth();
            this.startConnection();
        } catch (error) {
            console.log(chalk.red('❌ Initial setup failed:'), error.message);
            await this.handleReconnection();
        }
    }

    /**
     * عرض البانر الترحيبي
     */
    showBanner() {
        console.log(gradient.rainbow(`
╔══════════════════════════════════════════════════╗
║                 SOLO BOT SYSTEM                  ║
║                 Developed by KING                ║
║               +201005199558                      ║
╚══════════════════════════════════════════════════╝
        `));
        console.log(chalk.cyan('🚀 Starting advanced WhatsApp bot...\n'));
    }

    /**
     * إنشاء المجلدات الأساسية
     */
    createDirectories() {
        const dirs = [
            config.SESSION_PATH,
            './plugins',
            './data',
            './temp'
        ];
        dirs.forEach(dir => fs.ensureDirSync(dir));
    }

    /**
     * تهيئة نظام المصادقة
     */
    async initializeAuth() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(config.SESSION_PATH);
            this.authState = state;
            this.saveCreds = saveCreds;
            console.log(chalk.green('✅ Auth system initialized'));
        } catch (error) {
            console.log(chalk.red('❌ Auth initialization failed:'), error.message);
            throw error;
        }
    }

    /**
     * بدء الاتصال بـ WhatsApp
     */
    async startConnection() {
        try {
            this.sock = makeWASocket({
                auth: {
                    creds: this.authState.creds,
                    keys: makeCacheableSignalKeyStore(this.authState.keys, logger),
                },
                logger: logger,
                printQRInTerminal: false,
                browser: Browsers.ubuntu('Chrome'),
                markOnlineOnConnect: true,
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                retryRequestDelayMs: 1000,
                maxRetries: 3,
            });

            this.setupEventHandlers();

            if (this.authState.creds.registered) {
                await this.waitForConnection();
            } else {
                await this.startPhoneAuth();
            }
        } catch (error) {
            console.log(chalk.red('❌ Connection failed:'), error.message);
            throw error;
        }
    }

    /**
     * انتظار الاتصال
     */
    async waitForConnection() {
        return new Promise((resolve) => {
            const connectionHandler = (update) => {
                if (update.connection === 'open') {
                    this.sock.ev.off('connection.update', connectionHandler);
                    resolve();
                }
            };
            this.sock.ev.on('connection.update', connectionHandler);
        });
    }

    /**
     * بدء المصادقة عبر الهاتف
     */
    async startPhoneAuth() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        try {
            const phoneNumber = await new Promise((resolve) => {
                rl.question(chalk.cyan('📱 Enter phone number (with country code): '), resolve);
            });

            if (!phoneNumber) {
                console.log(chalk.red('❌ Phone number required'));
                process.exit(1);
            }

            const cleanNumber = phoneNumber.replace(/[+\s]/g, '');
            console.log(chalk.cyan('⏳ Requesting pairing code...'));
            
            const code = await this.sock.requestPairingCode(cleanNumber);
            
            console.log(chalk.cyan('╔══════════════════════════════════╗'));
            console.log(chalk.cyan('║         📱 PAIRING CODE         ║'));
            console.log(chalk.cyan('╚══════════════════════════════════╝'));
            console.log(chalk.bold.greenBright(`\n          
╭─── • 𝐒𝐎𝐋𝐎 • ───╮
│≠ 𝑪𝑶𝑫𝑬: ${code}
│≠ 𝑺𝑶𝑳𝑶.. 
╰─── • 𝐒𝐎𝐋𝐎 • ───
\n`));
            
            console.log(chalk.cyan('⏳ Waiting for pairing... (2 minutes)'));
            
            await this.waitForConnection();
            
            rl.close();
            console.log(chalk.green('✅ Paired successfully!'));
        } catch (error) {
            console.log(chalk.red('❌ Phone auth failed:'), error.message);
            rl.close();
            throw error;
        }
    }

    /**
     * إعداد معالجات الأحداث
     */
    setupEventHandlers() {
        this.sock.ev.on('connection.update', (update) => {
            this.handleConnectionUpdate(update);
        });

        this.sock.ev.on('messages.upsert', (m) => {
            this.handleMessagesUpsert(m);
        });

        this.sock.ev.on('creds.update', () => {
            if (this.saveCreds) {
                this.saveCreds();
            }
        });
    }

    /**
     * معالجة تحديثات الاتصال
     */
    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            this.isConnected = true;
            this.connectionRetries = 0;
            console.log(chalk.green('✅ Connected to WhatsApp!'));
            
            if (!this.handler) {
                console.log(chalk.cyan('🚀 First connection, loading all systems...'));
                await this.loadSystems();
                console.log(chalk.green('🎉 SOLO Bot is now fully operational!'));
            }
            
            if (this.saveCreds) {
                this.saveCreds();
            }
        } else if (connection === 'close') {
            this.isConnected = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            
            const isCriticalError = statusCode === DisconnectReason.loggedOut || 
                                    statusCode === DisconnectReason.connectionReplaced;

            if (isCriticalError) {
                console.log(chalk.red('❌ Critical session issue detected. Restarting from scratch...'));
                try {
                    fs.rmSync(config.SESSION_PATH, { recursive: true, force: true });
                } catch (e) {
                    console.error(chalk.red('❌ Failed to clean session directory:'), e.message);
                }
                process.exit(1);
            } else {
                this.startConnection();
            }
        }
    }

    /**
     * معالجة الرسائل الواردة
     */
    async handleMessagesUpsert(m) {
        try {
            const message = m.messages[0];
            if (!message || !message.message || message.key.remoteJid === 'status@broadcast') return;
            
            const messageTime = message.messageTimestamp ? message.messageTimestamp * 1000 : Date.now();
            if (messageTime < this.startTime - 10000) {
                return;
            }

            if (this.handler) {
                await this.handler.handleMessage(message);
            }
        } catch (error) {
            console.log(chalk.red('❌ Message handling error:'), error.message);
        }
    }

    /**
     * تحميل جميع الأنظمة
     */
    async loadSystems() {
        try {
            this.handler = new Handler(this);
            await this.handler.loadPlugins();
            
            this.economy = new EconomySystem();
            this.economy.setSock(this.sock);
            await this.economy.initialize();
            
            this.groupManager = new GroupManager();
            this.groupManager.setSock(this.sock);
            await this.groupManager.initialize();
            
            // حفظ دوري للبيانات
            setInterval(async () => {
                await this.economy.saveData();
                await this.groupManager.saveData();
                this.handler.saveData();
            }, config.AUTO_SAVE_INTERVAL);
            
            console.log(chalk.green('✅ All systems loaded successfully'));
        } catch (error) {
            console.log(chalk.red('❌ System loading failed:'), error.message);
        }
    }

    /**
     * معالجة إعادة الاتصال
     */
    async handleReconnection() {
        this.connectionRetries++;
        if (this.connectionRetries > this.maxRetries) {
            console.log(chalk.red('❌ Max reconnection attempts reached'));
            process.exit(1);
        }

        console.log(chalk.yellow(`🔄 Reconnection attempt ${this.connectionRetries}/${this.maxRetries}`));
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.initialize();
    }

    /**
     * إرسال رسالة
     */
    async sendMessage(jid, content, options = {}) {
        try {
            return await this.sock.sendMessage(jid, content, options);
        } catch (error) {
            console.log(chalk.red('❌ Send message error:'), error.message);
        }
    }

    /**
     * الحصول على معلومات النظام
     */
    getSystemInfo() {
        return {
            uptime: Date.now() - this.startTime,
            connected: this.isConnected,
            connectionRetries: this.connectionRetries,
            messagesProcessed: this.handler?.stats?.messagesProcessed || 0,
            pluginsLoaded: this.handler?.commands?.size || 0,
            usersTracked: this.handler?.userData?.size || 0,
            groupsTracked: this.handler?.groupData?.size || 0
        };
    }
}

/**
 * نقطة الدخول الرئيسية
 */
async function main() {
    const bot = new SOLOBot();
    try {
        await bot.initialize();
    } catch (error) {
        console.error(chalk.red('❌ A critical error occurred during bot initialization:'), error);
        process.exit(1);
    }
}

main();

/**
 * معالجة إشارات الإيقاف
 */
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Shutting down SOLO Bot...'));
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n🛑 SOLO Bot terminated'));
    process.exit(0);
});

export default SOLOBot;
