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
