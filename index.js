import { Client, GatewayIntentBits } from 'discord.js'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice'
import googleTTS from 'google-tts-api'
import fs from 'fs'
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

const players = new Map()

client.once('ready', () => {
  console.log(`✅ Conectado como ${client.user.tag}`)
})

client.on('messageCreate', async msg => {
  if (msg.author.bot) return
  if (msg.channel.id !== CHANNEL_ID) return

  const voiceChannel = msg.member?.voice?.channel
  if (!voiceChannel) return msg.reply('❌ Debes estar en un canal de voz para usar el TTS.')

  const textoLimpio = msg.content
    .replace(/<a?:\w+:\d+>/g, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .trim()

  if (!textoLimpio) return

  console.log(`🗣️ ${textoLimpio}`)

  const url = googleTTS.getAudioUrl(textoLimpio, { lang: 'es', slow: false })
  const file = `./tts-${msg.id}.mp3`

  const fileStream = fs.createWriteStream(file)
  https.get(url, res => {
    res.pipe(fileStream)
    fileStream.on('finish', () => {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: msg.guild.id,
        adapterCreator: msg.guild.voiceAdapterCreator
      })

      let player = players.get(voiceChannel.id)
      if (!player) {
        player = createAudioPlayer()
        connection.subscribe(player)
        players.set(voiceChannel.id, player)
      }

      const resource = createAudioResource(file)
      player.play(resource)

      player.once(AudioPlayerStatus.Idle, () => {
        fs.existsSync(file) && fs.unlinkSync(file)
      })
    })
  })
})

client.login(TOKEN)

const app = express()
app.head('/', (_, res) => res.sendStatus(200))
app.get('/', (_, res) => res.send('✅ Bot online'))
app.listen(PORT, () => console.log(`🌐 Endpoint activo`))