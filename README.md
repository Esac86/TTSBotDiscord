# TTSBotDiscord

Bot de Discord que lee automáticamente los mensajes de texto en canales de voz, sin comandos.

---

## Características

- Conexión automática a canales de voz
- Cola de reproducción de mensajes
- Conversión de texto a voz en español
- Desconexión automática cuando queda solo
- Servidor web integrado para deployment

---

## Configuración

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:
```env
DISCORD_TOKEN=tu-token
CHANNEL_ID=id-del-canal
```

Obtén tu token en el [Portal de Desarrolladores de Discord](https://discord.com/developers/applications).

Obtén el ID del canal activando el Modo Desarrollador en Discord y copiando el ID del canal.

---

## Permisos Necesarios

- Leer mensajes
- Conectar y hablar en voz
- Enviar mensajes

---

## Licencia

MIT License - Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

**Repositorio:** https://github.com/Esac86/TTSBotDiscord