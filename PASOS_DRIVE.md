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

## ⚠️ Son DOS cuentas de Google

Esto explica casi todos los tropiezos del montaje:

- Las **carpetas de Drive** están en la cuenta de **ROMO** (es la que autorizó rclone).
- La **hoja y su Apps Script** están en la cuenta **personal** (`marlonromero0052@gmail.com`).

Por eso el script solo puede **leer** Drive, y compartir las carpetas se hace a
mano desde la cuenta dueña. Si algún día falla algo de permisos, corre
`diagnostico()` en el Apps Script: te dice con qué cuenta corre, si está pegado
a la hoja y si ve cada carpeta.

Y ojo con distinguir estos dos errores, que parecen lo mismo y no lo son:

| Mensaje | Qué es de verdad |
|---|---|
| *"You do not have permission to call DriveApp…"* | Falta el scope en `appsscript.json`. Apps Script **no vuelve a pedir permiso solo** cuando el código empieza a usar un servicio nuevo. |
| *"No item with the given ID could be found"* | La cuenta que corre el script no tiene acceso a esa carpeta. Falta compartirla. |

## El montaje (hecho el 2026-07-30)

### 1 · Compartir las carpetas — desde la cuenta de ROMO

Clic derecho en cada carpeta (`VIDEOS LISTOS PARA SUBIR` y `VIDEOS SIN VOZ`) →
*Compartir* → Acceso general: **Cualquier usuario que tenga el enlace**, rol
**Lector**. Y agregar la cuenta personal como Lector, de cinturón de seguridad.

Esto resuelve dos cosas de un golpe: que el equipo descargue sin pedir acceso, y
que el Apps Script (que corre con la otra cuenta) pueda leer la carpeta.

### 2 · Apps Script: el manifiesto

Hoja **Romo cont** → *Extensiones* → *Apps Script* → ⚙️ *Configuración del
proyecto* → marcar **"Mostrar el archivo de manifiesto appsscript.json"**.
Pegar el `appsscript.json` de este repo. Lo que importa es `oauthScopes` con
`drive.readonly`.

### 3 · Apps Script: el código

Pegar el `Code.gs` de este repo en `Código.gs` y guardar.

> El script que estaba desplegado era una versión vieja: ni siquiera tenía la
> acción `nube`, así que la app nunca habría podido escribir los links.

### 4 · Correr dos funciones (una sola vez)

| Función | Qué hace |
|---|---|
| `limpiarLinksViejos` | Borró los 57 links muertos del túnel Cloudflare y apuntó CONFIG_NUBE a la carpeta de Drive. |
| `crearTriggerDrive` | Instaló el robot que cada 10 min revisa la carpeta y completa los links que falten. |

Google pide autorizar: *Configuración avanzada* → *Ir a… (no seguro)* → *Permitir*.

### 5 · Volver a desplegar

*Implementar* → **Gestionar implementaciones** → ✏️ (editar) → *Versión: Nueva
versión* → *Implementar*.

⚠️ **Editar la implementación que ya existe, no crear una nueva.** Así la URL
`/exec` sigue siendo la misma y no hay que tocar `index.html` ni `server.py`.

### 6 · Publicar el dashboard

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
