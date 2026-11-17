# Licencias del audio de Vigía-7

## Música del menú: «Clair de lune» (`menu_clair_de_lune.ogg` / `.mp3`)

- **Obra:** Claude Debussy (1862–1918), *Suite bergamasque*, L 75, III. «Clair de lune». Debussy murió hace más de 70 años, así que la composición es de **dominio público**.
- **Partitura de partida:** Mutopia Project, pieza n.º 1778, «Suite Bergamasque: Clair de Lune».
  - Ficha: https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1778 (también en https://www.ibiblio.org/mutopia/cgibin/piece-info.cgi?id=1778).
  - Edición: E. Fromont (1905; IMSLP #02907).
  - Tipografiada por Keith OHara.
  - **Licencia: «Public Domain»**, con el sello Creative Commons «No rights reserved». El propio archivo dice: «This sheet music has been placed in the public domain by the typesetter».
  - Copias guardadas en `programa/tools/musica/fuente/` (el `.mid` y el `.ly`), descargadas el 2026-10-27.
- **Arreglo y sonido: PROPIOS de Vigía-7.**
  - No se ha usado ninguna grabación existente ni el arreglo de ningún artista (ni el de Isao Tomita ni ningún otro).
  - Del MIDI de Mutopia solo se toman las notas de los compases 1–26.
  - Es nuestro todo lo demás:
    - el reparto en instrumentos;
    - el tempo (un 25 % más lento);
    - la dinámica y el «pedal»;
    - los timbres, sintetizados desde cero con numpy, sin muestras;
    - el eco, la reverb, el zumbido de nave y el efecto de radio.
- **Script y MIDI del arreglo:** `programa/tools/musica/clair_de_lune.py` (el script) y `programa/tools/musica/salida/clair_de_lune_arreglo.mid` (el MIDI).

## Música de la noche 7: remix de «Flamewall» (`musica/noche7.ogg`)

- **Obra:** «Flamewall», de **Camellia**. Es una canción **CON DERECHOS DE AUTOR** (no es de dominio público ni de licencia libre).
- **Archivo de partida:** el MP3 que dio el usuario el 2026-10-28 (`programa/tools/musica/fuente/flamewall_original.mp3`). No se ha descargado de ningún sitio.
- **El remix** («remix para VIGIA-7»): `programa/tools/musica/flamewall_remix.py` (el script) y `flamewall_remix.json` (el proyecto). Se ha hecho recortando, recolocando y filtrando trozos de la grabación original para que dure lo que la noche (5 minutos) y siga sus horas. Como usa la grabación original, sigue siendo la obra de la artista.
- **PERMISO DE CAMELLIA: CONSEGUIDO** (2026-10-30). El usuario la contactó por correo electrónico y le dio permiso para usar la canción en el juego. Guarda ese correo: es la prueba del permiso (conviene una copia en `historico/` o junto a este archivo).
- Desde la v1.13 el remix va en todo lo que se publica (`publicar_web.py`, `build.py`).
- **Si algún día hubiera que quitarla:** la música de la noche 7 se carga desde un único archivo configurable (`NIGHT7.MUSICA.ARCHIVO` en `src/night/night7.js`). Se puede cambiar por otra pista sin tocar el resto de la noche; sin archivo, la noche va sin música.
- **Créditos:** en el menú, «CRÉDITOS (C)»: «Flamewall» — Camellia. Remix para VIGIA-7, con el permiso de la artista (también en los créditos del final).
- **Audio publicado ofuscado (v1.81, el usuario: «el audio con extensión y ofuscación como pide Camellia… todo el
  audio»):** en todo lo que se publica (`build.py`: el .exe y el zip web; `publicar_web.py`: la web y las versiones
  debug) cada audio de `assets/audio/` va con extensión propia (`.ogg` → `.v7o`, `.mp3` → `.v7m`, `.wav` → `.v7w`,
  `.m4a` → `.v7k`) y con su contenido mezclado (`ofuscar_audio.py`): no se reproduce ni se reconoce fuera del juego.
  El juego lo descifra en memoria al cargarlo (`src/audio/Ofuscado.js`). En `programa/` siguen los archivos normales.

## Voces de las cintas, la megafonía y las de las 4 AM (v1.97)

- **Qué son:** voces sintéticas de Microsoft (las voces neuronales en español, como Álvaro y Elvira), generadas con la herramienta libre `edge-tts` y procesadas después para Vigía-7 (radio, cinta, eco, sala). No son grabaciones de personas.
- **Dónde se hacen:** `tools/generar_cinta.py`, `generar_megafonia.py`, `voces_4am.py`, `voz_conducto.py`, `voz_protagonista.py` y `sonidos_aberracion.py`.
- **Créditos (v1.97, el usuario: «añade lo que queda a los créditos»):** antes decían «Voces, sonidos, modelos y código: originales de Vigía-7»; ahora las voces tienen su línea propia en el menú («VOCES») y en los créditos del final: «Voces sintéticas de Microsoft». La línea de «originales» ya no las incluye.
- **Pendiente:** comprobar las condiciones de uso de Microsoft para publicar un juego con estas voces (Game Jolt). Si algún día hay que cambiarlas, cada voz sale de su script (la grabación propia del usuario va como `originales/<id>_mia.wav` y la procesa `procesar_voces.bat`).

## Música del reto «Duelo maestro»: «Lunar Abyss» (`musica/solo_web/duelo_maestro.ogg`) — v1.99; en la web desde la v2.03

- **Obra:** «~:Lunar Abyss:~», de **lchavasse**, en el Audio Portal de Newgrounds (https://www.newgrounds.com/audio/listen/645631).
- **Licencia (la página de Newgrounds, consultada el 2026-11-14):** **Creative Commons BY-NC 3.0**. Hay que dar crédito al artista y no se puede usar con fines comerciales. Además, la página dice: «You may not use this work without making specific arrangements with the artist UNLESS your work is a web-based game or animation, in which case you may use this freely». Es decir, **en un juego web es libre**; en uno descargable hace falta un acuerdo con el artista.
- **Archivo de partida:** el MP3 que dio el usuario el 2026-11-14 (`Vigia-7/645631_Lunar-Abyss.mp3`). No se ha descargado de ningún sitio.
- **El ajuste** (`programa/tools/musica/duelo_maestro.py`): la parte A y su respiro suenan dos veces (un empalme golpe con golpe) y todo va un 5,1 % más lento con el mismo tono, para que dure lo que la noche del reto (360 s). La licencia BY-NC permite adaptaciones; en los créditos se dice que está ajustada.
- **Dónde va (v2.03, el usuario: «es de una web de libre copyright, Newgrounds, mete la canción»):** en `assets/audio/musica/solo_web/`. **La web** (`publicar_web.py`, GitHub Pages) **la lleva**, ofuscada como el resto del audio. **El .exe** (`build.py`, también el zip web de itch.io que hace `build.py`) **no la lleva**, hasta que haya un acuerdo con lchavasse. Sin el archivo, el reto va sin música. Se quita también con `MUSICA_RETOS.todos.ACTIVA: false` (`src/config.js`).
- **Créditos:** en el menú («Duelo maestro · «Lunar Abyss» — lchavasse. Newgrounds · CC BY-NC 3.0 · ajustada para Vigía-7.») y en los del final.
