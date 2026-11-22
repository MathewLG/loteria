# Sistema visual

Grabado de feria a cuatro tintas: línea negra gruesa de grosor parejo y color impreso con el registro un poco corrido (2.5 px abajo y a la derecha de la línea). El registro corrido es la firma del juego.

Hay dos paletas con reglas distintas. La interfaz es sobria para que las cartas lleven el color; las ilustraciones usan más tintas porque representan cosas del mundo.

## Paleta de la interfaz

Vive en `public/css/estilos.css` (`:root`). Papel y tinta son la base; el grana es el único acento.

| Nombre | Hex | Uso |
| --- | --- | --- |
| Papel | `#F3E7CB` | Fondo de cartas, paneles y diálogos |
| Tinta | `#1B1714` | Texto, bordes, tablero |
| Tinta suave | `#4A3F36` | Texto secundario (contraste 7.5:1 sobre mantel) |
| Mantel | `#E9DCBC` | Fondo de la pantalla |
| Grana | `#B8322A` | Acento único: el botón ¡Lotería! y el aviso de ganador |
| Grana oscura | `#9E2922` | Grana al pasar el cursor |
| Añil | `#2F4F8F` | Foco del teclado sobre mantel y sello de baraja confirmada |
| Cempasúchil | `#E3A21A` | Foco del teclado sobre el tablero negro, donde el añil no contrasta |
| Apagado | `#CDBF9F` | Fondo del botón deshabilitado (texto en tinta) |

Reglas:
- El grana solo aparece en el momento clave (gritar, ganar). No se usa para decorar.
- Todo texto cumple WCAG 2.2 AA (4.5:1; 3:1 desde 24 px).
- Los estados no dependen solo del color: la tabla elegida se rellena de tinta, el frijol es una forma.

## Paleta de las ilustraciones

Vive en `public/js/grabado.js` (`TINTAS`). Se usa solo dentro de las cartas.

| Nombre | Hex | Para qué |
| --- | --- | --- |
| Grana | `#B8322A` | Rojos: corazón, sandía, rosa, gallo |
| Añil | `#2F4F8F` | Azules: cielo, agua, ropa |
| Cempasúchil | `#E3A21A` | Amarillos y barro: sol, cántaro, campana |
| Nopal | `#4E7A34` | Plantas |
| Hueso | `#FBF5E6` | Brillos, huesos, camisas blancas |
| Papel | `#F3E7CB` | Igual al fondo de la carta |
| Madera | `#8A5A3C` | Troncos, mangos, instrumentos |
| Piedra | `#CDBF9F` | Rocas y superficies neutras |
| Venado | `#A8713F` | Pelaje |
| Piel clara | `#E9BE94` | Retratos |
| Piel morena | `#C08A5E` | Retratos |
| Piel canela | `#A0663F` | Retratos |
| Piel oscura | `#7B4B2C` | Retratos; los rasgos van en trazo claro para leerse |

Reglas:
- Las cuatro tintas de feria (grana, añil, cempasúchil, nopal) son la base. Los tonos de madera, piedra, pelaje y piel existen porque representan materiales y personas reales; no se usan como decoración.
- Los retratos muestran diversidad de tonos de piel sin rasgos exagerados.
- Nada de degradados ni sombras: el volumen se sugiere con rayado de tinta.

## Tipografía

- **Alfa Slab One:** nombres de cartas, títulos y el grito. Evoca el tipo de madera de los carteles de feria.
- **Atkinson Hyperlegible:** todo el texto de interfaz. Legible a cualquier edad, y la lotería se juega con abuelos.
- Monoespaciada solo para los datos técnicos plegados en `verificar.html`, para poder copiarlos.

## Movimiento

- El frijol cae, rebota y queda chueco (420 ms). La carta cantada entra con un giro corto.
- Con `prefers-reduced-motion`, el frijol solo aparece y las demás animaciones se quitan.
