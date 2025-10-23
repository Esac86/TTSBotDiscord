import { Client, GatewayIntentBits, SlashCommandBuilder, Routes, REST } from 'discord.js'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice'
import googleTTS from 'google-tts-api'
import fs from 'fs'
import https from 'https'

const TOKEN = 'MTM3NDg2MDQwODk2MzIwNzIzOQ.G37JYC.fSLFnRNdpGCOe5mQKVrSZK7hD0jT_3ml-BbHsQ'
const CLIENT_ID = '1374860408963207239'
const GUILD_ID = '1264733632371884093'

const commands = [
  new SlashCommandBuilder()
    .setName('tts')
    .setDescription('El bot habla con voz de Google')
    .addStringOption(option =>
      option.setName('texto')
        .setDescription('Texto a decir')
        .setRequired(true))
].map(cmd => cmd.toJSON())

const rest = new REST({ version: '10' }).setToken(TOKEN)
await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
})

client.once('clientReady', () => console.log(`✅ Conectado como ${client.user.tag}`))

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return
  if (interaction.commandName !== 'tts') return

  const texto = interaction.options.getString('texto')
  const canal = interaction.member.voice.channel
  if (!canal) return interaction.reply('❌ Debes estar en un canal de voz.')

  const url = googleTTS.getAudioUrl(texto, { lang: 'es', slow: false })
  const file = './tts.mp3'

  const fileStream = fs.createWriteStream(file)
  https.get(url, res => {
    res.pipe(fileStream)
    fileStream.on('finish', async () => {
      const connection = joinVoiceChannel({
        channelId: canal.id,
        guildId: canal.guild.id,
        adapterCreator: canal.guild.voiceAdapterCreator
      })

      const player = createAudioPlayer()
      const resource = createAudioResource(file)
      connection.subscribe(player)
      player.play(resource)

      await interaction.reply(`🗣️ Diciendo: "${texto}"`)

      player.on(AudioPlayerStatus.Idle, () => {
        connection.destroy()
        fs.unlinkSync(file)
      })
    })
  })
})

client.login(TOKEN)
