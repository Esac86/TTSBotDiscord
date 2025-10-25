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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

const voiceChannels = new Map()

function cleanText(text) {
  return text
    .replace(/<a?:\w+:\d+>/g, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .trim()
}

async function playTextToSpeech(voiceChannel, text) {
  let channelData = voiceChannels.get(voiceChannel.id)

  if (!channelData) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator
    })

    const player = createAudioPlayer()
    connection.subscribe(player)

    channelData = { connection, player, queue: [] }
    voiceChannels.set(voiceChannel.id, channelData)

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      voiceChannels.delete(voiceChannel.id)
    })

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 5000)
    } catch {
      connection.destroy()
      return
    }

    player.on(AudioPlayerStatus.Idle, () => {
      if (channelData.queue.length > 0) player.play(channelData.queue.shift())
    })
  }

  const chunks = text.match(/.{1,200}(\s|$)/g) || [text]

  for (const chunk of chunks) {
    const audioUrl = googleTTS.getAudioUrl(chunk, { lang: 'es', slow: false })
    await new Promise((resolve, reject) => {
      https
        .get(audioUrl, response => {
          const audioResource = createAudioResource(response, { inputType: StreamType.Arbitrary })
          channelData.queue.push(audioResource)
          if (channelData.player.state.status === AudioPlayerStatus.Idle)
            channelData.player.play(channelData.queue.shift())
          resolve()
        })
        .on('error', reject)
    })
  }
}

client.once('ready', () => {
  console.log(`Bot conectado como ${client.user.tag}`)
})

client.on('messageCreate', message => {
  if (message.author.bot) return
  if (message.channel.id !== process.env.CHANNEL_ID) return

  const content = message.content.trim()
  if (!content) return

  if (/https?:\/\//i.test(content) || /@/.test(content)) return

  if (content.toLowerCase() === 'stop') {
    const channelData = voiceChannels.get(message.member?.voice?.channel?.id)
    if (channelData) {
      channelData.queue = []
      channelData.player.stop()
      message.reply('🛑 Lectura detenida.')
    }
    return
  }

  const voiceChannel = message.member?.voice?.channel
  if (!voiceChannel) {
    message.reply('Debes estar en un canal de voz')
    return
  }

  const cleanedText = cleanText(content)
  if (cleanedText) playTextToSpeech(voiceChannel, cleanedText)
})

client.on('voiceStateUpdate', (oldState, newState) => {
  if (oldState.channelId === newState.channelId) return
  const voiceChannel = oldState.channel || newState.channel
  if (!voiceChannel) return
  const botInChannel = voiceChannel.members.get(client.user.id)
  if (botInChannel && voiceChannel.members.size === 1) {
    setTimeout(() => {
      if (voiceChannel.members.size === 1) {
        const channelData = voiceChannels.get(voiceChannel.id)
        if (channelData) {
          channelData.player.stop()
          channelData.connection.destroy()
          voiceChannels.delete(voiceChannel.id)
          console.log(`Bot desconectado de ${voiceChannel.name} (solo en el canal)`)
        }
      }
    }, 5000)
  }
})

const app = express()
const PORT = process.env.PORT || 3000

app.head('/', (req, res) => res.sendStatus(200))
app.get('/', (req, res) => res.send('Bot en funcionamiento'))
app.listen(PORT, () => console.log(`Servidor web escuchando en el puerto ${PORT}`))

client.login(process.env.DISCORD_TOKEN)
