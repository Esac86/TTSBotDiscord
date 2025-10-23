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

    channelData = {
      connection: connection,
      player: player,
      queue: []
    }

    voiceChannels.set(voiceChannel.id, channelData)

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      voiceChannels.delete(voiceChannel.id)
    })

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 5000)
    } catch (error) {
      connection.destroy()
      return
    }

    player.on(AudioPlayerStatus.Idle, () => {
      if (channelData.queue.length > 0) {
        player.play(channelData.queue.shift())
      }
    })
  }

  const audioUrl = googleTTS.getAudioUrl(text, {
    lang: 'es',
    slow: false
  })

  https.get(audioUrl, response => {
    const audioResource = createAudioResource(response, {
      inputType: StreamType.Arbitrary
    })

    channelData.queue.push(audioResource)

    if (channelData.player.state.status === AudioPlayerStatus.Idle) {
      channelData.player.play(channelData.queue.shift())
    }
  }).on('error', error => {
    console.error('Error descargando audio TTS:', error)
  })
}

client.once('ready', () => {
  console.log(`Bot conectado como ${client.user.tag}`)
})

client.on('messageCreate', message => {
  if (message.author.bot) return
  if (message.channel.id !== process.env.CHANNEL_ID) return

  const voiceChannel = message.member?.voice?.channel

  if (!voiceChannel) {
    message.reply('Debes estar en un canal de voz')
    return
  }

  const cleanedText = cleanText(message.content)

  if (cleanedText) {
    playTextToSpeech(voiceChannel, cleanedText)
  }
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

app.head('/', (req, res) => {
  res.sendStatus(200)
})

app.get('/', (req, res) => {
  res.send('Bot en funcionamiento')
})

app.listen(PORT, () => {
  console.log(`Servidor web escuchando en el puerto ${PORT}`)
})

client.login(process.env.DISCORD_TOKEN)