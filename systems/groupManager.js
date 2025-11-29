// ============================================================
// 👥 Group Manager System
// ============================================================

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export class GroupManager {
    constructor() {
        this.groups = new Map();
        this.sock = null;
        this.dbPath = path.join(process.cwd(), 'data', 'groups.json');
    }

    /**
     * تعيين socket الاتصال
     */
    setSock(sock) {
        this.sock = sock;
    }

    /**
     * تهيئة نظام إدارة المجموعات
     */
    async initialize() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
                Object.entries(data.groups || {}).forEach(([jid, settings]) => {
                    this.groups.set(jid, settings);
                });
                console.log(chalk.green(`👥 تم تحميل إعدادات ${this.groups.size} مجموعة`));
            } else {
                console.log(chalk.yellow('⚠️  لا توجد إعدادات مجموعات سابقة'));
            }
        } catch (e) {
            console.log(chalk.yellow('⚠️  خطأ في تحميل إعدادات المجموعات:', e.message));
        }
    }

    /**
     * الحصول على إعدادات المجموعة
     */
    getGroup(chatJid, createIfNotExists = true) {
        const cached = this.groups.get(chatJid);
        if (cached) return cached;

        if (createIfNotExists) {
            const newGroup = {
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
                sCondition: '',
                welcomeMessage: 'أهلا وسهلا بك في المجموعة! 👋',
                goodbyeMessage: 'وداعا! 👋'
            };
            this.groups.set(chatJid, newGroup);
            return newGroup;
        }
        return null;
    }

    /**
     * تفعيل/تعطيل Anti-Link
     */
    setAntiLink(chatJid, status) {
        const group = this.getGroup(chatJid);
        group.antiLink = status;
        return true;
    }

    /**
     * تفعيل/تعطيل رسالة الترحيب
     */
    setWelcome(chatJid, status) {
        const group = this.getGroup(chatJid);
        group.welcome = status;
        return true;
    }

    /**
     * تفعيل/تعطيل نظام الردود
     */
    setReaction(chatJid, status) {
        const group = this.getGroup(chatJid);
        group.reaction = status;
        return true;
    }

    /**
     * تفعيل/تعطيل الترقية التلقائية
     */
    setAutolevelup(chatJid, status) {
        const group = this.getGroup(chatJid);
        group.autolevelup = status;
        return true;
    }

    /**
     * تفعيل/تعطيل Anti-Bot
     */
    setAntiBot(chatJid, status) {
        const group = this.getGroup(chatJid);
        group.antiBot = status;
        return true;
    }

    /**
     * تفعيل/تعطيل NSFW
     */
    setNSFW(chatJid, status) {
        const group = this.getGroup(chatJid);
        group.nsfw = status;
        return true;
    }

    /**
     * تعيين رسالة الترحيب المخصصة
     */
    setWelcomeMessage(chatJid, message) {
        const group = this.getGroup(chatJid);
        group.welcomeMessage = message;
        return true;
    }

    /**
     * تعيين رسالة الوداع المخصصة
     */
    setGoodbyeMessage(chatJid, message) {
        const group = this.getGroup(chatJid);
        group.goodbyeMessage = message;
        return true;
    }

    /**
     * الحصول على جميع الميزات المفعلة
     */
    getEnabledFeatures(chatJid) {
        const group = this.getGroup(chatJid);
        const features = [];

        if (group.antiLink) features.push('🔗 Anti-Link');
        if (group.antiBot) features.push('🤖 Anti-Bot');
        if (group.nsfw) features.push('🔞 NSFW');
        if (group.welcome) features.push('👋 Welcome');
        if (group.autolevelup) features.push('📈 Auto-Levelup');
        if (group.autoresponder) features.push('💬 Auto-Responder');
        if (group.reaction) features.push('😊 Reactions');
        if (group.antitoxic) features.push('🚫 Anti-Toxic');

        return features;
    }

    /**
     * حفظ بيانات المجموعات
     */
    async saveData() {
        try {
            const data = {
                groups: Object.fromEntries(this.groups),
                lastSave: Date.now()
            };
            await fs.ensureDir(path.dirname(this.dbPath));
            await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('❌ خطأ في حفظ إعدادات المجموعات:', e.message);
        }
    }

    /**
     * إعادة تعيين إعدادات المجموعة
     */
    resetGroup(chatJid) {
        this.groups.delete(chatJid);
        return this.getGroup(chatJid);
    }
}

export default GroupManager;
