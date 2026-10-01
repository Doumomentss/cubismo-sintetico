# Cubismo Sintético: El Duelo de Vanguardias
### Proyecto Interactivo de Arte (6to 6ta)

Un videojuego web colaborativo en tiempo real diseñado para exponer en clase ante 20-30 alumnos, con debate en grupo, votación interna por consenso, modo secreto de administración y mecánicas de apoyo entre alianzas.

---

## Dinámica del Juego en el Aula

### 1. Para los Alumnos (Pantalla Principal)
- Los alumnos entran al enlace web desde sus celulares (sin contraseñas ni PINs).
- **Paso 1:** Escriben su **Nombre o Apodo** y tocan **"Entrar al Juego"**.
- **Paso 2:** Ven la lista de grupos creados por sus compañeros en tiempo real:
  - Pueden hacer clic en **"Crear Grupo"** y asignarle un nombre (quien lo crea se convierte en Líder).
  - O pueden hacer clic en **"Unirse"** en cualquier grupo existente para sumarse como compañeros de equipo.
- **Paso 3:** Una vez en el grupo, ven a sus compañeros conectados en la sala de espera hasta que comience la ronda.

### 2. Votación en Grupo y Regla de Desempate (3 Minutos)
- Cada pregunta tiene un temporizador de **3 minutos** en tiempo real para dar tiempo a debatir.
- Cada integrante vota desde su celular y **ve en tiempo real qué están votando sus compañeros de equipo**:
  - *Ejemplo:* Integrante 1 votó ▲, Integrante 2 votó ◆, Integrante 3 votó ▲.
- Los alumnos pueden cambiar su voto en cualquier momento mientras el tiempo corra para ponerse de acuerdo.
- **Regla de Consenso y Desempate:**
  - Si una opción tiene la mayoría de votos, esa es la respuesta definitiva del grupo.
  - **Si hay empate en la cima** (por ejemplo: 3 votan ▲, 3 votan ◆ y 1 vota ●), el sistema **elige al azar entre las opciones más votadas** al finalizar el tiempo, simulando el desempate por azar.

### 3. Grupos Eliminados: Modo Alianza (Pista desde el Más Allá)
- Si un grupo pierde todas sus vidas o es eliminado en el corte, ¡sigue participando activamente!
- Su pantalla se convierte en el **Modo Alianza**:
  1. Eligen en un menú a qué **grupo vivo aliado** quieren ayudar.
  2. Los integrantes del grupo eliminado votan la opción que crean correcta.
  3. **Regla de Unanimidad Estricta:**
     - Si **todos los integrantes del grupo eliminado votan exactamente lo mismo**, esa opción se resalta con resplandor y la etiqueta **"Pista Aliada"** en los celulares del grupo vivo aliado.
     - Si los integrantes del grupo eliminado tienen votos discrepantes, **no se transmite ninguna sugerencia**.

---

## Acceso Secreto de Administración (#admin)

Para controlar la partida desde la computadora conectada al proyector:
- Abre el enlace agregando `#admin` al final:
  - En local: `http://localhost:8080#admin`
  - En Vercel: `https://tu-proyecto.vercel.app#admin`
- **Funcionalidades del Administrador:**
  - Monitoreo en tiempo real de los grupos creados y alumnos en espera.
  - Iniciar la sesión con el botón **"Iniciar Ronda con X Grupo(s)"**.
  - Durante cada pregunta:
    - Controlar el reloj de 3 minutos: **Pausar/Reanudar** y sumar **+30 seg**.
    - Monitorear en vivo los votos de cada integrante y cuántos grupos están listos.
    - **Control Manual Absoluto:** El juego **nunca avanza solo**, permitiendo al expositor abrir el debate y presionar **"Cerrar Votación y Evaluar Respuestas"** cuando corresponda.
    - Avanzar a la siguiente pregunta con **"Siguiente Pregunta"**.
    - Pantalla de **Corte de Eliminación** y **Podio Final con Confeti**.

---

## Despliegue en Vercel

El proyecto está 100% preparado y optimizado para desplegarse directamente en Vercel con un solo clic o comando:

### Opción A: Mediante Vercel CLI (Línea de Comandos)
1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta:
   ```bash
   npx vercel
   ```
3. Acepta los valores por defecto (presionando Enter). Vercel detectará la configuración estática optimizada en `vercel.json` y generará la URL pública segura (ej: `https://cubismo-arte.vercel.app`).

### Opción B: Mediante GitHub / Vercel Dashboard
1. Sube este repositorio a tu cuenta de GitHub.
2. Ingresa a [vercel.com](https://vercel.com) e inicia sesión.
3. Haz clic en **"Add New Project"** e importa el repositorio de GitHub.
4. Deja la configuración predeterminada y presiona **"Deploy"**.

### Enlaces para el Aula:
- **Alumnos (Celulares con 4G o Wi-Fi):** `https://tu-proyecto.vercel.app`
- **Proyector / Computadora:** `https://tu-proyecto.vercel.app#admin`

---

## Ejecución Local (Offline para Aula sin Internet)

Si el aula no tiene internet o quieres conectar a todos por punto de acceso local (hotspot):
```bash
node server.js
```
El servidor levantará en el puerto 8080 con soporte para WebSockets locales de 0 ms de latencia.
