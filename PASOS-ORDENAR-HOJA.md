# Ordenar la hoja "Romo cont" (19-10-2026)

Respaldo intacto: **Romo cont — RESPALDO 19-10-2026 (antes de ordenar)**, más `opciones/respaldo-hoja-2026-10-19-antes-ordenar.json`.
Código viejo: `opciones/Code-antes-ordenar-2026-10-19.gs`.

## Cómo queda

| Pestaña | Para qué |
|---|---|
| VIDEOS | Una fila = un video. La única que escribe la app |
| LISTAS | Categorías, estados, creadores y campañas. Lo que se agregue aquí sale en los menús |
| PANEL | Resumen por categoría, creador del mes y alertas (pendientes de más de 7 días). Se calcula solo |
| CONFIG | Carpeta de subidas (antes era la fila CONFIG NUBE metida entre los videos) |

Columnas de VIDEOS: CÓDIGO · CATEGORÍA · CAMPAÑA │ ESTADO · CREADOR · FECHA │ LINK DRIVE · TIKTOK │ DESCRIPCIÓN · TEMA · FORMATO · OFERTA │ VISTAS · LEADS · NOTAS
(ID y CREADO quedan ocultas). Orden: por categoría y luego por código.

Desde ahora `Code.gs` lee por **nombre de columna**: se pueden mover columnas sin romper la app.

## Paso 1 — Probar en la copia

1. Abrir **Romo cont — PRUEBA del orden** → Extensiones → Apps Script.
2. Borrar todo, pegar `Code.gs` y guardar.
3. Arriba elegir la función `reorganizar` → **Ejecutar** → autorizar.
4. Revisar la hoja: pestañas, orden y fechas. En "Registro de ejecución" sale el informe.

## Paso 2 — Hacerlo en la real (cuando la prueba te guste)

1. Abrir **Romo cont** → Extensiones → Apps Script. Tiene que salir el código VIEJO (con `DRIVE_LISTOS`).
   Si sale un "Proyecto sin título" vacío, PARAR: ese no es el que tiene la URL de la página.
2. Pegar `Code.gs` → guardar → ejecutar `reorganizar` **una sola vez** (vacía CAMPAÑA y vuelve a ordenar).
3. **Desplegar → Gestionar implementaciones → ✎ (lápiz) → Versión: Nueva versión → Desplegar.**
   ⚠️ NO "Nueva implementación": esa cambia la URL y la página deja de leer.
4. Subir la página nueva (`git push`) para que "Tanda" pase a llamarse "Campaña (opcional)".

ROMO CAMBIOS, la Fábrica, el revisor y nube-sync siguen funcionando igual: mandan los datos por nombre.

## Paso 3 — Guiones por línea, TESTIMONIOS y vistas (19-10-2026, segunda pasada)

1. **Romo cont** → Extensiones → Apps Script → pegar `Code.gs` nuevo → guardar.
2. Ejecutar **`actualizar`** (NO `reorganizar` otra vez). Hace:
   - ROMO DJS → TESTIMONIOS (los códigos RDJ no cambian)
   - Categorías IA VIRAL (IAV), IA EDICION DE AUDIO (IAE), IA MDT (IAM) en LISTAS
   - Pestañas **GUIONES VIRAL / GUIONES EA / GUIONES MDT**: al escribir el título, el CÓDIGO se pone solo
   - Una pestaña **▸ categoría** por cada categoría (pendientes arriba; se edita en VIDEOS, no ahí)
3. Implementar → Gestionar implementaciones → ✎ → Nueva versión → Implementar.
4. Después (lo hace Claude): `modal deploy` de la Fábrica y `git push` de la página.
