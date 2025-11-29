// ============================================================
// 💰 Economy System
// ============================================================

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export class EconomySystem {
    constructor() {
        this.users = new Map();
        this.sock = null;
        this.dbPath = path.join(process.cwd(), 'data', 'economy.json');
    }

    /**
     * تعيين socket الاتصال
     */
    setSock(sock) {
        this.sock = sock;
    }

    /**
     * تهيئة نظام الاقتصاد
     */
    async initialize() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = JSON.parse(fs.readFileSync(this.dbPath, 'utf8'));
                Object.entries(data.users || {}).forEach(([jid, user]) => {
                    this.users.set(jid, user);
                });
                console.log(chalk.green(`💰 تم تحميل بيانات ${this.users.size} مستخدم اقتصادي`));
            } else {
                console.log(chalk.yellow('⚠️  لا توجد بيانات اقتصادية سابقة'));
            }
        } catch (e) {
            console.log(chalk.yellow('⚠️  خطأ في تحميل بيانات الاقتصاد:', e.message));
        }
    }

    /**
     * الحصول على بيانات المستخدم الاقتصادية
     */
    getUser(userJid, createIfNotExists = true) {
        const cached = this.users.get(userJid);
        if (cached) return cached;

        if (createIfNotExists) {
            const newUser = {
                exp: 0,
                coin: 10,
                diamond: 3,
                bank: 0,
                level: 0,
                health: 100,
                lastclaim: 0,
                lastadventure: 0,
                lastmining: 0,
                lastduel: 0,
                registered: false,
                name: '',
                age: -1,
                regTime: -1,
                warn: 0,
                banned: false,
                premium: false,
                premiumTime: 0,
                role: 'Nuv',
                afk: -1,
                afkReason: '',
                genre: '',
                birth: '',
                marry: '',
                description: '',
                packstickers: null,
                muto: false,
                useDocument: false
            };
            this.users.set(userJid, newUser);
            return newUser;
        }
        return null;
    }

    /**
     * إضافة تجربة للمستخدم
     */
    addExp(userJid, amount) {
        const user = this.getUser(userJid);
        user.exp += amount;
        
        const neededExp = user.level * 100 + 100;
        if (user.exp >= neededExp) {
            user.level++;
            user.exp -= neededExp;
            return { levelUp: true, newLevel: user.level };
        }
        return { levelUp: false };
    }

    /**
     * إضافة عملات للمستخدم
     */
    addCoins(userJid, amount) {
        const user = this.getUser(userJid);
        user.coin += amount;
        return user.coin;
    }

    /**
     * إضافة ماس للمستخدم
     */
    addDiamonds(userJid, amount) {
        const user = this.getUser(userJid);
        user.diamond += amount;
        return user.diamond;
    }

    /**
     * خصم عملات من المستخدم
     */
    removeCoins(userJid, amount) {
        const user = this.getUser(userJid);
        if (user.coin < amount) return false;
        user.coin -= amount;
        return true;
    }

    /**
     * خصم ماس من المستخدم
     */
    removeDiamonds(userJid, amount) {
        const user = this.getUser(userJid);
        if (user.diamond < amount) return false;
        user.diamond -= amount;
        return true;
    }

    /**
     * إيداع أموال في البنك
     */
    deposit(userJid, amount) {
        const user = this.getUser(userJid);
        if (user.coin < amount) return false;
        user.coin -= amount;
        user.bank += amount;
        return true;
    }

    /**
     * سحب أموال من البنك
     */
    withdraw(userJid, amount) {
        const user = this.getUser(userJid);
        if (user.bank < amount) return false;
        user.bank -= amount;
        user.coin += amount;
        return true;
    }

    /**
     * المطالبة بالمكافأة اليومية
     */
    async claimDaily(userJid) {
        const user = this.getUser(userJid);
        const now = Date.now();
        const lastClaim = user.lastclaim || 0;
        const dayInMs = 24 * 60 * 60 * 1000;

        if (now - lastClaim < dayInMs) {
            const remainingTime = dayInMs - (now - lastClaim);
            return {
                success: false,
                message: `⏳ يمكنك المطالبة مجددا بعد ${Math.ceil(remainingTime / 60000)} دقيقة`,
                remainingTime
            };
        }

        const reward = 100;
        user.coin += reward;
        user.lastclaim = now;

        return {
            success: true,
            message: `✅ حصلت على ${reward} عملة!`,
            reward
        };
    }

    /**
     * تسجيل المستخدم في النظام الاقتصادي
     */
    registerUser(userJid, name, age, genre) {
        const user = this.getUser(userJid);
        user.registered = true;
        user.name = name;
        user.age = age;
        user.genre = genre;
        user.regTime = Date.now();
        return user;
    }

    /**
     * الحصول على ترتيب الأغنياء
     */
    getTopRichest(limit = 10) {
        return Array.from(this.users.values())
            .sort((a, b) => (b.coin + b.bank) - (a.coin + a.bank))
            .slice(0, limit)
            .map((user, index) => ({
                rank: index + 1,
                ...user
            }));
    }

    /**
     * الحصول على ترتيب الأعلى مستوى
     */
    getTopLevels(limit = 10) {
        return Array.from(this.users.values())
            .sort((a, b) => b.level - a.level)
            .slice(0, limit)
            .map((user, index) => ({
                rank: index + 1,
                ...user
            }));
    }

    /**
     * حفظ البيانات الاقتصادية
     */
    async saveData() {
        try {
            const data = {
                users: Object.fromEntries(this.users),
                lastSave: Date.now()
            };
            await fs.ensureDir(path.dirname(this.dbPath));
            await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error('❌ خطأ في حفظ البيانات الاقتصادية:', e.message);
        }
    }
}

export default EconomySystem;
