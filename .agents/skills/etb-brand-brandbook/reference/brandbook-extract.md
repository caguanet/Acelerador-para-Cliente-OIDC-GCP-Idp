# Extracto operativo — Manual de imagen ETB (Brandbook)

Documento vivo derivado del **Manual de imagen (Brandbook).pdf** de ETB — *«Serás lo que creas»*.  
Versión pensada para agentes IDEs y desarrollo cuando el PDF no forma parte del repositorio baseline.

_Notas de uso en producto SPA:_ para instancias **white‑label**, los tokens concretos se inyectan vía configuración runtime; este extracto es la **referencia corporativa ETB**. No sustituye políticas regulatorias aplicables ni textos legales aprobados fuera del manual.

### Mapeo a esta SPA (`window.APP_CONFIG.theme` → CSS)

Implementación canónica: `src/config/theme.ts` (`ETB_BRAND_HEX`, `ETB_THEME_COLORS`, `applyThemeCssVars`). Al arranque, `src/main.tsx` vuelca `theme.colors` a `:root`.

| `theme.colors.*` | Variable CSS | Hex default ETB | Nombre manual |
|------------------|--------------|-----------------|---------------|
| `primary` | `--brand-primary` | `#004c8f` | Azul ETB |
| `secondary` | `--brand-secondary` | `#214780` | Azul Profundo ETB |
| `accent` | `--brand-accent` | `#00ffff` | Azul Neón ETB |
| `background` | `--brand-bg` | `#ffffff` | Blanco |
| `text` | `--brand-text` | `#0c2a36` | Tono oscuro legible (derivado de paleta) |
| `action` | `--brand-action` | `#d86055` | Salmón Pymes ETB (CTA / highlight; en piezas sólo B2B puede sustituirse por `#006ED0` Azul Medio Empresas) |
| `textSecondary` | `--brand-text-secondary` | `#4a5f72` | Secundario UI (no es token nominal del manual; contraste con azules) |

Además se define `--brand-primary-rgb` a partir de `primary` para sombras y overlays en `src/index.css`.

---

## 1. ADN valórico y posicionamiento

- ETB como **Techco**: tecnología al servicio de personas; ecosistemas digitales (GovTech, EdTech, HealthTech); propósito social y confianza.
- **Valores de marca:** empatía, curiosidad, simplicidad, confianza, adaptabilidad, transformación.
- **Concepto central:** creer → crear; tecnología inclusiva como palanca de transformación.

---

## 2. Narrativa «Creer / Crear» y taxonomía de mensajes

### Semántica visual en tipografía destacada

- Palabras destacadas (**bold**) **azules** ↔ universo **creer**: lo interno, emocional, motivación (creer, confiar, soñar).
- Palabras destacadas **blancas** ↔ **crear**: lo tangible, lo construido con tecnología ETB.

### Voz institucional vs promocional

| Registro | Rol | Cualidades clave |
|----------|-----|-------------------|
| **Institucional** (Empresas, Gobierno, reputación, propósito) | Representar propósito, visión y confianza; calidez sin imponer; autoridad tranquila | Timbre profundo y cálido (referencias de audio para piezas multimedia); ritmo pausado; emoción contenida |
| **Promocional / masivos** | Activar, motivar y acompañar la decisión; beneficios + energía cercana | Timbres jóvenes variados por segmento; ritmo más ágil; directo y optimista |

**Segmentos de comunicación (oferta):** Hogares · Móvil · Pymes · Empresas. Objetivos: claridad funcional + vínculo emocional ETB.

---

## 3. Tono — matriz rápida (usamos / no usamos)

**Persona**

- Preferir **«tú»** en B2C; **«usted» / «nosotros»** en B2B/Gov según formalidad.

**Extensión y lectura**

- Frases cortas; titulares **≤ ~10 palabras**; párrafos breves donde aplique pantalla/UI.
- Evitar: tratamientos impersonales, párrafos densos en UI, pasiva donde se pueda usar activa, tono burócrático o frío.

**Verbos**

- Activos orientados a acción y posibilidad: *conectar, crear, activar, acompañar, habilitar, crecer, proteger*.

**Tono**

- Cercano, humano y optimista; mezcla emocional + funcional según segmento.

**Datos**

- Preferir datos **concretos y verificables** (ejemplo de manual: Mb, soporte horario cuando sea real).
- **No** usar para el **servicio** en sí expresiones que impliquen disponibilidad 100 % garantizada («sin cortes», «sin interrupciones», «sin límites» como promesa técnica, etc.).
- Distinción importante del manual: la restricción aplica sobre **claims del servicio** (internet/telefonía disponibilidad). **Permitido** lenguaje aspiracional general que no garantice disponibilidad absoluta («Crea sin límites», etc.), según línea del manual.

**Vocabulario sugerido:** oportunidades, soluciones, habilitar, acompañar, crecer, proteger, conectar.

---

## 4. Logotipo ETB — reglas ejecutables

### Carácter

- Firma principal; letras especialmente diseñadas; azul marca transmite solidez y cercanía; blanco válido sobre color; **negro** permitido principalmente para **documentos corporativos impresos** (uso digital preferir paleta institucional aprobada sobre fondo).

### Área libre / reserva

- Unidad **`x`** = altura de la **«e»** minúscula del logotipo.
- Libre de otros elementos tipográficos, fotográficos o gráficos en **los cuatro lados** ≥ `x`; deseable aún mayor margen donde sea posible.
- Logo + claim **«Serás lo que creas»**: distancia inferior mínima **`x/2`** entre logo y bloque claim (véase manual diagramas).

### Uso combinado logo + claim

- Solo en **cierres** narrativos (p. ej. final de videos, posts, stories, corporativos) en **color corporativo estable**; mismo layout relativo dentro de formato.
- **No** usar en aperturas o piezas de un solo momento que no sea cierre narrativo definido como tal en el manual.
- Logo + claim + **botón CTA**: solo en cierre de piezas autorizadas; CTA institucional, **no debe competir** en jerarquía con logo ni claim; ancho ejemplo ref: mismo ancho “lógico” que claim donde aplique diagramación fija — en web fluida, priorizar proporción manual y espacio guardado equivalente (`x`/ márgenes proporcionados).

### Uso indebido (prohibiciones)

No aplicar sobre el símbolo/wordmark oficial:

- Sombras, contornos, degradados volumétricos, halos tipo glow de marca no aprobados.
- Giro inclinación, estiramiento, compresión, tracking modificado entre letras tipográficas del logo sustitutas.
- Colores fuera del set aprobado (azul institucional, alternativos marcados manual, blanco, negro documental).

---

## 5. Claim «Serás lo que creas»

### Correctos

- **Sin punto final.**
- Tipografía oficial marca y colores aprobados; contraste garantizado sobre fondos.
- Puede ubicarse centrado/a la izquierda/derecha en bloque pero **forma original**.
- Una línea o tres líneas según formato del manual sin alterar proporciones relativas establecidas ni “jugar tamaños inconsistentes”.
- Dos líneas intermedias están **explicitamente marcadas como incorrectas** si quiebran el patrón aprobado (manual muestra ejemplo erróneo tipo «Serás lo que / creas» en tres líneas desproporcionadas).

### Incorrectos

Sombras en claim; cambiar peso tipográfico arbitrariamente; interlineados alterados rompiendo malla; proporciones modificadas; colores equivocados de legibilidad; variaciones tamaño incoherentes juntando palabras («Serás lo que » unidos sin espacio, etc.)

---

## 6. Sistema gráfico — Ondas dinámicas

- Derivación formal de curvas abstractas relacionadas gestualmente con la marca (abstracción de la forma de la «e» en narrativa institucional del manual).
- Uso típico: enmarcaciones suaves **1–2 curvas máx.** por pieza donde aplique superficie grande; útil banners/landing; usar con moderación en UI operativa donde no distraiga de formularios o lectura técnica.
- Fotografía institucional: composición ordenada con líneas tipo cielos/nubes oficiales y pinceles institucionales cuando se trabaje material de campaña autorizado — no deformar en letras/objet literales fuera manual.
- **Retícula (piezas estáticas de formato conocido según manual):** módulo base `X`; el logotipo se escala habitualmente como **~1/5 del ancho** (pieza horizontal) o **~1/5 del alto** (pieza vertical); la «caja» de contenidos tipográficos parte de margen **`1/4 X`** desde borde donde la retícula lo defina — en **web responsive** tomar estos valores como proporción conceptual, no píxeles rígidos.

---

## 7. Tipografía

### Publicitaria / campañas y piezas alta visibilidad

- **Kobenhavn Sans** (Adobe Fonts familia institucional). Pesos destacados manual (ExtraBlack, Black, Bold, Regular) según función (titular subtítulo resaltado cuerpo cuando aplique).
- **Licenciamiento web:** cargar sólo mediante mecanismo compatible con políticas Adobe Fonts / empresa.

### Corporativa interna documentos

- **Lexend**: ExtraBold, Black, Bold, Regular — ventaja Google ecosystem / compatibilidad ofimática ETB como manual indica para piezas alta densidad editorial.

### Recomendación práctica SPA técnica (IdP / admin)

Para interfaces operativas dónde Kobenhavn no esté disponible contractualmente técnico, usar **Lexend** como primera alternativa marca-alineada; documentar tema y cargar sólo mediante fuentes con licencia clara (`@font-face` CDN permitido proyecto).

---

## 8. Iconografía

- Familia monocromática de **trazo único ligero**, segmentada por uso (servicios Hogares/Móvil/Fibra etc. en manual); usar consistencia peso línea cuando se necesiten nuevos símbolos — calibrarlos contra set existentes (no caricaturizar ni usar rellenos decorativos excesivos no alineados al manual si la pieza es institucional).

---

## 9. Paleta — corporativa (digital / referencia rápida)

| Nombre marca | HEX (aprox. según PDF) | RGB PDF |
|----------------|-------------------------|---------|
| **Azul ETB** | `#004c8f` | R0 G76 B143 |
| **Azul Profundo ETB** | `#214780` | R33 G71 B128 |
| **Azul Neón ETB** | `#00ffff` | R0 G255 B255 *(ciano intenso — usar solo como **acento**; validar contraste WCAG antes de texto sobre él)* |
| **Azul Cielo ETB** | En piezas foto/campaña suele combinarse institucionalmente con transición desde tonos cercanos `#00ffff` hacia **`#004c8f`** (diagrama combinado página paleta) | Preferir recurso oficial (gradiente / foto) antes de reproducir desde memoria si la pieza es impresa o retail |
| **Blanco marca** | `#FFFFFF` | 255 / 255 / 255 |

> El manual incluye valores **CMYK** para impreso y tablas con tonos intermedios; para sobres físicos usar archivos institucionales, no HEX recalculado.

Cuando una UI digital use **neón** u otros azules muy claros, el agente debe priorizar legibilidad: texto principal sobre **`#214780`** / **`#004c8f`** o zonas garantizadas con contraste suficiente; el ciano **no** como único fondo de formularios densos sin prueba visual.

**Azul Cielo** en narrativa foto (gradiente texto legible): zona oscura garantiza contraste suficiente con copys claros cuando se use composición institucional con cielo — regla práctica PDF: proporción hasta ~1/4 alto pieza ascendente cuando se use bloque garantizando legibilidad.

---

## 10. Paleta complementaria (segmentos digitales rápidos del manual)

| Nombre segmento marca | HEX aprox PDF |
|-------------------------|---------------|
| Azul Medio Empresas ETB | `#006ED0` |
| Azul Hogares ETB | `#009CA8` |
| Azul Móviles ETB | `#84C0F5` |
| Salmón / Pymes ETB | `#D86055` |
| Azul Alto Empresas (fondo fotográfico) | El PDF separa muestras digitales vs impreso; ante pieza formal consultar recurso marca o página exacta manual — aquí omitido HEX deliberadamente hasta alineación contra archivo oficial.

**Matrices de proporción ejemplo manual (solo guía alta nivel piezas grandes):**

- Ofertas: ~60 % Azul Cielo; repartidos segmentos (Pymes / Móviles / Hogares) + tipografía destacados proporcionados.
- Empresas: ~70 % fondo Azul empresarial con reparto tipográfico y acentos.
- No es necesario reproducir proporciones matemática exactas en micro‑UI SaaS técnico; usar como inspiración cuando un layout sea pieza marketing formal.

---

## 11. Fotografía y colorización (solo si la UI muestra foto humana marca)

Personas naturales positivas interactuando; evitar modelo dando espalda a copy principal cuando aplique layout publicitario. Colores segmento integrados sutiles (prenda / acceso / objeto). Contrapicados/semi‑contrapicados según briefing segmento Hogares vs Móvil vs Empresas (detalle página manual). Accent esquinas controladas donde manual lo describa gradiente marca no invasivo.

---

## 12. Cobranding / agentes externos

El manual menciona índice de **agentes autorizados** y **cobranding**. Si la pieza mezcla otra marca, **no improvisar proporciones ETB**: exigir lineamiento oficial de ese capítulo cuando exista; si falta archivo, escalar revisión marca humana.

---

## Mantenimiento

**Responsabilidad editorial:** ante actualización institucional de paleta/logo/claim, quien conserve el PDF **oficial debe** actualizar esta extracción y la fecha de revisión siguiente.

**Historia:** extracción consolidada inicial a partir del Brandbook institucional usado como referencia corporativa ETB por el equipo que mantiene este repositorio. Actualizar al publicarse nueva versión del manual oficial.

