# 🎬 Content Team ROMO

Dashboard de videos del equipo de contenido ROMO.

- **Página:** GitHub Pages → https://mxrlont0052.github.io/romocont/
- **Base de datos:** Google Sheet (una sola fuente de verdad)
- **Conexión:** Google Apps Script como API

```
GitHub Pages (index.html)  ←→  Apps Script Web App  ←→  Google Sheet "VIDEOS"
```

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página completa (dashboard, pendientes, tabla, registro por tanda) |
| `Code.gs` | Backend — se pega en Apps Script del Google Sheet |
| `data_limpia.csv` | Los 311 videos limpios (sin duplicados) para sembrar el Sheet |

## Instalación (una sola vez)

### 1. Google Sheet
1. Crea un Sheet nuevo llamado **ROMO Content**
2. **Archivo → Importar → Subir** → `data_limpia.csv` → *Reemplazar hoja actual*
3. Renombra la pestaña a **VIDEOS**

### 2. Apps Script
1. En el Sheet: **Extensiones → Apps Script**
2. Borra todo, pega el contenido de `Code.gs`, guarda
3. **Desplegar → Nueva implementación → Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
4. Copia la URL que termina en `/exec`

### 3. Conectar la página
1. En `index.html`, busca `PEGA_AQUI_LA_URL_DEL_APPS_SCRIPT`
2. Reemplázalo con la URL del paso anterior
3. Sube el cambio a GitHub (`git push`)

### 4. GitHub Pages
En el repo: **Settings → Pages → Source: Deploy from a branch → main / (root)**

## Cómo fluye la data

- Cualquier cambio en la **página** (agregar, editar, borrar) se escribe al Sheet al instante.
- Cualquier cambio directo en el **Sheet** aparece en la página en menos de 1 minuto (sync automático).
- El Apps Script usa un *lock* para que dos personas guardando a la vez no dupliquen filas (el bug que tenía la versión anterior).

## Historia

Versión anterior: Netlify + Supabase. Migrado a GitHub Pages + Google Sheets en julio 2026.
La data original tenía 464 filas con 153 duplicados (ES 137–146 repetidos); se limpió a **311 videos**.
