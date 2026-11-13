# Rosita · Personal

App del equipo de **Textiles D'La Rossa**: marcaje con ubicación, horarios y días de descanso, muro estilo red social (notas, anuncios, fotos de tienda y reconocimientos) y gestión de personal.

Hecho por **Rosita Labs**.

## Cómo está armada

| Pieza | Para qué |
|---|---|
| `public/` | La app que se publica (HTML, estilos, ícono, modo instalable) |
| `src/app.js` | Toda la lógica de la app (se compila a `public/app.js` con `npm run build`) |
| `src/data.js` | Roles, departamentos, tiendas y horarios iniciales |
| `src/config.js` | **Configuración de Firebase del proyecto** |
| `firestore.rules` | Reglas de seguridad: quién puede ver y cambiar qué |
| `.github/workflows/deploy.yml` | Publica sola la app cada vez que se sube un cambio |

Base de datos: Cloud Firestore (plan gratuito Spark). Las fotos se guardan comprimidas dentro de la base de datos, así que **no hace falta activar Cloud Storage**.

## Puesta en marcha (una sola vez)

1. **Firebase** → crea el proyecto `rosita-personal` (sin Google Analytics).
2. **Authentication** → Comenzar → activa **Correo electrónico/contraseña**.
3. **Firestore Database** → Crear base de datos → modo producción → ubicación `us-central1`.
4. **Configuración del proyecto → Tus apps → Web (</>)** → registra la app "Rosita Personal" → copia el bloque `firebaseConfig` y pégalo en `src/config.js`.
5. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** → se descarga un archivo `.json`.
6. En **GitHub → el repositorio → Settings → Secrets and variables → Actions → New repository secret**:
   nombre `FIREBASE_SERVICE_ACCOUNT`, valor: todo el contenido del `.json`.
7. Sube el código a la rama `main`. GitHub Actions publica la app en `https://rosita-personal.web.app`.

## Primer ingreso

La primera vez que se abre la app pide crear la cuenta de **Gerencia** (nombre, puesto y PIN). Esa cuenta crea a todo el personal en **Gestión → Personas**: nombre, puesto, rol, departamento, tienda, horario, día de descanso y PIN inicial.

- **Horarios** (Gestión → Horarios): plantillas con entrada, salida, días que se trabaja, almuerzo y tolerancia.
- **Tiendas** (Gestión → Tiendas): en cada tienda, toca *Usar mi ubicación actual* estando ahí, para que el marcaje verifique que la persona está en su tienda.
- **Descansos** (Gestión → Descansos): cuando alguien necesita faltar, en vez de descontarle se **mueve su descanso** a otra fecha. Lo aprueba Gerencia o el jefe de su departamento.

## Roles

| Rol | Puede |
|---|---|
| Gerencia | Todo |
| Sistemas | Crear usuarios y restablecer PINs |
| Fundadores | Ver En vivo, publicar anuncios y reconocer |
| Jefe de área | Ver En vivo, aprobar descansos de su departamento, publicar y reconocer |
| Encargada | Publicar fotos y anuncios de su tienda y reconocer a su equipo |
| Asesora / Apoyo | Marcar, escribir notas, reaccionar y pedir cambio de descanso |

## Desarrollo local

```bash
npm install
npm run build
npm run emu                      # emuladores de Firebase (Auth + Firestore)
cd public && python3 -m http.server 5055
# abrir http://localhost:5055/?emu=1
```

## Publicación

La app se publica sola en **GitHub Pages** (`.github/workflows/pages.yml`) cada vez que se sube un cambio a `main`:
https://sica4370-sudo.github.io/rosita-personal/

Las reglas de Firestore (`firestore.rules`) se publican desde la consola de Firebase → Firestore → Reglas, o con `npm run deploy`. El flujo `firebase-deploy.yml` (Firebase Hosting) queda como opción manual.

## Red social y avisos al celular

- **Comentarios** (`posts/{id}/comments`), **menciones con @**, **publicaciones de texto** con fondo de color, **visto por** (`posts/{id}.seen`), **campanita** (`avisos`) y **perfil** de cada persona.
- **Avisos al celular**: cada quien los activa desde la app (Inicio o Perfil). El celular queda guardado en `privado/{persona}`.
  En iPhone primero hay que agregar Rosita a la pantalla de inicio.
- El envío lo hace `avisos/enviar.js`, que corre en GitHub Actions cada 5 minutos (`.github/workflows/avisos.yml`), de 6:00 a. m. a 10:55 p. m.
  Necesita el secreto **`ROSITA_SERVICE_ACCOUNT`**: Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada,
  y pegar todo el contenido del `.json` en GitHub → Settings → Secrets and variables → Actions → New repository secret.
- Se avisa de: comentarios en tus publicaciones, respuestas, menciones, reconocimientos, anuncios (a quien van dirigidos), Rosita Noticias y cumpleaños.
