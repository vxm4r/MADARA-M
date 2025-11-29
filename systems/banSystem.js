// ============================================================
// 🚫 Advanced Ban System - SOLO Bot\n// ============================================================

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export class BanSystem {
    constructor() {
        this.bannedUsers = new Map();
        this.bannedGroups = new Map();
        this.warnings = new Map();
        this.sock = null;
        this.dbPath = path.join(process.cwd(), 'data', 'bans.json');
    }

    /**
     * تعيين socket الاتصال
     */
    setSock(sock) {
        this.sock = sock;
    }

    /**
     * تهيئة نظام الحظر
     */
    async initialize() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
                Object.entries(data.users || {}).forEach(([jid, banData]) => {
                    this.bannedUsers.set(jid, banData);
                });
                Object.entries(data.groups || {}).forEach(([jid, banData]) => {
                    this.bannedGroups.set(jid, banData);
                });
                Object.entries(data.warnings || {}).forEach(([jid, warns]) => {
                    this.warnings.set(jid, warns);
                });
                console.log(chalk.green(`🚫 تم تحميل بيانات الحظر (${this.bannedUsers.size} مستخدم، ${this.bannedGroups.size} مجموعة)`));
            }
        } catch (e) {
            console.log(chalk.yellow('⚠️  لا توجد بيانات حظر سابقة'));
        }
    }

    /**
     * حظر مستخدم
     */
    banUser(userJid, reason = 'لا يوجد سبب محدد', duration = 0) {
        const banData = {
            userJid,
            reason,
            bannedAt: Date.now(),
            duration: duration, // 0 = حظر دائم
            bannedBy: 'SOLO Bot'
        };
        this.bannedUsers.set(userJid, banData);
        return banData;
    }

    /**
     * فك حظر مستخدم
     */
    unbanUser(userJid) {
        if (this.bannedUsers.has(userJid)) {
            this.bannedUsers.delete(userJid);
            return true;
        }
        return false;
    }

    /**
     * التحقق من حظر المستخدم
     */
    isUserBanned(userJid) {
        if (!this.bannedUsers.has(userJid)) return false;

        const banData = this.bannedUsers.get(userJid);
        if (banData.duration === 0) return true; // حظر دائم

        const now = Date.now();
        const banDuration = now - banData.bannedAt;
        if (banDuration > banData.duration) {
            this.bannedUsers.delete(userJid);
            return false;
        }
        return true;
    }

    /**
     * حظر مجموعة
     */
    banGroup(groupJid, reason = 'لا يوجد سبب محدد', duration = 0) {
        const banData = {
            groupJid,
            reason,
            bannedAt: Date.now(),
            duration: duration,
            bannedBy: 'SOLO Bot'
        };
        this.bannedGroups.set(groupJid, banData);
        return banData;
    }

    /**
     * فك حظر مجموعة
     */
    unbanGroup(groupJid) {
        if (this.bannedGroups.has(groupJid)) {
            this.bannedGroups.delete(groupJid);
            return true;
        }
        return false;
    }

    /**
     * التحقق من حظر المجموعة
     */
    isGroupBanned(groupJid) {
        if (!this.bannedGroups.has(groupJid)) return false;

        const banData = this.bannedGroups.get(groupJid);
        if (banData.duration === 0) return true;

        const now = Date.now();
        const banDuration = now - banData.bannedAt;
        if (banDuration > banData.duration) {
            this.bannedGroups.delete(groupJid);
            return false;
        }
        return true;
    }

    /**
     * إضافة تحذير للمستخدم
     */
    addWarning(userJid, reason = 'تحذير عام') {
        if (!this.warnings.has(userJid)) {
            this.warnings.set(userJid, []);
        }

        const warns = this.warnings.get(userJid);
        warns.push({
            reason,
            warnedAt: Date.now()
        });

        this.warnings.set(userJid, warns);
        return warns.length;
    }

    /**
     * الحصول على عدد التحذيرات
     */
    getWarnings(userJid) {
        return this.warnings.get(userJid) || [];
    }

    /**
     * إزالة تحذيرات المستخدم
     */
    clearWarnings(userJid) {
        if (this.warnings.has(userJid)) {
            this.warnings.delete(userJid);
            return true;
        }
        return false;
    }

    /**
     * الحصول على معلومات الحظر
     */
    getBanInfo(userJid) {
        return this.bannedUsers.get(userJid) || null;
    }

    /**
     * الحصول على جميع المستخدمين المحظورين
     */
    getAllBannedUsers() {
        return Array.from(this.bannedUsers.values());
    }

    /**
     * الحصول على جميع المجموعات المحظورة
     */
    getAllBannedGroups() {
        return Array.from(this.bannedGroups.values());
    }

    /**
     * حفظ بيانات الحظر
     */
    async saveData() {
        try {
            const data = {
                users: Object.fromEntries(this.bannedUsers),
                groups: Object.fromEntries(this.bannedGroups),
                warnings: Object.fromEntries(this.warnings),
                lastSave: Date.now()
            };
            await fs.ensureDir(path.dirname(this.dbPath));
            await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('❌ خطأ في حفظ بيانات الحظر:', e.message);
        }
    }

    /**
     * تنظيف بيانات الحظر المؤقت المنتهية
     */
    cleanExpiredBans() {
        const now = Date.now();

        for (const [jid, banData] of this.bannedUsers.entries()) {
            if (banData.duration > 0) {
                const banDuration = now - banData.bannedAt;
                if (banDuration > banData.duration) {
                    this.bannedUsers.delete(jid);
                }
            }
        }

        for (const [jid, banData] of this.bannedGroups.entries()) {
            if (banData.duration > 0) {
                const banDuration = now - banData.bannedAt;
                if (banDuration > banData.duration) {
                    this.bannedGroups.delete(jid);
                }
            }
        }
    }
}

export default BanSystem;
