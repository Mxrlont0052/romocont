# Conectar ROMO CAMBIOS → Google Drive → ROMO CONT

Los tres proyectos quedaron encadenados así:

```
ROMO CAMBIOS (tu Mac)
   ├─ DM055 SV.mp4  ──► Drive / ROMOCONT / VIDEOS SIN VOZ
   └─ DM055.mp4     ──► Drive / ROMOCONT / VIDEOS LISTOS PARA SUBIR
                              │
                              └──► link de descarga en la columna LINK
                                   de la hoja "Romo cont" → botón ⬇ del dashboard
```

Solo el video **con voz** deja link en la hoja. El SV va a Drive como respaldo
para reeditar, y no ensucia el dashboard.

## Lo que ya está hecho (no toques nada)

- rclone instalado en `~/.romocambios/bin/rclone` y autorizado con tu cuenta.
- IDs de las carpetas ya puestos en `server.py`, `drive.py` y `Code.gs`.
- ROMO CAMBIOS sube los dos archivos y escribe el link al terminar cada render.

## Lo que falta — 5 minutos, todo desde tu Google

Estos pasos necesitan tu sesión de Google, por eso los haces tú.

### 1 · Actualizar el Apps Script

1. Abre la hoja **Romo cont** → *Extensiones* → *Apps Script*.
2. Borra todo el contenido y pega el `Code.gs` de este repo.
3. Guarda (💾).

> El script que estaba desplegado era una versión vieja: ni siquiera tenía la
> acción `nube`, así que la app no habría podido escribir los links. Este paso
> no es opcional.

### 2 · Correr tres funciones a mano (una sola vez)

En el selector de funciones de arriba, elige y dale ▶ a cada una:

| Función | Qué hace |
|---|---|
| `compartirCarpetas` | Deja las dos carpetas visibles **para cualquiera con el link**, para que Lizy y el equipo puedan descargar sin pedirte permiso cada vez. |
| `limpiarLinksViejos` | Borra los 57 links muertos del túnel Cloudflare y apunta CONFIG_NUBE a la carpeta de Drive. |
| `crearTriggerDrive` | Instala el robot que cada 10 min revisa la carpeta y completa los links que falten. |

La primera vez Google va a pedirte autorizar el script: *Revisar permisos* →
tu cuenta → *Configuración avanzada* → *Ir a (no seguro)* → *Permitir*.

### 3 · Volver a desplegar

*Desplegar* → **Gestionar implementaciones** → ✏️ (editar) → *Versión: Nueva
versión* → *Desplegar*.

⚠️ **Editar la implementación que ya existe, no crear una nueva.** Así la URL
`/exec` sigue siendo la misma y no hay que tocar `index.html` ni `server.py`.

### 4 · Publicar el dashboard

```bash
cd ~/Documents/Cerebront/Marlont/romocont && git push
```

## Cómo comprobar que quedó

1. Renderiza un video de prueba en ROMO CAMBIOS.
2. En la vista de render aparece abajo `☁ Subiendo a Drive: 1 archivo(s)`.
3. Cuando desaparece, el archivo está en *VIDEOS LISTOS PARA SUBIR*.
4. En el dashboard, ese video ya tiene el botón **⬇ descargar**.

Si alguien sube un video **a mano** a la carpeta, el ⬇ aparece solo en máximo
10 minutos — o al instante si le das al botón **🔄 links** del dashboard.

## Detalles que conviene saber

- **El nombre manda.** El cruce archivo↔fila es por código: `DM055.mp4` encuentra
  la fila `DM 055`. Si el archivo se llama distinto, no hay link.
- **Si se cae el internet a mitad de una subida**, la cola queda guardada en
  `~/.config/romocambios/upload_queue.json` y sigue al abrir la app de nuevo.
  Nada se pierde en silencio.
- **Videos de más de 100 MB**: el link `uc?export=download` muestra la pantalla
  de "Google no puede analizar este archivo" con un botón para bajarlo igual.
  Los reels normales pesan mucho menos y bajan directo.
- **Apagar la subida** (para pruebas): en ⚙︎ de ROMO CAMBIOS, o poniendo
  `"subir_drive": false` en `~/.config/romocambios/config.json`.
- ⏳ **Ojo a futuro:** rclone avisa que su client_id compartido de Google deja de
  funcionar *durante 2026*. Cuando pase, hay que crear un client_id propio
  (https://rclone.org/drive/#making-your-own-client-id) y volver a autorizar. No
  corre prisa hoy, pero es el único punto que puede romperse solo.
