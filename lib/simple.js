import path from 'path'  
import { toAudio } from './converter.js'
import chalk from 'chalk'
import fetch from 'node-fetch'
import PhoneNumber from 'awesome-phonenumber'
import fs from 'fs'
import util from 'util'
import { fileTypeFromBuffer } from 'file-type' 
import { format } from 'util'
import { fileURLToPath } from 'url'
import store from './store.js'
import Jimp from 'jimp'  
import pino from 'pino'
import { Boom } from '@hapi/boom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 
 * @type {import('@whiskeysockets/baileys')}
 */
const {
    default: _makeWaSocket,
    makeWALegacySocket,
    proto,
    downloadContentFromMessage,
    jidDecode,
    areJidsSameUser,
    generateWAMessage,
    generateForwardMessageContent,
    generateWAMessageFromContent,
    WAMessageStubType,
    extractMessageContent,
    makeInMemoryStore,
    getAggregateVotesInPollMessage, 
    prepareWAMessageMedia,
    WA_DEFAULT_EPHEMERAL,
    MessageType,
    Mimetype
} = (await import('@whiskeysockets/baileys')).default

const nullish = (x) => x === null || x === undefined

export function makeWASocket(connectionOptions, options = {}) {
    /**
     * @type {import('@whiskeysockets/baileys').WASocket | import('@whiskeysockets/baileys').WALegacySocket}
     */
    let conn = (global.opts && global.opts['legacy'] ? makeWALegacySocket : _makeWaSocket)(connectionOptions)

    let sock = Object.defineProperties(conn, {
        chats: {
            value: { ...(options.chats || {}) },
            writable: true
        },
        decodeJid: {
            value(jid) {
                if (!jid || typeof jid !== 'string') return (!nullish(jid) && jid) || null
                return jid.decodeJid()
            }
        },
        logger: {
            get() {
                return {
                    info(...args) {
                        console.log(
                            chalk.bold.bgRgb(51, 204, 51)('INFO '),
                            `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
                            chalk.cyan(format(...args))
                        )
                    },
                    error(...args) {
                        console.log(
                            chalk.bold.bgRgb(247, 38, 33)('ERROR '),
                            `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
                            chalk.rgb(255, 38, 0)(format(...args))
                        )
                    },
                    warn(...args) {
                        console.log(
                            chalk.bold.bgRgb(255, 153, 0)('WARNING '),
                            `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
                            chalk.redBright(format(...args))
                        )
                    },
                    trace(...args) {
                        console.log(
                            chalk.grey('TRACE '),
                            `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
                            chalk.white(format(...args))
                        )
                    },
                    debug(...args) {
                        console.log(
                            chalk.bold.bgRgb(66, 167, 245)('DEBUG '),
                            `[${chalk.rgb(255, 255, 255)(new Date().toUTCString())}]:`,
                            chalk.white(format(...args))
                        )
                    }
                }
            },
            enumerable: true
        },
        
        // ==================== وظائف إرسال متقدمة ====================
        sendListB: {
            async value(jid, title, text, buttonText, buffer, listSections, quoted, options = {}) {
                let img, video
                
                // Simplified media handling for demonstration
                if (buffer) {
                    try {
                        const type = await conn.getFile(buffer)
                        if (/^image\//i.test(type.mime)) {
                            img = await prepareWAMessageMedia({ image: type.data }, { upload: conn.waUploadToServer })
                        } else if (/^video\//i.test(type.mime)) {
                            video = await prepareWAMessageMedia({ video: type.data }, { upload: conn.waUploadToServer })
                        }
                    } catch (error) {
                        console.error("Error preparing media for List Message:", error);
                    }
                }

                const sections = [...listSections]

                const message = {
                    interactiveMessage: {
                        header: {
                            title: title, 
                            hasMediaAttachment: false,
                            imageMessage: img ? img.imageMessage : null,
                            videoMessage: video ? video.videoMessage : null 
                        }, 
                        body: {text: text}, 
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: 'single_select',
                                    buttonParamsJson: JSON.stringify({
                                        title: buttonText,
                                        sections
                                    })
                                }
                            ],
                            messageParamsJson: ''
                        }
                    }
                };

                let msgL = generateWAMessageFromContent(jid, {
                    viewOnceMessage: {
                        message
                    }
                }, { userJid: conn.user.jid, quoted })

                conn.relayMessage(jid, msgL.message, { messageId: msgL.key.id, ...options })
            }
        },
        sendBot: {
            async value(jid, text = '', buffer, title, body, url, quoted, options) {
                if (buffer) try { (type = await conn.getFile(buffer), buffer = type.data) } catch { buffer = buffer }
                let prep = generateWAMessageFromContent(jid, { extendedTextMessage: { text: text, contextInfo: { externalAdReply: { title: title, body: body, thumbnail: buffer, sourceUrl: url }, mentionedJid: await conn.parseMention(text) }}}, { quoted: quoted })
                return conn.relayMessage(jid, prep.message, { messageId: prep.key.id })
            }
        },
        sendPayment: {
            async value(jid, amount, text, quoted, options) {
                conn.relayMessage(jid,  {
                    requestPaymentMessage: {
                        currencyCodeIso4217: 'PEN', // Placeholder currency
                        amount1000: amount,
                        requestFrom: null,
                        noteMessage: {
                            extendedTextMessage: {
                                text: text,
                                contextInfo: {
                                    externalAdReply: {
                                        showAdAttribution: true
                                    }, mentionedJid: conn.parseMention(text) 
                                }
                            }
                        }
                    }
                }, {})
            }
        },        
        getFile: {
            async value(PATH, saveToFile = false) {
                let res, filename
                const data = Buffer.isBuffer(PATH) ? PATH : PATH instanceof ArrayBuffer ? PATH.toBuffer() : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await fetch(PATH)).buffer() : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
                if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
                const type = await fileTypeFromBuffer(data) || {
                    mime: 'application/octet-stream',
                    ext: '.bin'
                }
                if (data && saveToFile && !filename) (filename = path.join(__dirname, '../tmp/' + new Date * 1 + '.' + type.ext), await fs.promises.writeFile(filename, data))
                return {
                    res,
                    filename,
                    ...type,
                    data,
                    deleteFile() {
                        return filename && fs.promises.unlink(filename)
                    }
                }
            },
            enumerable: true
        },
        waitEvent: {
            value(eventName, is = () => true, maxTries = 25) { //Idk why this exist?
                return new Promise((resolve, reject) => {
                    let tries = 0
                    let on = (...args) => {
                        if (++tries > maxTries) reject('Max tries reached')
                        else if (is()) {
                            conn.ev.off(eventName, on)
                            resolve(...args)
                        }
                    }
                    conn.ev.on(eventName, on)
                })
            }
        },   
        sendContact: {
            async value(jid, data, quoted, options) {
                if (!Array.isArray(data[0]) && typeof data[0] === 'string') data = [data]
                let contacts = []
                for (let [number, name] of data) {
                    number = number.replace(/[^0-9]/g, '')
                    let njid = number + '@s.whatsapp.net'
                    let biz = await conn.getBusinessProfile(njid).catch(_ => null) || {}
                    let vcard = `
BEGIN:VCARD
VERSION:3.0
N:;${name.replace(/\n/g, '\\n')};;;
FN:${name.replace(/\n/g, '\\n')}
TEL;type=CELL;type=VOICE;waid=${number}:${PhoneNumber('+' + number).getNumber('international')}
${biz.description ? `X-WA-BIZ-NAME:${(conn.chats[njid]?.vname || conn.getName(njid) || name).replace(/\n/, '\\n')}\n` : ''}
END:VCARD
`
                    contacts.push({ vcard })
                }
                return conn.sendMessage(jid, { contacts: { displayName: (contacts.length > 1 ? `${contacts.length} contacts` : contacts[0].vcard.split`\n`[2].split(';')[0]) || null, contacts }, ...options }, { quoted })
            }
        },
        
        // ==================== وظائف Baileys الأساسية ====================
        sendText: {
            value(jid, text, quoted = null, options) {
                return conn.sendMessage(jid, { text, ...options }, { quoted })
            }
        },
        sendImage: {
            value(jid, path, caption = '', quoted = null, options) {
                return conn.sendMessage(jid, { image: path, caption, ...options }, { quoted })
            }
        },
        sendVideo: {
            value(jid, path, caption = '', quoted = null, options) {
                return conn.sendMessage(jid, { video: path, caption, ...options }, { quoted })
            }
        },
        sendAudio: {
            value(jid, path, quoted = null, ptt = false, options) {
                return conn.sendMessage(jid, { audio: path, ptt, ...options }, { quoted })
            }
        },
        sendSticker: {
            value(jid, path, quoted = null, options) {
                return conn.sendMessage(jid, { sticker: path, ...options }, { quoted })
            }
        },
        sendMedia: {
            value(jid, path, quoted = null, options = {}) {
                return conn.sendMessage(jid, { ...options, [options.mimetype.split('/')[0]]: path }, { quoted })
            }
        },
        
        // ==================== وظائف إضافية ====================
        parseMention: {
            value(text) {
                return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
            }
        },
        
        // ==================== وظائف المجموعة ====================
        groupAcceptInvite: {
            value(code) {
                return conn.groupAcceptInvite(code)
            }
        },
        groupAcceptInviteV2: {
            value(key) {
                return conn.groupAcceptInviteV2(key)
            }
        },
        groupLeave: {
            value(jid) {
                return conn.groupLeave(jid)
            }
        },
        groupUpdateSubject: {
            value(jid, subject) {
                return conn.groupUpdateSubject(jid, subject)
            }
        },
        groupUpdateDescription: {
            value(jid, description) {
                return conn.groupUpdateDescription(jid, description)
            }
        },
        groupUpdateExit: {
            value(jid, participants) {
                return conn.groupParticipantsUpdate(jid, participants, 'remove')
            }
        },
        groupUpdateAdd: {
            value(jid, participants) {
                return conn.groupParticipantsUpdate(jid, participants, 'add')
            }
        },
        groupUpdatePromote: {
            value(jid, participants) {
                return conn.groupParticipantsUpdate(jid, participants, 'promote')
            }
        },
        groupUpdateDemote: {
            value(jid, participants) {
                return conn.groupParticipantsUpdate(jid, participants, 'demote')
            }
        },
        
        // ==================== وظائف التحميل ====================
        downloadMediaMessage: {
            async value(message, filename) {
                let mime = (message.msg || message).mimetype || ''
                let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
                let stream = await downloadContentFromMessage(message, messageType)
                let buffer = Buffer.from([])
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk])
                }
                if (filename) {
                    await fs.promises.writeFile(filename, buffer)
                    return filename
                }
                return buffer
            }
        },
        
        // ==================== وظائف أخرى ====================
        getName: {
            value(jid) {
                if (jid === 'status@broadcast') return 'Broadcast'
                jid = conn.decodeJid(jid)
                let v = conn.user.jid === jid ? conn.user : conn.chats[jid] || {}
                return (v.name || v.vname || v.notify || PhoneNumber('+' + jid.replace(/@.+/, '')).getNumber('international') + (jid === 'status@broadcast' ? ' (Broadcast)' : '')).trim()
            }
        },
        
        // ==================== وظائف الردود ====================
        reply: {
            value(jid, text, quoted, options) {
                return conn.sendMessage(jid, { text, ...options }, { quoted })
            }
        },
        
        // ==================== وظائف التخزين المؤقت ====================
        saveCreds: {
            value(force = false) {
                if (conn.authState.creds.update) {
                    conn.authState.creds.update()
                }
                if (force) {
                    conn.authState.saveCreds()
                }
            }
        }
    })
    
    return sock
}

/**
 * Serialize Message
 * @param {import('@whiskeysockets/baileys').WASocket} conn 
 * @param {import('@whiskeysockets/baileys').WAMessage} m 
 * @param {Boolean} [s] 
 */
export function smsg(conn, m, hasParent) {
    if (!m) return m
    let M = proto.WebMessageInfo
    if (m.key) {
        m.id = m.key.id
        m.isBaileys = m.id && m.id.length === 16 || false
        m.chat = conn.decodeJid(m.key.remoteJid || m.key.participant || m.key.fromMe ? conn.user.jid : '')
        m.isGroup = m.chat.endsWith('@g.us')
        m.sender = conn.decodeJid(m.key.fromMe && conn.user.id || m.key.participant || m.key.remoteJid || '')
        m.fromMe = m.key.fromMe || conn.user.id && m.key.fromMe
        m.isBot = m.id && m.id.startsWith('BAE5') && m.id.length === 16
        m.device = m.key.device
    }
    if (m.message) {
        m.mtype = Object.keys(m.message)[0]
        m.msg = m.message[m.mtype]
        if (m.mtype === 'ephemeralMessage') {
            smsg(conn, m.msg)
            m.mtype = m.msg.mtype
            m.msg = m.msg.msg
        }
        let quoted = m.quoted = m.msg.contextInfo ? m.msg.contextInfo.quotedMessage : null
        if (m.quoted) {
            let type = Object.keys(m.quoted)[0]
            m.quoted = m.quoted[type]
            if (['productMessage'].includes(type)) {
                type = Object.keys(m.quoted)[0]
                m.quoted = m.quoted[type]
            }
            if (typeof m.quoted === 'string') m.quoted = { text: m.quoted }
            m.quoted.mtype = type
            m.quoted.id = m.msg.contextInfo.stanzaId
            m.quoted.chat = conn.decodeJid(m.msg.contextInfo.remoteJid || m.chat)
            m.quoted.isBaileys = m.quoted.id && m.quoted.id.length === 16 || false
            m.quoted.sender = conn.decodeJid(m.msg.contextInfo.participant)
            m.quoted.fromMe = m.quoted.sender === conn.user.jid
            m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || ''
            let mention = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : []
            m.quoted.mentionedJid = mention.length ? mention : []
            m.quoted.delete = () => conn.sendMessage(m.quoted.chat, { delete: m.quoted.key })
        }
        m.text = m.msg.text || m.msg.caption || m.msg.conversation || m.msg.contentText || m.msg.selectedDisplayText || m.msg.title || ''
        m.mentionedJid = m.msg.contextInfo ? m.msg.contextInfo.mentionedJid : []
        
        // Handle Interactive Messages (Buttons/Lists)
        if (m.mtype === 'viewOnceMessageV2') {
            smsg(conn, m.msg.message)
            m.mtype = m.msg.message.mtype
            m.msg = m.msg.message.msg
            m.text = m.msg.text || m.msg.caption || m.msg.conversation || m.msg.contentText || m.msg.selectedDisplayText || m.msg.title || ''
        }
        
        if (m.mtype === 'interactiveResponseMessage') {
            const params = JSON.parse(m.msg.nativeFlowResponseMessage.paramsJson)
            m.text = params.id || m.text
        }
        
        if (m.mtype === 'buttonsResponseMessage') {
            m.text = m.msg.selectedButtonId || m.text
        }
        
        if (m.mtype === 'listResponseMessage') {
            m.text = m.msg.singleSelectReply.selectedRowId || m.text
        }
        
        if (m.mtype === 'templateButtonReplyMessage') {
            m.text = m.msg.selectedId || m.text
        }
        
        // Get media
        m.download = () => conn.downloadMediaMessage(m)
    }
    
    // Add reply function to message object
    m.reply = (text, chatId = m.chat, options = {}) => conn.reply(chatId, text, m, options)
    
    return m
}

/**
 * @typedef {object} WAMessage
 * @property {import('@whiskeysockets/baileys').proto.WebMessageInfo} m
 * @property {string} id
 * @property {string} chat
 * @property {string} sender
 * @property {boolean} isGroup
 * @property {boolean} fromMe
 * @property {string} mtype
 * @property {object} msg
 * @property {string} text
 * @property {WAMessage} quoted
 * @property {string[]} mentionedJid
 * @property {() => Promise<Buffer>} download
 * @property {(text: string, chatId?: string, options?: object) => Promise<any>} reply
 */

export function protoType() {
    /**
     * @returns {string}
     */
    proto.WebMessageInfo.prototype.getCaption = function () {
        return this.message?.imageMessage?.caption || this.message?.videoMessage?.caption || this.message?.extendedTextMessage?.text || this.message?.documentMessage?.caption || ''
    }
    
    /**
     * @returns {string}
     */
    proto.WebMessageInfo.prototype.getUrl = function () {
        return this.message?.imageMessage?.url || this.message?.videoMessage?.url || this.message?.documentMessage?.url || ''
    }
    
    /**
     * @returns {string}
     */
    proto.WebMessageInfo.prototype.getMimetype = function () {
        return this.message?.imageMessage?.mimetype || this.message?.videoMessage?.mimetype || this.message?.documentMessage?.mimetype || ''
    }
}

export function serialize() {
    // Empty function for now, serialization logic is mostly in smsg
}
