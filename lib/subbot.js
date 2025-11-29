import { makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import NodeCache from 'node-cache'

const msgRetryCounterCache = new NodeCache()

/**
 * بدء جلسة بوت فرعية (Jadibot)
 * @param {string} sessionId - اسم مجلد الجلسة
 * @param {import('@whiskeysockets/baileys').WASocket} parentConn - اتصال البوت الرئيسي
 * @returns {Promise<import('@whiskeysockets/baileys').WASocket>}
 */
export async function startSubBot(sessionId, parentConn) {
    const sessionPath = path.join(global.__dirname(import.meta.url), '..', global.SUB_SESSION_DIR, sessionId)
    
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true })
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version } = await fetchLatestBaileysVersion();

    const connectionOptions = {
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        mobile: false, 
        browser: [`${global.BOT_NAME} - SubBot`, 'Edge', '20.0.04'],
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        markOnlineOnConnect: true, 
        generateHighQualityLinkPreview: true, 
        syncFullHistory: false,
        getMessage: async (clave) => {
            // يمكن استخدام وظيفة getMessage من البوت الرئيسي أو تخطيها
            return ""
        },
        msgRetryCounterCache,
        defaultQueryTimeoutMs: undefined,
        version,
    }

    const conn = makeWASocket(connectionOptions);
    conn.isSubBot = true
    conn.sessionId = sessionId
    conn.parentConn = parentConn
    
    // إضافة الاتصال إلى قائمة الجلسات المتعددة
    global.conns.push(conn)

    // ============================================================
    // معالج الأحداث
    // ============================================================
    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;

        if (qr) {
            console.log(chalk.yellow(`[${sessionId}] QR Code received. Scan it to connect.`));
            // هنا يمكن إرسال الـ QR إلى البوت الرئيسي لإرساله للمستخدم
            // مثال: await parentConn.sendMessage(parentConn.user.jid, { image: await conn.qr, caption: `QR Code for ${sessionId}` })
        }

        if (connection === 'open') {
            console.log(chalk.green(`[${sessionId}] Connection opened successfully!`));
        }

        if (connection === 'close') {
            if (code === DisconnectReason.loggedOut || code === 401) {
                console.log(chalk.red(`[${sessionId}] Logged out. Deleting session and removing...`));
                try {
                    rmSync(sessionPath, { recursive: true, force: true })
                } catch (e) {
                    console.error(chalk.red(`[${sessionId}] Failed to clean session directory:`), e.message);
                }
                // إزالة الاتصال من القائمة
                global.conns = global.conns.filter(c => c.sessionId !== sessionId)
            } else {
                console.log(chalk.yellow(`[${sessionId}] Connection closed. Reason: ${code}. Restarting...`));
                // محاولة إعادة الاتصال
                await startSubBot(sessionId, parentConn)
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);
    
    // ربط معالج الرسائل
    conn.handler = parentConn.handler.bind(conn)
    conn.ev.on("messages.upsert", conn.handler)

    return conn;
}

/**
 * تحميل جميع الجلسات المتعددة الموجودة
 * @param {import('@whiskeysockets/baileys').WASocket} parentConn - اتصال البوت الرئيسي
 */
export async function loadAllSubBots(parentConn) {
    const subBotDir = path.join(global.__dirname(import.meta.url), '..', global.SUB_SESSION_DIR)
    if (!fs.existsSync(subBotDir)) {
        fs.mkdirSync(subBotDir, { recursive: true })
        return
    }

    const sessionFolders = fs.readdirSync(subBotDir).filter(f => fs.statSync(path.join(subBotDir, f)).isDirectory())
    
    for (const folder of sessionFolders) {
        if (fs.existsSync(path.join(subBotDir, folder, 'creds.json'))) {
            console.log(chalk.blue(`Loading sub-bot session: ${folder}`));
            await startSubBot(folder, parentConn).catch(e => console.error(`Failed to load sub-bot ${folder}:`, e))
        } else {
            console.log(chalk.yellow(`Skipping incomplete session folder: ${folder}`));
        }
    }
}

/**
 * إيقاف جلسة بوت فرعية
 * @param {string} sessionId - اسم مجلد الجلسة
 */
export async function stopSubBot(sessionId) {
    const conn = global.conns.find(c => c.sessionId === sessionId)
    if (conn) {
        try {
            await conn.ws.close()
            global.conns = global.conns.filter(c => c.sessionId !== sessionId)
            console.log(chalk.green(`Sub-bot ${sessionId} stopped successfully.`))
            return true
        } catch (e) {
            console.error(chalk.red(`Error stopping sub-bot ${sessionId}:`), e)
            return false
        }
    }
    return false
}
