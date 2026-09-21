# Intercambio cartera ↔ Claude (app "Gestor de gastos")

Facu exporta desde la app (Cartera → "Exportar para Claude") un archivo `cartera-AAAA-MM-DD-HHMM.md` y lo pega/adjunta en un chat de este proyecto. Desde el 21-sep es **un solo archivo** (antes había uno aparte de "mercado"): la app actualiza precios y fundamentales antes de armarlo, y **esos precios son la verdad del día** (no usar los del entrenamiento; un precio que no se pudo actualizar viene marcado "viejo" con su hora). Trae: estado del mercado (NY abierto/cerrado, SPY, CCL, MEP), tabla de precios con peso, PPC, valor y alfa, CEDEAR en pesos al CCL, rango de 52 semanas, zonas, objetivo y próximo balance; qué hace cada empresa y la tesis; fundamentales (P/E y su mediana de 10 años, PEG, ROIC, ROE, márgenes, CAGR, deuda, caja libre, dividendo; **el EPS CAGR, el rango de 52 semanas y caja libre/ganancia tienen errores conocidos para algunos tickers: verificarlos antes de apoyarse en ellos**); resumen (valor, costo FIFO, resultado), rendimiento vs "cartera sombra S&P 500" (mismas compras/ventas replicadas en SPY el mismo día) por rango YTD · 1 A · 3 A · 5 A · Todo — acumulado ponderado por dinero (TIR convertida al rango; Dietz si no converge), TIR anual y TWR (time-weighted, aproximado entre valuaciones guardadas) para cartera, sombra y SPY solo —, posiciones cerradas, últimas operaciones, un bloque JSON exacto (`"tipo": "gestor-gastos-cartera"`; `rendimiento: { anio, "1a", "3a", "5a", inicio }` con `acumulado / tirAnual / twr` × `cartera / sombraSP500 / sp500Directo`, `alfaPP`, `alfaUSD`, `metodoAcumulado`) y las instrucciones para Claude.

## Qué se espera de Claude al recibirlo
Si Facu pregunta algo puntual (una acción, en qué poner un aporte), responder eso con los datos del archivo, sin la revisión completa. Si pide revisar la cartera:
1. Análisis objetivo de la cartera (concentración, calidad de tesis, quién aporta o destruye alfa, riesgos, qué falta/sobra), estilo asesor senior (ver COMOACTUAR.txt). Para juzgar la selección de activos usar TWR vs SPY solo; para juzgar el resultado real de Facu usar el acumulado / TIR vs la sombra.
2. Revisión de alertas: niveles **mirala** (acumulación) y **urgente** (descuento profundo) en USD del subyacente, **objetivo a 12 meses** y una línea de **tesis** por ticker (`nota`, empezando por el tier; `desc` solo para tickers nuevos o si está mal); altas/bajas de watchlist (solo CEDEARs de BYMA).
3. Cerrar con UN bloque ```json en este formato, que la app importa (Cartera → "Cargar actualizaciones", con vista previa antes de aplicar):

```json
{ "tipo": "gestor-gastos-cambios", "version": 2, "fecha": "AAAA-MM-DD",
  "alertas": {
    "MELI": { "mirala": 1750, "urgente": 1600, "objetivo": 2300, "desc": "E-commerce + fintech (Mercado Pago) líder de Latinoamérica.", "nota": "A- · próxima compra solo ≤1750" },
    "TSM": null
  },
  "comentario": "qué cambió y por qué, en una línea" }
```

Reglas del formato: solo los tickers que cambian; `null` quita el ticker de alertas/watchlist; los campos que no se mandan no se tocan (se puede mandar solo `"urgente"`); tickers en formato EE.UU. (BRK-B, no BRKB — la app también acepta códigos BYMA y los traduce); montos en USD por acción del subyacente; `urgente` debe ser ≤ `mirala`.

**v2 (21-sep-2026) — dos campos de texto por ticker:**
- `desc` = **qué hace la empresa**, una línea fija que no se recalibra (máx. 120 caracteres; la app corta lo que sobra). Opcional: si no se manda, no se toca; `""` o `null` la borra.
- `nota` = **tier + tesis** (máx. 300), lo que se recalibra post-earnings. Empieza por el tier (`A def ⭐ · cara, esperar`).
- Compatibilidad: si una `nota` trae ` | ` (formato viejo "qué hace | tesis"), la app la parte en `desc` + `nota` al importar; un `desc` explícito manda. Al arrancar, la app migra una sola vez las alertas guardadas con ese formato.
- Ambos campos se ven en la app (fila de alerta y encabezado de la ficha de empresa) y viajan en "Exportar para Claude" (columna "Qué hace") y en el contexto "Para Claude".

## Después de importar
Si cambiaron niveles, el bot de alertas (tarea programada `trig_01D6aMNws9KzBkpE5FmNv6jt`, corre cada hora en horario de mercado) sigue con los niveles viejos hasta que se actualice su prompt: Facu tiene que pedir en un chat con acceso a tareas programadas "actualizá la tarea de alertas con estos niveles". Mantener también `claude/alertas-cedears.md` al día (47 tickers + PFE desde el 21-sep).
