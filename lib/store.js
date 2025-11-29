import { makeInMemoryStore } from '@whiskeysockets/baileys'
import pino from 'pino'

const logger = pino({ level: 'silent' }).child({ level: 'silent' })

const store = makeInMemoryStore({ logger })

export default store
