// plugins/jadibot.js

import { makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, jidNormalizedUser, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { Low, JSONFile } from 'lowdb'
import { join } from 'path'
import pino from 'pino'
import { Boom } from '@hapi/boom'
import { makeWASocket as makeWASocketSimple } from '../lib/simple.js'
import store from '../lib/store.js'
import chalk from 'chalk'
import fs from 'fs'

const __dirname = global.__dirname(import.meta.url)

export default {
    command: ['jadibot', 'serbot'],
    description: 'تفعيل الجلسات المتعددة (Jadibot).',
    owner: false,
    premium: false,
    group: false,
    admin: false,
    
    async execute(conn, m, { command, text, isOwner, isPrems, isGroup, isAdmin }) {
        if (!isOwner) return m.reply('هذا الأمر مخصص للمطور فقط.')
        
        const id = m.sender
        const { state, saveCreds } = await useMultiFileAuthState(join(global.jadi, id))
        const { version } = await fetchLatestBaileysVersion()
        
        const connectionOptions = {
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true, 
            generateHighQualityLinkPreview: true, 
            getMessage: async (clave) => {
                let jid = jidNormalizedUser(clave.remoteJid)
                let msg = await store.loadMessage(jid, clave.id)
                return msg?.message || ""
            },
            defaultQueryTimeoutMs: undefined,
            version,
        }
        
        const bot = makeWASocketSimple(connectionOptions)
        
        bot.handler = async function (chatUpdate) {
            // معالجة الرسائل للجلسة الفرعية
            // يمكن نسخ جزء من معالج الرسائل الرئيسي هنا أو استدعاءه
            // لتجنب التعقيد، سنركز على إرسال QR فقط
        }
        
        bot.connectionUpdate = async function (update) {
            const { connection, lastDisconnect, qr } = update
            
            if (qr) {
                conn.sendMessage(m.chat, { image: await bot.getFile(await require('qrcode').toBuffer(qr)).data, caption: `امسح الكود لتفعيل الجلسة الفرعية\n\nالكود صالح لمدة 60 ثانية` }, { quoted: m })
            }
            
            if (connection === 'open') {
                conn.sendMessage(m.chat, { text: `✅ تم تفعيل الجلسة الفرعية بنجاح!` }, { quoted: m })
                global.conns.push(bot)
            }
            
            if (connection === 'close') {
                const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode
                if (code === DisconnectReason.loggedOut || code === 401) {
                    conn.sendMessage(m.chat, { text: `❌ تم تسجيل الخروج من الجلسة الفرعية.` }, { quoted: m })
                    try {
                        fs.rmSync(join(global.jadi, id), { recursive: true, force: true })
                    } catch (e) {
                        console.error(chalk.red('❌ Failed to clean jadibot session:'), e.message);
                    }
                    global.conns = global.conns.filter(v => v.user.id !== bot.user.id)
                } else {
                    await bot.startConnection() // محاولة إعادة الاتصال
                }
            }
        }
        
        bot.credsUpdate = saveCreds.bind(bot, true)
        
        bot.ev.on("messages.upsert", bot.handler)
        bot.ev.on("connection.update", bot.connectionUpdate)
        bot.ev.on("creds.update", bot.credsUpdate)
        
        bot.isInit = false
        
        // بدء الاتصال
        // لا نحتاج لاستدعاء startConnection هنا لأن makeWASocket يبدأ الاتصال تلقائيًا
    }
}
