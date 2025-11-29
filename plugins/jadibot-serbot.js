import { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion} from "@whiskeysockets/baileys";
import qrcode from "qrcode"
import NodeCache from "node-cache"
import fs from "fs"
import path from "path"
import pino from 'pino'
import chalk from 'chalk'
import util from 'util' 
import * as ws from 'ws'
import { exec } from 'child_process'
import { makeWASocket } from '../lib/simple.js'
import { fileURLToPath } from 'url'

const { CONNECTING } = ws

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const RubyJBOptions = {}
if (global.conns instanceof Array) console.log()
else global.conns = []

// وظيفة مساعدة لحساب الوقت
function msToTime(duration) {
    var milliseconds = parseInt((duration % 1000) / 100),
    seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor((duration / (1000 * 60 * 60)) % 24)
    hours = (hours < 10) ? '0' + hours : hours
    minutes = (minutes < 10) ? '0' + minutes : minutes
    seconds = (seconds < 10) ? '0' + seconds : seconds
    return minutes + ' دقيقة و ' + seconds + ' ثانية '
}

// وظيفة مساعدة للانضمام إلى القنوات (إذا كانت موجودة)
async function joinChannels(conn) {
    // Placeholder for channel joining logic
    // if (global.ch) {
    //     for (const channelId of Object.values(global.ch)) {
    //         await conn.newsletterFollow(channelId).catch(() => {})
    //     }
    // }
}

// ============================================================
// دالة Jadibot الرئيسية
// ============================================================
export async function RubyJadiBot(options) {
    let { pathRubyJadiBot, m, conn, args, usedPrefix, command } = options
    
    const mcode = args[0] && /(--code|code)/.test(args[0].trim()) ? true : args[1] && /(--code|code)/.test(args[1].trim()) ? true : false
    let txtQR
    
    if (mcode) {
        args[0] = args[0].replace(/^--code$|^code$/, "").trim()
        if (args[1]) args[1] = args[1].replace(/^--code$|^code$/, "").trim()
        if (args[0] == "") args[0] = undefined
    }
    
    const pathCreds = path.join(pathRubyJadiBot, "creds.json")
    if (!fs.existsSync(pathRubyJadiBot)){
        fs.mkdirSync(pathRubyJadiBot, { recursive: true })
    }
    
    try {
        args[0] && args[0] != undefined ? fs.writeFileSync(pathCreds, JSON.stringify(JSON.parse(Buffer.from(args[0], "base64").toString("utf-8")), null, '\t')) : ""
    } catch (e) {
        conn.reply(m.chat, `❌ خطأ في تحليل الكود المرفق. يرجى التأكد من صحة الكود.`, m)
        return
    }
    
    let { version } = await fetchLatestBaileysVersion()
    const msgRetryCache = new NodeCache()
    const { state, saveCreds } = await useMultiFileAuthState(pathRubyJadiBot)
    
    const connectionOptions = {
        logger: pino({ level: "fatal" }),
        printQRInTerminal: false,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({level: 'silent'}).child({ level: "fatal" })) },
        msgRetryCounterCache: msgRetryCache,
        browser: mcode ? ['Ubuntu', 'Chrome', '110.0.5585.95'] : ['Advanced WhatsApp Bot (Sub Bot)', 'Chrome','2.0.0'],
        version: version,
        generateHighQualityLinkPreview: true
    };
    
    let sock = makeWASocket(connectionOptions)
    sock.isInit = false
    let isInit = true
    
    async function connectionUpdate(update) {
        const { connection, lastDisconnect, isNewLogin, qr } = update
        if (isNewLogin) sock.isInit = false
        
        if (qr && !mcode) {
            if (m?.chat) {
                const rtx = `*✨ كود QR لتشغيل الجلسة المتعددة (Sub-Bot) ✨*\n\n✰ امسح هذا الكود بهاتف آخر لتصبح *Sub-Bot* مؤقت.\n\n\`1\` » انقر على النقاط الثلاث في الزاوية العلوية اليمنى.\n\n\`2\` » اضغط على الأجهزة المرتبطة.\n\n\`3\` » امسح هذا الكود لتسجيل الدخول.\n\n✧ هذا الكود ينتهي بعد 45 ثانية!`
                txtQR = await conn.sendMessage(m.chat, { image: await qrcode.toBuffer(qr, { scale: 8 }), caption: rtx.trim()}, { quoted: m})
            } else {
                return 
            }
            if (txtQR && txtQR.key) {
                setTimeout(() => { conn.sendMessage(m.sender, { delete: txtQR.key })}, 45000)
            }
            return
        } 
        
        if (qr && mcode) {
            const rawCode = await sock.requestPairingCode(m.sender.split`@`[0], "ADVANCED_BOT");
            
            const interactiveMessage = {
                text: `*✨ كود الاقتران لتشغيل الجلسة المتعددة (Sub-Bot) ✨*\n\nاستخدم الكود التالي للاتصال كـ Sub-Bot:\n\n*الكود:* ${rawCode.match(/.{1,4}/g)?.join("-")}\n\n> هذا الكود ينتهي بعد 45 ثانية.`,
                contextInfo: {
                    mentionedJid: [m.sender]
                }
            };
            
            const sentMsg = await conn.sendMessage(m.chat, interactiveMessage, { quoted: m });
            console.log(chalk.bold.white(chalk.bgMagenta(`✧ PAIRING CODE FOR JADIBOT ✧`)), chalk.bold.white(chalk.white(rawCode)));
            
            if (sentMsg && sentMsg.key) {
                setTimeout(() => {
                    conn.sendMessage(m.chat, { delete: sentMsg.key });
                }, 45000);
            }
            return;
        }
        
        const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode
        if (connection === 'close') {
            console.log(chalk.yellow(`🔄 اتصال الجلسة المتعددة (+${path.basename(pathRubyJadiBot)}) مغلق. السبب: ${reason}.`))
            if (reason === DisconnectReason.loggedOut || reason === 401 || reason === 403) {
                console.log(chalk.red(`❌ تم تسجيل الخروج أو حظر الجلسة (+${path.basename(pathRubyJadiBot)}). حذف البيانات...`))
                fs.rmdirSync(pathRubyJadiBot, { recursive: true, force: true })
            }
            await creloadHandler(true).catch(console.error)
        }
        
        if (global.db.data == null) loadDatabase()
        
        if (connection == `open`) {
            let userName = sock.authState.creds.me.name || 'مجهول'
            console.log(chalk.bold.cyanBright(`\n❒⸺⸺⸺⸺【• SUB-BOT •】⸺⸺⸺⸺❒\n│\n│ 🟢 ${userName} (+${path.basename(pathRubyJadiBot)}) متصل بنجاح.\n│\n❒⸺⸺⸺【• متصل •】⸺⸺⸺❒`))
            sock.isInit = true
            global.conns.push(sock)
            await joinChannels(sock)
            
            m?.chat ? await conn.sendMessage(m.chat, {text: `✅ تم الاتصال بنجاح! أنت الآن Sub-Bot.`, contextInfo: { mentionedJid: [m.sender]}}, { quoted: m }) : ''
        }
    }
    
    setInterval(async () => {
        if (!sock.user) {
            try { sock.ws.close() } catch (e) { }
            sock.ev.removeAllListeners()
            let i = global.conns.indexOf(sock)                
            if (i < 0) return
            delete global.conns[i]
            global.conns.splice(i, 1)
        }
    }, 60000)
    
    let handler = await import('../handler.js')
    let creloadHandler = async function (restatConn) {
        try {
            const Handler = await import(`../handler.js?update=${Date.now()}`).catch(console.error)
            if (Object.keys(Handler || {}).length) handler = Handler
        } catch (e) {
            console.error('⚠️ خطأ جديد في تحميل المعالج: ', e)
        }
        
        if (restatConn) {
            const oldChats = sock.chats
            try { sock.ws.close() } catch { }
            sock.ev.removeAllListeners()
            sock = makeWASocket(connectionOptions, { chats: oldChats })
            isInit = true
        }
        
        if (!isInit) {
            sock.ev.off("messages.upsert", sock.handler)
            sock.ev.off("connection.update", sock.connectionUpdate)
            sock.ev.off('creds.update', sock.credsUpdate)
        }
        
        sock.handler = handler.handler.bind(sock)
        sock.connectionUpdate = connectionUpdate.bind(sock)
        sock.credsUpdate = saveCreds.bind(sock, true)
        sock.ev.on("messages.upsert", sock.handler)
        sock.ev.on("connection.update", sock.connectionUpdate)
        sock.ev.on("creds.update", sock.credsUpdate)
        isInit = false
        return true
    }
    creloadHandler(false)
}

// ============================================================
// معالج الأمر (Plugin Handler)
// ============================================================
let handler = async (m, { conn, args, usedPrefix, command, isOwner }) => {
    if (!global.canInstall) return m.reply('❌ تم تعطيل أمر التنصيب من قبل المطور.');
    
    let time = global.db.data.users[m.sender].Subs + 120000
    if (new Date - global.db.data.users[m.sender].Subs < 120000) return conn.reply(m.chat, `⏳ يجب عليك الانتظار ${msToTime(time - new Date())} لإعادة ربط *Sub-Bot* جديد.`, m)
    
    const limiteSubBots = global.subbotlimitt || 20; 
    const subBots = [...new Set([...global.conns.filter((c) => c.user && c.ws.socket && c.ws.socket.readyState !== ws.CLOSED)])]
    const subBotsCount = subBots.length
    
    if (subBotsCount >= limiteSubBots) {
        return m.reply(`❌ تم الوصول إلى الحد الأقصى لعدد *Sub-Bots* النشطين (${subBotsCount}/${limiteSubBots}).\n\nلا يمكن إنشاء المزيد من الاتصالات حاليًا.`)
    }
    
    let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? conn.user.jid : m.sender
    let id = `${who.split`@`[0]}`
    let pathRubyJadiBot = path.join(`./${global.jadi}/`, id)
    
    RubyJBOptions.pathRubyJadiBot = pathRubyJadiBot
    RubyJBOptions.m = m
    RubyJBOptions.conn = conn
    RubyJBOptions.args = args
    RubyJBOptions.usedPrefix = usedPrefix
    RubyJBOptions.command = command
    RubyJBOptions.fromCommand = true
    
    RubyJadiBot(RubyJBOptions)
    global.db.data.users[m.sender].Subs = new Date * 1
} 

handler.help = ['jadibot', 'serbot']
handler.tags = ['owner']
handler.command = ['jadibot', 'serbot', 'qr', 'code']
handler.owner = true

export default handler 
