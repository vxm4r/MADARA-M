// ============================================================
// 📨 Advanced Message Processing System - SOLO Bot
// ============================================================

import { downloadContentFromMessage, generateWAMessageFromContent, proto } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import NodeCache from 'node-cache';

/**
 * نظام معالجة الرسائل المتقدم
 * يوفر وظائف متقدمة لمعالجة الرسائل والأزرار والقوائم والملفات
 */
export class SimpleMessage {
    constructor(sock) {
        this.sock = sock;
        this.cache = new NodeCache({ stdTTL: 600 }); // كاش بـ 10 دقائق
        this.messageQueue = [];
        this.isProcessing = false;
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
            const cacheKey = `admin_${groupJid}_${userJid}`;
            const cached = this.cache.get(cacheKey);
            if (cached !== undefined) return cached;

            const metadata = await this.sock.groupMetadata(groupJid);
            const participant = metadata.participants.find(p => p.id === userJid);
            const result = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
            
            this.cache.set(cacheKey, result);
            return result;
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
     * إرسال رسالة نصية عادية
     */
    async sendText(jid, text, options = {}) {
        try {
            return await this.sock.sendMessage(jid, { text }, options);
        } catch (error) {
            console.log(chalk.red('❌ Error sending text:'), error.message);
        }
    }

    /**
     * إرسال رسالة مع أزرار (Buttons)
     */
    async sendButton(jid, text, buttons = [], title = 'SOLO Bot', options = {}) {
        try {
            const buttonMessage = {
                text: text,
                footer: title,
                buttons: buttons.map((btn, idx) => ({
                    buttonId: btn.id || `btn_${idx}`,
                    buttonText: { displayText: btn.text },
                    type: 1
                })),
                headerType: 1
            };

            const msg = generateWAMessageFromContent(jid, {
                buttonsMessage: buttonMessage
            }, { userJid: this.sock.user.id });

            return await this.sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
        } catch (error) {
            console.log(chalk.red('❌ Error sending buttons:'), error.message);
        }
    }

    /**
     * إرسال قائمة تفاعلية (List Message)
     */
    async sendList(jid, text, sections = [], title = 'SOLO Bot', buttonText = 'اختر من القائمة', options = {}) {
        try {
            const listMessage = {
                title: title,
                sections: sections,
                buttonText: buttonText,
                description: text,
                footerText: 'SOLO Bot'
            };

            const msg = generateWAMessageFromContent(jid, {
                listMessage: listMessage
            }, { userJid: this.sock.user.id });

            return await this.sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
        } catch (error) {
            console.log(chalk.red('❌ Error sending list:'), error.message);
        }
    }

    /**
     * إرسال رسالة مع صورة وأزرار
     */
    async sendImageButton(jid, image, text, buttons = [], options = {}) {
        try {
            let imageBuffer;
            if (typeof image === 'string') {
                if (image.startsWith('http')) {
                    const response = await fetch(image);
                    imageBuffer = await response.buffer();
                } else {
                    imageBuffer = await fs.readFile(image);
                }
            } else {
                imageBuffer = image;
            }

            const msg = generateWAMessageFromContent(jid, {
                templateMessage: {
                    hydratedTemplate: {
                        imageMessage: {
                            mediaKey: null,
                            mimetype: 'image/jpeg',
                            plaintextUrl: '',
                            jpegThumbnail: imageBuffer
                        },
                        hydratedContentText: text,
                        hydratedButtons: buttons.map((btn, idx) => ({
                            urlButton: btn.url ? {
                                displayText: btn.text,
                                url: btn.url
                            } : null,
                            callButton: btn.phone ? {
                                displayText: btn.text,
                                phoneNumber: btn.phone
                            } : null,
                            quickReplyButton: btn.id ? {
                                displayText: btn.text,
                                id: btn.id
                            } : null
                        }))
                    }
                }
            }, { userJid: this.sock.user.id });

            return await this.sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
        } catch (error) {
            console.log(chalk.red('❌ Error sending image button:'), error.message);
        }
    }

    /**
     * إرسال صورة عادية
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
     * إرسال مستند (Document)
     */
    async sendDocument(jid, document, filename = 'document', options = {}) {
        try {
            return await this.sock.sendMessage(jid, { 
                document: typeof document === 'string' ? { url: document } : document,
                mimetype: 'application/pdf',
                fileName: filename
            }, options);
        } catch (error) {
            console.log(chalk.red('❌ Error sending document:'), error.message);
        }
    }

    /**
     * إرسال رسالة مع رد (Quote)
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

    /**
     * إرسال رسالة مع رد سريع (Quick Reply)
     */
    async sendQuickReply(jid, text, quickReplies = [], options = {}) {
        try {
            const msg = generateWAMessageFromContent(jid, {
                extendedTextMessage: {
                    text: text,
                    contextInfo: {
                        externalAdReply: {
                            title: 'SOLO Bot',
                            body: 'Advanced WhatsApp Bot',
                            showAdAttribution: true
                        },
                        mentionedJid: []
                    },
                    inviteLinkGroupTypeV2: 0
                }
            }, { userJid: this.sock.user.id });

            return await this.sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
        } catch (error) {
            console.log(chalk.red('❌ Error sending quick reply:'), error.message);
        }
    }

    /**
     * إرسال رسالة مع تفاعل (Reaction)
     */
    async sendReaction(jid, messageKey, emoji) {
        try {
            return await this.sock.sendMessage(jid, {
                react: {
                    text: emoji,
                    key: messageKey
                }
            });
        } catch (error) {
            console.log(chalk.red('❌ Error sending reaction:'), error.message);
        }
    }

    /**
     * إرسال رسالة مع إعادة توجيه (Forward)
     */
    async forwardMessage(jid, message, options = {}) {
        try {
            return await this.sock.sendMessage(jid, { forward: message }, options);
        } catch (error) {
            console.log(chalk.red('❌ Error forwarding message:'), error.message);
        }
    }

    /**
     * الحصول على معلومات المجموعة
     */
    async getGroupInfo(groupJid) {
        try {
            const cacheKey = `group_info_${groupJid}`;
            const cached = this.cache.get(cacheKey);
            if (cached) return cached;

            const metadata = await this.sock.groupMetadata(groupJid);
            this.cache.set(cacheKey, metadata);
            return metadata;
        } catch (error) {
            console.log(chalk.red('❌ Error getting group info:'), error.message);
            return null;
        }
    }

    /**
     * الحصول على معلومات المستخدم
     */
    async getUserInfo(userJid) {
        try {
            const cacheKey = `user_info_${userJid}`;
            const cached = this.cache.get(cacheKey);
            if (cached) return cached;

            const profile = await this.sock.profilePictureUrl(userJid, 'image').catch(() => null);
            const info = {
                jid: userJid,
                profilePicture: profile
            };
            this.cache.set(cacheKey, info);
            return info;
        } catch (error) {
            console.log(chalk.red('❌ Error getting user info:'), error.message);
            return null;
        }
    }

    /**
     * إضافة مستخدم للمجموعة
     */
    async addGroupMember(groupJid, userJid) {
        try {
            return await this.sock.groupParticipantsUpdate(groupJid, [userJid], 'add');
        } catch (error) {
            console.log(chalk.red('❌ Error adding member:'), error.message);
            return false;
        }
    }

    /**
     * إزالة مستخدم من المجموعة
     */
    async removeGroupMember(groupJid, userJid) {
        try {
            return await this.sock.groupParticipantsUpdate(groupJid, [userJid], 'remove');
        } catch (error) {
            console.log(chalk.red('❌ Error removing member:'), error.message);
            return false;
        }
    }

    /**
     * ترقية مستخدم لمسؤول
     */
    async promoteGroupMember(groupJid, userJid) {
        try {
            return await this.sock.groupParticipantsUpdate(groupJid, [userJid], 'promote');
        } catch (error) {
            console.log(chalk.red('❌ Error promoting member:'), error.message);
            return false;
        }
    }

    /**
     * إزالة صلاحيات المسؤول من مستخدم
     */
    async demoteGroupMember(groupJid, userJid) {
        try {
            return await this.sock.groupParticipantsUpdate(groupJid, [userJid], 'demote');
        } catch (error) {
            console.log(chalk.red('❌ Error demoting member:'), error.message);
            return false;
        }
    }

    /**
     * تعيين وصف المجموعة
     */
    async setGroupDescription(groupJid, description) {
        try {
            return await this.sock.groupUpdateDescription(groupJid, description);
        } catch (error) {
            console.log(chalk.red('❌ Error setting group description:'), error.message);
            return false;
        }
    }

    /**
     * تعيين اسم المجموعة
     */
    async setGroupSubject(groupJid, subject) {
        try {
            return await this.sock.groupUpdateSubject(groupJid, subject);
        } catch (error) {
            console.log(chalk.red('❌ Error setting group subject:'), error.message);
            return false;
        }
    }

    /**
     * إغلاق المجموعة (فقط المسؤولون يمكنهم الكتابة)
     */
    async closeGroup(groupJid) {
        try {
            return await this.sock.groupSettingUpdate(groupJid, 'announcement');
        } catch (error) {
            console.log(chalk.red('❌ Error closing group:'), error.message);
            return false;
        }
    }

    /**
     * فتح المجموعة (الجميع يمكنهم الكتابة)
     */
    async openGroup(groupJid) {
        try {
            return await this.sock.groupSettingUpdate(groupJid, 'not_announcement');
        } catch (error) {
            console.log(chalk.red('❌ Error opening group:'), error.message);
            return false;
        }
    }

    /**
     * إرسال رسالة جماعية (Broadcast)
     */
    async sendBroadcast(jids, text, options = {}) {
        try {
            for (const jid of jids) {
                await this.sendText(jid, text, options);
                await new Promise(resolve => setTimeout(resolve, 500)); // تأخير لتجنب الحظر
            }
            return true;
        } catch (error) {
            console.log(chalk.red('❌ Error sending broadcast:'), error.message);
            return false;
        }
    }

    /**
     * تنظيف الكاش
     */
    clearCache() {
        this.cache.flushAll();
    }

    /**
     * الحصول على حجم الكاش
     */
    getCacheSize() {
        return this.cache.getStats();
    }
}

export default SimpleMessage;
