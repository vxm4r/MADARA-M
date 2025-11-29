// ============================================================
// 🎮 Command Handler System
// ============================================================

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import gradient from 'gradient-string';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class Handler {
    constructor(bot) {
        this.bot = bot;
        this.commands = new Map();
        this.aliases = new Map();
        this.plugins = new Map();
        this.pluginDir = './plugins';
        
        // إحصائيات البوت
        this.stats = {
            commandsExecuted: 0,
            messagesProcessed: 0,
            errors: 0,
            startTime: Date.now()
        };
        
        // الأنظمة المتقدمة
        this.cooldowns = new Map();
        this.userData = new Map();
        this.groupData = new Map();
        this.cache = new Map();
        this.sessions = new Map();
        this.gameSessions = new Map();
        
        // نظام الأمان
        this.security = {
            blockedUsers: new Set(),
            spamDetection: new Map(),
            rateLimits: new Map(),
            commandPermissions: new Map()
        };

        this.messageQueue = [];
        this.isProcessing = false;
        this.responseCache = new Map();
        this.cacheTTL = 30000;
        this.isInitialized = false;
        
        this.ensureDirectories();
        this.loadData();
        this.startCleanupCycle();
        
        console.log(gradient.rainbow(`
        
███████  ██████  ██      ██████
██       ██  ██  ██      ██  ██
███████  ██  ██  ██      ██  ██
     ██  ██  ██  ██      ██  ██
███████  ██████  ███████ ██████

        `));
    }

    /**
     * إنشاء المجلدات الأساسية
     */
    ensureDirectories() {
        const dirs = [this.pluginDir, './data', './temp'];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    /**
     * حفظ بيانات البوت
     */
    saveData() {
        try {
            const data = {
                userData: Object.fromEntries(this.userData),
                groupData: Object.fromEntries(this.groupData),
                stats: this.stats,
                security: {
                    blockedUsers: Array.from(this.security.blockedUsers)
                }
            };
            fs.writeJSONSync('./data/bot_data.json', data, { spaces: 2 });
        } catch (error) {
            console.log(chalk.red('❌ Save data error:'), error.message);
        }
    }

    /**
     * تحميل بيانات البوت
     */
    loadData() {
        try {
            if (fs.existsSync('./data/bot_data.json')) {
                const data = fs.readJSONSync('./data/bot_data.json');
                this.userData = new Map(Object.entries(data.userData || {}));
                this.groupData = new Map(Object.entries(data.groupData || {}));
                this.stats = { ...this.stats, ...data.stats };
                if (data.security) {
                    this.security.blockedUsers = new Set(data.security.blockedUsers || []);
                }
                console.log(chalk.green('✅ Bot data loaded successfully'));
            }
        } catch (error) {
            console.log(chalk.red('❌ Load data error:'), error.message);
        }
    }

    /**
     * الحصول على بيانات المستخدم
     */
    getUserData(userJid) {
        if (!this.userData.has(userJid)) {
            this.userData.set(userJid, {
                messageCount: 0,
                commandCount: 0,
                firstSeen: Date.now(),
                lastSeen: Date.now(),
                level: 1,
                exp: 0,
                permissions: {
                    isAdmin: false,
                    isPremium: false,
                    canUseAllCommands: true,
                    restrictedCommands: []
                },
                stats: {
                    gamesPlayed: 0,
                    downloads: 0,
                    queries: 0,
                    adminCommandsUsed: 0,
                    gameCommandsUsed: 0,
                    infoCommandsUsed: 0,
                    mediaCommandsUsed: 0
                }
            });
        }
        return this.userData.get(userJid);
    }

    /**
     * الحصول على بيانات المجموعة
     */
    getGroupData(groupJid) {
        if (!this.groupData.has(groupJid)) {
            this.groupData.set(groupJid, {
                antiLink: true,
                antiBot: false,
                nsfw: false,
                detect: true,
                welcome: true,
                autolevelup: false,
                autoresponder: false,
                reaction: true,
                delete: false,
                expired: 0,
                isBanned: false,
                sAutoresponder: '',
                autoAceptar: false,
                autoRechazar: false,
                antiBot2: false,
                modoadmin: false,
                antifake: false,
                antiLag: false,
                per: [],
                antiLink2: false,
                antiTiktok: false,
                antiYoutube: false,
                antiTelegram: false,
                antiFacebook: false,
                antiInstagram: false,
                antiTwitter: false,
                antiDiscord: false,
                antiThreads: false,
                antiTwitch: false,
                antitoxic: true,
                antiTraba: true,
                viewonce: false,
                sCondition: ''
            });
        }
        return this.groupData.get(groupJid);
    }

    /**
     * التحقق من كون المستخدم مطور
     */
    isDeveloper(jid) {
        if (!jid || typeof jid !== 'string') return false;
        
        const ownerConfig = this.bot.config?.DEVELOPERS;
        if (!ownerConfig || !Array.isArray(ownerConfig)) return false;

        const cleanJidNumber = String(jid).split('@')[0].split(':')[0];

        for (const dev of ownerConfig) {
            if (!dev) continue;
            const cleanDevNumber = String(dev).split('@')[0].split(':')[0];
            if (cleanJidNumber === cleanDevNumber) return true;
        }

        return false;
    }

    /**
     * تحميل الملحقات (Plugins)
     */
    async loadPlugins() {
        try {
            const pluginFiles = fs.readdirSync(this.pluginDir).filter(f => f.endsWith('.js'));
            console.log(chalk.cyan(`📦 Loading ${pluginFiles.length} plugins...`));
            
            for (const file of pluginFiles) {
                try {
                    const pluginPath = path.join(this.pluginDir, file);
                    const { default: plugin } = await import(`file://${pluginPath}`);
                    
                    if (plugin && plugin.command) {
                        this.commands.set(plugin.command, plugin);
                        if (plugin.aliases) {
                            plugin.aliases.forEach(alias => {
                                this.aliases.set(alias, plugin.command);
                            });
                        }
                        console.log(chalk.green(`✅ Loaded plugin: ${file}`));
                    }
                } catch (error) {
                    console.log(chalk.red(`❌ Error loading plugin ${file}:`, error.message));
                }
            }
            
            console.log(chalk.green(`✅ Total plugins loaded: ${this.commands.size}`));
        } catch (error) {
            console.log(chalk.red('❌ Error loading plugins:'), error.message);
        }
    }

    /**
     * معالجة الرسالة
     */
    async handleMessage(message) {
        try {
            this.stats.messagesProcessed++;
            
            const text = message.message?.conversation || 
                        message.message?.extendedTextMessage?.text || '';
            
            if (!text) return;

            const args = text.trim().split(' ');
            const command = args[0].toLowerCase().replace(/^\./, '');
            
            const userJid = message.key.participant || message.key.remoteJid;
            const userData = this.getUserData(userJid);
            
            userData.lastSeen = Date.now();
            userData.messageCount++;

            // البحث عن الأمر
            let cmd = this.commands.get(command);
            if (!cmd && this.aliases.has(command)) {
                cmd = this.commands.get(this.aliases.get(command));
            }

            if (cmd) {
                userData.commandCount++;
                userData.stats.adminCommandsUsed++;
                this.stats.commandsExecuted++;
                
                try {
                    await cmd.execute(message, args, this.bot);
                } catch (error) {
                    console.log(chalk.red('❌ Command execution error:'), error.message);
                    this.stats.errors++;
                }
            }

        } catch (error) {
            console.log(chalk.red('❌ Message handling error:'), error.message);
            this.stats.errors++;
        }
    }

    /**
     * دورة التنظيف الدوري
     */
    startCleanupCycle() {
        setInterval(() => {
            // تنظيف الكاش القديم
            for (const [key, value] of this.cache.entries()) {
                if (Date.now() - value.timestamp > this.cacheTTL) {
                    this.cache.delete(key);
                }
            }
            
            // حفظ البيانات
            this.saveData();
            
            console.log(chalk.cyan(`🧹 Cleanup cycle completed. Cache size: ${this.cache.size}`));
        }, 300000); // كل 5 دقائق
    }

    /**
     * الحصول على إحصائيات البوت
     */
    getStats() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            commandsLoaded: this.commands.size,
            usersTracked: this.userData.size,
            groupsTracked: this.groupData.size
        };
    }
}

export default Handler;
