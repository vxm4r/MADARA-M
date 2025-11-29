// ============================================================
// 😴 Advanced AFK System - SOLO Bot
// ============================================================

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export class AFKSystem {
    constructor() {
        this.afkUsers = new Map();
        this.sock = null;
        this.dbPath = path.join(process.cwd(), 'data', 'afk.json');
    }

    /**
     * تعيين socket الاتصال
     */
    setSock(sock) {
        this.sock = sock;
    }

    /**
     * تهيئة نظام AFK
     */
    async initialize() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
                Object.entries(data.users || {}).forEach(([jid, afkData]) => {
                    this.afkUsers.set(jid, afkData);
                });
                console.log(chalk.green(`😴 تم تحميل بيانات AFK لـ ${this.afkUsers.size} مستخدم`));
            }
        } catch (e) {
            console.log(chalk.yellow('⚠️  لا توجد بيانات AFK سابقة'));
        }
    }

    /**
     * تعيين المستخدم كـ AFK
     */
    setAFK(userJid, reason = 'غير متاح الآن') {
        const afkData = {
            userJid,
            reason,
            startTime: Date.now(),
            messageCount: 0
        };
        this.afkUsers.set(userJid, afkData);
        return afkData;
    }

    /**
     * إزالة المستخدم من AFK
     */
    removeAFK(userJid) {
        if (this.afkUsers.has(userJid)) {
            const afkData = this.afkUsers.get(userJid);
            const duration = Date.now() - afkData.startTime;
            this.afkUsers.delete(userJid);
            return {
                success: true,
                duration,
                messageCount: afkData.messageCount
            };
        }
        return { success: false };
    }

    /**
     * التحقق من كون المستخدم في AFK
     */
    isAFK(userJid) {
        return this.afkUsers.has(userJid);
    }

    /**
     * الحصول على معلومات AFK للمستخدم
     */
    getAFKInfo(userJid) {
        return this.afkUsers.get(userJid) || null;
    }

    /**
     * زيادة عدد الرسائل أثناء AFK
     */
    incrementMessageCount(userJid) {
        if (this.afkUsers.has(userJid)) {
            const afkData = this.afkUsers.get(userJid);
            afkData.messageCount++;
            this.afkUsers.set(userJid, afkData);
        }
    }

    /**
     * الحصول على مدة AFK بصيغة مقروءة
     */
    getAFKDuration(userJid) {
        const afkData = this.getAFKInfo(userJid);
        if (!afkData) return null;

        const duration = Date.now() - afkData.startTime;
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} يوم و ${hours % 24} ساعة`;
        if (hours > 0) return `${hours} ساعة و ${minutes % 60} دقيقة`;
        if (minutes > 0) return `${minutes} دقيقة و ${seconds % 60} ثانية`;
        return `${seconds} ثانية`;
    }

    /**
     * الحصول على جميع المستخدمين في AFK
     */
    getAllAFKUsers() {
        return Array.from(this.afkUsers.values());
    }

    /**
     * حفظ بيانات AFK
     */
    async saveData() {
        try {
            const data = {
                users: Object.fromEntries(this.afkUsers),
                lastSave: Date.now()
            };
            await fs.ensureDir(path.dirname(this.dbPath));
            await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('❌ خطأ في حفظ بيانات AFK:', e.message);
        }
    }

    /**
     * تنظيف بيانات AFK القديمة (أكثر من 24 ساعة)
     */
    cleanOldAFKData() {
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;

        for (const [jid, afkData] of this.afkUsers.entries()) {
            if (now - afkData.startTime > dayInMs) {
                this.afkUsers.delete(jid);
            }
        }
    }
}

export default AFKSystem;
