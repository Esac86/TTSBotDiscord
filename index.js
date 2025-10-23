import { Client, GatewayIntentBits } from 'discord.js'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice'
import googleTTS from 'google-tts-api'
import fs from 'fs'
import https from 'https'

const TOKEN = 'MTM3NDg2MDQwODk2MzIwNzIzOQ.G37JYC.fSLFnRNdpGCOe5mQKVrSZK7hD0jT_3ml-BbHsQ'
const CHANNEL_ID = '1430927653027971133' 

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

  const voiceChannel = msg.member.voice.channel
  if (!voiceChannel) {
    return msg.reply('❌ Debes estar en un canal de voz para usar el TTS.')
  }

  const texto = `${msg.member.displayName} dice: ${msg.content}`
  console.log(`🗣️ ${texto}`)

  const url = googleTTS.getAudioUrl(texto, { lang: 'es', slow: false })
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
