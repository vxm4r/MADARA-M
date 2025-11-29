// ============================================================
// 📨 Message Processing System
// ============================================================

import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

/**
 * معالج الرسائل البسيط
 * يوفر وظائف أساسية لمعالجة الرسائل والملفات
 */
export class SimpleMessage {
    constructor(sock) {
        this.sock = sock;
    }

    /**
     * تحويل رقم الهاتف إلى JID
     */
    static jidNormalizer(number) {
        if (!number) return null;
        const cleaned = number.replace(/[^0-9]/g, '');
        return cleaned + '@s.whatsapp.net';
    }

    /**
     * استخراج رقم الهاتف من JID
     */
    static extractNumber(jid) {
        if (!jid) return null;
        return jid.split('@')[0].split(':')[0];
    }

    /**
     * التحقق من كون المستخدم مسؤول مجموعة
     */
    async isAdmin(groupJid, userJid) {
        try {
            const metadata = await this.sock.groupMetadata(groupJid);
            const participant = metadata.participants.find(p => p.id === userJid);
            return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
        } catch (error) {
            console.log(chalk.red('❌ Error checking admin status:'), error.message);
            return false;
        }
    }

    /**
     * التحقق من كون البوت مسؤول المجموعة
     */
    async isBotAdmin(groupJid) {
        try {
            const botJid = this.sock.user?.id;
            return await this.isAdmin(groupJid, botJid);
        } catch (error) {
            console.log(chalk.red('❌ Error checking bot admin status:'), error.message);
            return false;
        }
    }

    /**
     * تحميل ملف من الرسالة
     */
    async downloadFile(message, filename = '') {
        try {
            const type = Object.keys(message.message)[0];
            const msg = message.message[type];
            
            let buffer;
            if (type === 'imageMessage') {
                buffer = await downloadContentFromMessage(msg, 'image');
            } else if (type === 'videoMessage') {
                buffer = await downloadContentFromMessage(msg, 'video');
            } else if (type === 'audioMessage') {
                buffer = await downloadContentFromMessage(msg, 'audio');
            } else if (type === 'documentMessage') {
                buffer = await downloadContentFromMessage(msg, 'document');
            } else {
                return null;
            }

            const chunks = [];
            for await (const chunk of buffer) {
                chunks.push(chunk);
            }

            const file = Buffer.concat(chunks);
            if (filename) {
                const filepath = path.join('./temp', filename);
                await fs.ensureDir('./temp');
                await fs.writeFile(filepath, file);
                return filepath;
            }
            return file;
        } catch (error) {
            console.log(chalk.red('❌ Error downloading file:'), error.message);
            return null;
        }
    }

    /**
     * إرسال رسالة نصية
     */
    async sendText(jid, text, options = {}) {
        try {
            return await this.sock.sendMessage(jid, { text }, options);
        } catch (error) {
            console.log(chalk.red('❌ Error sending text:'), error.message);
        }
    }

    /**
     * إرسال صورة
     */
    async sendImage(jid, image, caption = '', options = {}) {
        try {
            return await this.sock.sendMessage(jid, { 
                image: typeof image === 'string' ? { url: image } : image,
                caption 
            }, options);
        } catch (error) {
            console.log(chalk.red('❌ Error sending image:'), error.message);
        }
    }

    /**
     * إرسال فيديو
     */
    async sendVideo(jid, video, caption = '', options = {}) {
        try {
            return await this.sock.sendMessage(jid, { 
                video: typeof video === 'string' ? { url: video } : video,
                caption 
            }, options);
        } catch (error) {
            console.log(chalk.red('❌ Error sending video:'), error.message);
        }
    }

    /**
     * إرسال صوت
     */
    async sendAudio(jid, audio, options = {}) {
        try {
            return await this.sock.sendMessage(jid, { 
                audio: typeof audio === 'string' ? { url: audio } : audio,
                mimetype: 'audio/mpeg'
            }, options);
        } catch (error) {
            console.log(chalk.red('❌ Error sending audio:'), error.message);
        }
    }

    /**
     * إرسال رسالة مع رد
     */
    async reply(message, text, options = {}) {
        try {
            return await this.sock.sendMessage(message.key.remoteJid, { text }, {
                quoted: message,
                ...options
            });
        } catch (error) {
            console.log(chalk.red('❌ Error sending reply:'), error.message);
        }
    }

    /**
     * حذف رسالة
     */
    async deleteMessage(jid, key) {
        try {
            return await this.sock.sendMessage(jid, { delete: key });
        } catch (error) {
            console.log(chalk.red('❌ Error deleting message:'), error.message);
        }
    }

    /**
     * تعديل رسالة
     */
    async editMessage(jid, key, text) {
        try {
            return await this.sock.sendMessage(jid, { text }, { edit: key });
        } catch (error) {
            console.log(chalk.red('❌ Error editing message:'), error.message);
        }
    }
}

export default SimpleMessage;
