# Cómo grabar las voces de las 4 AM

Las voces que hay ahora son **provisionales** (texto a voz). Para que suenen a personas de verdad, graba las frases y el juego las usará en su lugar. No hace falta tocar código.

## Pasos

1. Abre `lista.txt` y mira el **id** de cada frase (la primera columna, por ejemplo `hay_alguien`).
2. Graba cada frase en un archivo aparte y guárdalo en `originales/` con el nombre `<id>_mia` y su extensión. Por ejemplo, `originales/hay_alguien_mia.wav`.
   - Formatos que valen: `.wav`, `.mp3`, `.ogg`, `.m4a`, `.flac`, `.aac`, `.opus` o `.webm`. Sirven las notas de voz del móvil.
3. Haz doble clic en `programa/procesar_voces.bat`, o ejecuta `python tools/voces_4am.py procesar`.
   - El script procesa todas las grabaciones: tono agudo, eco de conducto, reverberación de nave y variantes al revés o ralentizadas.
   - Tu grabación tiene prioridad sobre la provisional.
4. Recarga el juego.

Si quieres añadir una frase nueva, añade una línea en `lista.txt` y una grabación con ese id. Para volver a la provisional, borra tu archivo `_mia` y procesa otra vez.

## Cómo grabarlas para que den miedo

- **Duración:** de 1 a 4 segundos por frase. Corta el silencio de antes y de después; el script recorta un poco, pero no mucho.
- **Formato:** cualquiera de los de arriba. Si puedes elegir, WAV o el formato normal del móvil a 44,1 o 48 kHz. Da igual si es mono o estéreo.
- **Sitio:** una habitación callada, sin música ni tele. Pon el móvil a un palmo de la boca, sin soplar directamente al micrófono.
- **Volumen:** que no sature. Mejor algo bajo que gritando pegado al micro; los gritos, aléjate un poco.
- **Interpretación:** la parte más importante.
  - Habla como alguien que tiene **miedo de verdad** y **no quiere que le oigan**. Casi todo bajito, con la respiración entrecortada.
  - Con **pausas raras**, frases que se cortan a medias y alguna repetición nerviosa («apágala... apágala ya»).
  - Las frases gritadas («¡Marta!», «¡Ciérrala!») van con la voz rota, no como un grito de película.
  - Las risas, **nerviosas** y que se cortan de golpe. Una risa que no tiene gracia.
- **Varias personas:** cuantas más voces distintas, mejor. Es una tripulación: hombres y mujeres, jóvenes y mayores. Una misma persona puede grabar dos o tres frases cambiando un poco la voz.
- **Toma más de una:** graba cada frase 2 o 3 veces y quédate con la que te ponga los pelos de punta.

## Qué hace el procesado

`tools/voces_4am.py` aplica a cada grabación:
- Tono más agudo.
- Filtro de banda, como un altavoz viejo o un tubo metálico.
- Resonancia de conducto, con ecos de pocos milisegundos.
- Reverberación larga de nave.

De cada frase saca tres variantes: «conducto», «lejos» y «rota» (con un trozo al revés y ralentizado, y un tartamudeo).

Al jugar, el juego solapa varias voces y las mueve de izquierda a derecha. Cada vez se oyen con más frecuencia hasta el final de la noche (`NIGHT4.VOICES` en `src/night/night4.js`).
