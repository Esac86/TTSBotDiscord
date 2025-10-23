import { Client, GatewayIntentBits } from 'discord.js'
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType
} from '@discordjs/voice'
import googleTTS from 'google-tts-api'
import https from 'https'
import express from 'express'
import dotenv from 'dotenv'

dotenv.config()

const TOKEN = process.env.DISCORD_TOKEN
const CHANNEL_ID = process.env.CHANNEL_ID
const PORT = 3000

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

const channels = new Map()
const limpiar = t =>
  t
    .replace(/<a?:\w+:\d+>/g, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .trim()

async function tts(vc, texto) {
  let ch = channels.get(vc.id)
  if (!ch) {
    const c = joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator
    })
    const p = createAudioPlayer()
    c.subscribe(p)
    ch = { connection: c, player: p, queue: [] }
    channels.set(vc.id, ch)

    c.on(VoiceConnectionStatus.Disconnected, () => channels.delete(vc.id))

    try {
      await entersState(c, VoiceConnectionStatus.Ready, 5000)
    } catch {
      c.destroy()
      return
    }

    p.on(AudioPlayerStatus.Idle, () => {
      if (ch.queue.length) p.play(ch.queue.shift())
    })
  }

  const url = googleTTS.getAudioUrl(texto, { lang: 'es', slow: false })
  https
    .get(url, res => {
      const resource = createAudioResource(res, { inputType: StreamType.Arbitrary })
      ch.queue.push(resource)
      if (ch.player.state.status === AudioPlayerStatus.Idle) ch.player.play(ch.queue.shift())
    })
    .on('error', () => {})
}

client.once('ready', () => console.log(`✅ Bot conectado como ${client.user.tag}`))

client.on('messageCreate', m => {
  if (m.author.bot || m.channel.id !== CHANNEL_ID) return
  const vc = m.member?.voice?.channel
  if (!vc) return m.reply('❌ Debes estar en un canal de voz')
  const txt = limpiar(m.content)
  txt && tts(vc, txt)
})

client.on('voiceStateUpdate', (oldState, newState) => {
  if (oldState.channelId === newState.channelId) return

  const vc = oldState.channel || newState.channel
  if (!vc) return

  const botInVC = vc.members.get(client.user.id)
  if (botInVC && vc.members.size === 1) {
    setTimeout(() => {
      if (vc.members.size === 1) {
        const data = channels.get(vc.id)
        if (data) {
          data.player.stop()
          data.connection.destroy()
          channels.delete(vc.id)
          console.log(`👋 Bot desconectado de ${vc.name} (solo)`)
        }
      }
    }, 5000)
  }
})

const app = express()
app.head('/', (_, res) => res.sendStatus(200))
app.get('/', (_, res) => res.send('✅ Bot online'))
app.listen(PORT, () => console.log(`🌐 Servidor activo en puerto ${PORT}`))

client.login(TOKEN)
