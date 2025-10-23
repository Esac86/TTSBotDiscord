import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, entersState, VoiceConnectionStatus, StreamType } from '@discordjs/voice';
import googleTTS from 'google-tts-api';
import express from 'express';
import dotenv from 'dotenv';
import prism from 'prism-media';
import https from 'https';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PORT = 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const channels = new Map();

const limpiar = t => t.replace(/<a?:\w+:\d+>/g, '').replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();

async function tts(vc, texto) {
  let ch = channels.get(vc.id);

  if (!ch) {
    const connection = joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    ch = { connection, player, queue: [] };
    channels.set(vc.id, ch);

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 5000);
    } catch {
      connection.destroy();
      return;
    }

    player.on(AudioPlayerStatus.Idle, () => {
      if (ch.queue.length) player.play(ch.queue.shift());
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      channels.delete(vc.id);
    });
  }

  const url = googleTTS.getAudioUrl(texto, { lang: 'es', slow: false });
  https.get(url, res => {
    const opusStream = new prism.opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 });
    const resource = createAudioResource(res.pipe(new prism.MP3Decoder()).pipe(opusStream), { inputType: StreamType.Opus });
    ch.queue.push(resource);

    if (ch.player.state.status === AudioPlayerStatus.Idle) {
      ch.player.play(ch.queue.shift());
    }
  }).on('error', () => {});
}

client.once('ready', () => console.log(`✅ Bot conectado como ${client.user.tag}`));

client.on('messageCreate', m => {
  if (m.author.bot || m.channel.id !== CHANNEL_ID) return;
  const vc = m.member?.voice?.channel;
  if (!vc) return m.reply('❌ Debes estar en un canal de voz');
  const txt = limpiar(m.content);
  txt && tts(vc, txt);
});

client.on('voiceStateUpdate', (o, n) => {
  const ch = (o.channel || n.channel)?.members.get(client.user.id);
  if (ch && ch.voice.channel.members.size === 1) {
    const data = channels.get(ch.voice.channel.id);
    if (data) {
      data.player.stop();
      data.connection.destroy();
      channels.delete(ch.voice.channel.id);
    }
  }
});

const app = express();
app.head('/', (_, res) => res.sendStatus(200));
app.get('/', (_, res) => res.send('✅ Bot online'));
app.listen(PORT, () => console.log(`🌐 Servidor activo`));

client.login(TOKEN);