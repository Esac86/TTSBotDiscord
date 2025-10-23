/**
 * Bot TTS Discord – Plug & Play
 * Solo necesitas configurar el .env con:
 * DISCORD_TOKEN=tu_token
 * CHANNEL_ID=id_canal_texto
 */

import { Client, GatewayIntentBits } from 'discord.js'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, StreamType } from '@discordjs/voice'
import googleTTS from 'google-tts-api'
import https from 'https'
import express from 'express'
import dotenv from 'dotenv'

dotenv.config()

const TOKEN = process.env.DISCORD_TOKEN
const CHANNEL_ID = process.env.CHANNEL_ID
const PORT = process.env.PORT || 3000

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

const channels = new Map()

// --- Función para limpiar texto ---
const limpiarTexto = texto =>
  texto.replace(/<a?:\w+:\d+>/g, '')
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
        .trim()

// --- Función para reproducir TTS ---
async function reproducirTTS(voiceChannel, texto) {
  let ch = channels.get(voiceChannel.id)

  if (!ch) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator
    })

    const player = createAudioPlayer()
    connection.subscribe(player)

    ch = { connection, player, queue: [] }
    channels.set(voiceChannel.id, ch)

    connection.on(VoiceConnectionStatus.Disconnected, () => channels.delete(voiceChannel.id))

    try { await entersState(connection, VoiceConnectionStatus.Ready, 5000) }
    catch { connection.destroy(); return }

    player.on(AudioPlayerStatus.Idle, () => {
      if (ch.queue.length > 0) ch.player.play(ch.queue.shift())
    })
  }

  const url = googleTTS.getAudioUrl(texto, { lang: 'es', slow: false })
  https.get(url, res => {
    const resource = createAudioResource(res, { inputType: StreamType.Arbitrary })
    if (ch.player.state.status === AudioPlayerStatus.Idle) ch.player.play(resource)
    else ch.queue.push(resource)
  })
}

// --- Eventos ---
client.once('ready', () => console.log(`✅ Bot conectado como ${client.user.tag}`))

client.on('messageCreate', msg => {
  if (msg.author.bot) return
  if (msg.channel.id !== CHANNEL_ID) return

  const voiceChannel = msg.member?.voice?.channel
  if (!voiceChannel) return msg.reply('❌ Debes estar en un canal de voz para usar el TTS.')

  const texto = limpiarTexto(msg.content)
  if (!texto) return

  console.log(`🗣️ TTS: "${texto}"`)
  reproducirTTS(voiceChannel, texto)
})

// Auto-desconexión si queda solo
client.on('voiceStateUpdate', (oldState, newState) => {
  const channel = oldState.channel || newState.channel
  if (!channel) return

  const botMember = client.user ? channel.members.get(client.user.id) : null
  if (botMember && channel.members.size === 1) {
    const ch = channels.get(channel.id)
    if (ch) {
      ch.player.stop()
      ch.connection.destroy()
      channels.delete(channel.id)
      console.log(`🚪 Me salí del canal ${channel.name} porque estoy solo`)
    }
  }
})

// --- Servidor Express para uptime ---
const app = express()
app.head('/', (_, res) => res.sendStatus(200))
app.get('/', (_, res) => res.send('✅ Bot online'))
app.listen(PORT, () => console.log(`🌐 Servidor activo en puerto ${PORT}`))

client.login(TOKEN)