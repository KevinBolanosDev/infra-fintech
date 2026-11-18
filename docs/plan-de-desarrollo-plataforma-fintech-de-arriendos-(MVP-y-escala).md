# Plan de desarrollo — Plataforma fintech de arriendos (MVP y escala)

Nov 11, 2026 · @Kevin · **v2 (13 nov 2026):** el gancho del producto pasa a ser el ahorro para compra de vivienda. Lo nuevo está en "Producto: del arriendo a la casa propia"; el resumen de cambios, en "Registro de cambios" al final.

## Resumen ejecutivo

El producto convierte el arriendo en el camino hacia la vivienda propia: cada canon pagado en la plataforma deja historial verificable y cada aporte a la **Meta Casa** acerca la cuota inicial. El objetivo es un MVP que corra dos ciclos completos, el del arriendo (registro, contrato, cobro mensual por Bre-B, conciliación, recibo, score y certificado) y el del ahorro para vivienda (meta, simulador de ruta, aportes, conciliación y carpeta de vivienda), con usuarios y proveedores simulados, y que pase a producción cambiando solo configuración y credenciales. La plataforma nunca custodia dinero: los cobros van directo a la cuenta del dueño, los aportes van directo a un producto de ahorro del propio inquilino en una entidad vigilada, y la plataforma lleva un registro contable propio de ambos.

**Decisiones tomadas**

| Tema | Decisión | Por qué |
| --- | --- | --- |
| Monorepo | Turborepo + pnpm, todo en contenedores Docker sobre Linux | Paquetes compartidos (contratos de API, esquemas, dominio) entre backend y frontend |
| Backend | NestJS (TypeScript) | Mismo lenguaje que el frontend, módulos e inyección de dependencias, ecosistema maduro para colas y validación |
| Base de datos | PostgreSQL gestionado con Prisma 7 | Transacciones ACID, restricciones e integridad, necesarias para el ledger |
| Autenticación | Better Auth dentro de NestJS, con correo y Google | Control total de sesiones, auditoría y migración de nube sin dependencia de un proveedor de auth |
| Gancho del producto | Ahorro para compra de vivienda (Meta Casa); el cobro del arriendo es el motor que lo alimenta | 40,8 % de los hogares vive en arriendo, la cuota inicial es la barrera de entrada y un pagador puntual no tiene hoy cómo demostrarlo |
| Dónde vive el ahorro | En un producto del inquilino en una entidad vigilada, detrás de la interfaz `SavingsProvider` | Recibir ahorro del público sin licencia es captación ilegal; además mantiene la regla de no custodia |
| Reglas de vivienda | Tabla de parámetros regulatorios con vigencia (salario mínimo, topes VIS, financiación máxima, subsidios) | Cambian cada año o por decreto; ningún valor va escrito en el código |
| Alcance del MVP | Cobro y ahorro simulados completos | Prueba la integración de pagos y de ahorro de punta a punta antes de tener credenciales reales |
| Frontend | Next.js con FSD, PWA, mobile-first | Una sola base de código para móvil y escritorio, instalable sin tiendas de apps |
| Equipo | 2 personas, backend primero | La infraestructura y el dominio se estabilizan antes de construir pantallas |

**Qué entrega el MVP**

- Un backend con todos los módulos de negocio, probado con escenarios simulados (pagos exitosos, fallidos, duplicados, tardíos y fraudulentos; aportes confirmados, fallidos, retiros y diferencias de saldo).
- La Meta Casa completa en simulación: simulador de ruta a la vivienda con reglas colombianas, plan de ahorro, aportes a un producto simulado, bonos con destino devengados y carpeta de vivienda compartible.
- Un simulador de proveedores con panel de escenarios y reloj controlable para recorrer meses en minutos.
- Una PWA para inquilino y dueño, más una página pública para verificar certificados.
- Un interruptor por variable de entorno para cambiar cada proveedor simulado por el real.

**Fuera del MVP:** dinero real, cuenta o billetera propia (incluido el apartado automático del arriendo al recibir el sueldo), fianzas y pólizas, tarjetas, vitrina de inmuebles y panel de inmobiliarias. Están en la sección de escalamiento.

## Producto: del arriendo a la casa propia

El inquilino es el cliente y su problema es salir del arriendo. La plataforma le resuelve tres cosas que hoy no tiene: un historial de pago que un tercero pueda verificar, un plan concreto para reunir los recursos propios de su vivienda y un sitio regulado donde ese ahorro crece a su nombre.

### Problema y gancho

- **Mercado:** el 40,8 % de los hogares colombianos vive en arriendo o subarriendo según la Encuesta de Calidad de Vida 2025 del DANE, citada en prensa ([La República](https://www.larepublica.co/economia/resultados-de-la-encuesta-calidad-de-vida-2025-del-dane-4375167), [Portafolio](https://www.portafolio.co/mis-finanzas/vivienda/meta-risaralda-y-cundinamarca-superan-el-47-de-hogares-en-arriendo-colombia-tiene-116-685-inmuebles-en-rentas-495288)); en 2019 era el 35,7 %.
- **Barrera 1, la cuota inicial:** los bancos financian hasta el 80 % en vivienda VIS nueva y hasta el 70 % en el resto, así que el comprador pone entre el 20 % y el 30 % ([Bancolombia](https://blog.bancolombia.com/vida-cotidiana/como-tener-vivienda-propia-en-colombia-gcv/)).
- **Barrera 2, el ingreso:** la primera cuota del crédito no puede pasar del 40 % del ingreso familiar ([Decreto 0583 de 2025](https://www.minvivienda.gov.co/sites/default/files/normativa/0583_2025.pdf)). Para ingresos bajos este límite recorta el crédito más que el porcentaje de financiación (ver el ejemplo).
- **Barrera 3, el historial:** no encontramos evidencia de que el pago del arriendo se reporte de forma sistemática a las centrales de riesgo; el pagador puntual llega al banco sin cómo probarlo. Es una hipótesis a validar con un banco y con una central.
- **Barrera 4, los subsidios:** Mi Casa Ya no tiene convocatoria abierta en 2026; queda el subsidio de las cajas de compensación, que en varias cajas pide un ahorro previo del 10 % del valor de la vivienda ([Portafolio](https://www.portafolio.co/mis-finanzas/vivienda/subsidios-de-vivienda-vigentes-en-2026-cajas-de-compensacion-y-programas-locales-tras-mi-casa-ya-485814), [Comfenalco Quindío](https://comfenalcoquindio.com/wp-content/uploads/2026/02/requisitos-subsidio-vivienda-nueva.pdf)).

**Promesa:** "Tu arriendo ya te cuesta. Que te acerque a tu casa." No se promete que el usuario comprará vivienda, ni un rendimiento, ni un subsidio: se promete un plan con cifras, un historial verificable y un lugar regulado para ahorrar.

### Comparación con Habify (Argentina)

Habify es la referencia más cercana: "la billetera del inquilino", hoy en beta y con parte de sus funciones solo anunciadas ([habify.com.ar](https://www.habify.com.ar/), leído el 13 nov 2026). Su sitio no publica reglas de cashback, pesos del score, tasas ni la entidad que guarda el dinero, así que copiamos la idea de cada función y definimos nosotros la lógica.

| Función de Habify | En el plan v1 | Adaptación a Colombia | Dónde queda |
| --- | --- | --- | --- |
| Pago del arriendo con recibo automático | Sí (`charges`, `receipts`) | Igual, por Bre-B directo al dueño | MVP |
| El dueño no necesita registrarse | No: exigía invitación y aceptación del dueño | Contrato autodeclarado: el inquilino registra canon, día de pago y llave Bre-B del dueño; pesa menos en el score hasta que el dueño confirme | MVP (fase 1) |
| Habify Score de 0 a 1000 (identidad, pagos en fecha, antigüedad, constancia de ahorro) | Parcial: solo pagos | Los mismos cuatro factores más el nivel de verificación del contrato; nunca bloquea al usuario | MVP (fase 3) |
| Certificado de buena paga con QR, a los tres meses | Sí (`certificates`) | Igual; se habilita con tres periodos pagados | MVP (fase 3) |
| Mi casa propia: meta, aportes, cashback con destino y constancia para el crédito | No | **Meta Casa**, el núcleo del producto | MVP (fase 2B) |
| Simulador de ahorro | No | Simulador de ruta a la vivienda con reglas colombianas (VIS, subsidio, relación cuota/ingreso) | MVP (fase 2B) |
| Fondo Mudanza | No | Un segundo tipo de meta (trasteo, primer canon, estudio de fianza). En Colombia nunca funciona como depósito en garantía | MVP, como tipo de meta sin lógica propia |
| HabiReserva: aparta el arriendo cuando entra el sueldo | Escala ("bolsillo del arriendo") | Exige una cuenta donde entre el sueldo, es decir un aliado BaaS. En el MVP se cubre con día de nómina, recordatorio y aporte programado | Recordatorio en MVP; apartado real en escala |
| Cuenta con CVU, transferencias y pagos | Fuera | Depósito en una entidad vigilada a través de un aliado | Escala |
| Caución sin garante | Escala ("pólizas") | Fianza o póliza de arrendamiento sin codeudor, intermediada; un mejor score baja el precio | Escala |
| Depósito que rinde y depósito administrado | No | **No aplica:** el artículo 16 de la Ley 820 de 2003 prohíbe los depósitos en garantía en vivienda urbana ([El Espectador](https://www.elespectador.com/economia/pedir-un-deposito-para-arrendar-un-inmueble-en-colombia-es-legal/)) | Descartado |
| Seguro de impago para dueños | Escala | Se ofrece junto con la fianza | Escala |
| Vitrina de inmuebles, leads verificados, botón multiplataforma | No | Es otro negocio (marketplace). El "lead verificado" se cubre con el certificado que el inquilino comparte | Escala, sin fecha |
| Panel de cartera, agentes y migración para inmobiliarias | Escala | Igual | Escala |
| Plan Plus (suscripción) | No | Posible fuente de ingresos | Escala |

### Meta Casa: lógica de negocio

**1. Ruta a la vivienda (cálculo).** Función pura en `packages/domain`, sin efectos, que recibe los datos del hogar y los parámetros regulatorios vigentes y devuelve cuánto hay que ahorrar y por qué.

Entradas: precio objetivo, tipo de vivienda (VIP, VIS o No VIS; nueva o usada), municipio, ingreso mensual del hogar, afiliación a caja de compensación, si ya es propietario o recibió subsidio, cesantías disponibles, ahorro confirmado, fecha objetivo, tasa y plazo de referencia. Ingreso, cesantías y afiliación son declarados por el usuario en el MVP.

1. **Subsidio estimado:** cero si el hogar no cumple las condiciones; si las cumple, el valor de la tabla de parámetros según el tramo de ingreso.
2. **Crédito máximo por valor:** financiación máxima × precio.
3. **Crédito máximo por ingreso:** el monto cuya primera cuota, con la tasa y el plazo de referencia, es igual a la relación cuota/ingreso máxima × ingreso.
4. **Crédito estimado:** el menor entre los dos anteriores y (precio − subsidio).
5. **Recursos propios:** precio − subsidio − crédito estimado + gastos de cierre.
6. **Brecha:** recursos propios − cesantías − ahorro confirmado, nunca menor que cero.
7. **Aporte sugerido:** brecha ÷ meses hasta la fecha objetivo, sin suponer rendimientos. También se calcula al revés: con un aporte dado, en qué mes se cierra la brecha.

El resultado guarda la versión de los parámetros con que se calculó y una explicación paso a paso; se muestra siempre como estimación, nunca como oferta de crédito ni asignación de subsidio.

**2. Meta y plan de ahorro.**

- Una meta tiene tipo (`home` o `moving`), nombre, monto objetivo y fecha objetivo. Un usuario tiene como máximo una meta `home` activa.
- El plan fija el aporte mensual y el día, por defecto el día de pago del canon o el día de nómina que el usuario indique.
- Modalidad "junto con el arriendo": el inquilino ve un solo total y hace dos pagos en el mismo flujo, el canon a la llave del dueño y el aporte a su producto de ahorro. No se puede cobrar un solo pago y repartirlo: eso exigiría recibir el dinero.
- El plan se pausa o cambia cuando el usuario quiera, sin penalidad.

**3. Aportes.**

- Cada aporte se confirma igual que un cobro: se reserva una referencia o llave en el proveedor de ahorro y solo la consulta a su API lo marca como confirmado. Lleva clave de idempotencia.
- Un aporte es voluntario. Si no se hace, no hay deuda, mora ni asiento contable; solo cuenta menos en el factor de constancia del score.
- Se admiten aportes extra en cualquier momento. Mínimos y topes vienen de la configuración del producto de ahorro (por ejemplo, el tope de un depósito de bajo monto).

**4. Retiros y rendimientos.**

- El dinero es del usuario y está en su producto: la plataforma no puede impedir un retiro ni ejecutarlo. Se entera por la conciliación diaria con la entidad y lo registra.
- Un retiro baja el avance de la meta y el factor de constancia. Antes de retirar se muestran las consecuencias propias del producto (por ejemplo, perder el beneficio tributario de una cuenta AFC).
- Los rendimientos se muestran tal como los reporta la entidad. La plataforma no promete ni calcula una tasa.

**5. Bonos con destino.** Equivalen al "cashback con destino" de Habify: un incentivo que paga la plataforma con sus propios recursos y que solo puede ir a la meta, nunca al saldo para gastar. Las reglas son versionadas y con tope (por ejemplo, un bono por cada canon pagado en fecha). Como el MVP no tiene ingresos, el bono se devenga en el ledger y se muestra rotulado como simulado; cómo se financia y cómo tributa su pago real es una decisión pendiente. Nunca se le llama rendimiento.

**6. Score y preparación para la vivienda.**

- El score sigue siendo explicable y versionado. Propuesta inicial de la fórmula v1, a calibrar con los escenarios del simulador: pagos en fecha (hasta 500 puntos), constancia de ahorro (200), antigüedad del arriendo (150), identidad verificada (100) y verificación del contrato (50).
- Un mal mes baja el score, pero nunca bloquea funciones.
- La "preparación para la vivienda" es el porcentaje de la brecha ya cubierto, con hitos: 25 %, 50 %, 75 %, ahorro previo del 10 % alcanzado y listo para pedir preaprobación.

**7. Carpeta de vivienda.** Un documento firmado y verificable por QR que reúne el certificado de pagos del arriendo, el resumen de aportes confirmados y la ruta vigente, para que el usuario lo comparta con un banco, el FNA o su caja. La certificación oficial del saldo la emite la entidad donde está el ahorro; la carpeta lo dice de forma expresa.

### Dónde vive el ahorro

La plataforma no puede recibir ahorro: captar dinero del público de forma masiva y habitual sin autorización es delito (artículo 316 del Código Penal; el Decreto 1068 de 2015 lo configura, entre otros casos, desde 20 personas o 50 obligaciones) ([Portafolio](https://www.portafolio.co/economia/finanzas/como-identificar-las-nuevas-tipologias-de-captacion-ilegal-de-dinero-607882)). Por eso cada aporte va a un producto abierto a nombre del inquilino en una entidad vigilada, y el proveedor de producción se elige en la fase 4.

| Producto | Qué aporta al usuario | Límites para este caso |
| --- | --- | --- |
| Ahorro voluntario contractual del FNA | Da acceso al crédito del FNA, que anunció financiar hasta el 100 % en VIS y VIP para primera vivienda; sirve a independientes; sin permanencia mínima ([Vanguardia](https://www.vanguardia.com/colombia/2026/01/25/fna-2026-cuanto-ahorrar-para-la-cuota-inicial-de-su-vivienda/), [El País](https://www.elpais.com.co/economia/fna-anuncio-que-acaba-con-la-cuota-inicial-para-quienes-compren-la-primera-vivienda-vis-o-vip-0609.html)) | Entidad pública; no sabemos si ofrece integración por API. Las fechas del crédito al 100 % difieren entre fuentes |
| Ahorro programado para vivienda (bancos) | Las cajas lo aceptan como ahorro previo para el subsidio | Depende de un convenio con un banco |
| Cuenta AFC (bancos) | Aportes como renta exenta hasta el 30 % del ingreso y 3.800 UVT al año; exenta de 4x1000; el retiro debe ir a vivienda ([BBVA](https://www.bbva.com.co/personas/blog/educacion-financiera/cuentas/que-es-una-cuenta-afc.html), [Siempre al Día](https://siemprealdia.co/colombia/impuestos/renta-exenta-aportes-a-cuentas-afc/)) | El beneficio solo importa a quien declara y paga renta, que no es el grueso del público objetivo. Hay una reforma en discusión que bajaría el tope |
| Bolsillo en un depósito de bajo monto (aliado BaaS) | Apertura digital y buena experiencia | Tope de 210,5 UVT, unos $11 millones en 2026 ([Infobae](https://www.infobae.com/colombia/2026/01/08/nequi-y-daviplata-tienen-nuevos-topes-y-reglas-en-2026-asi-cobran-ahora-por-el-impuesto-del-4x1000-en-las-transferencias/)): no alcanza para una cuota inicial completa; habría que pasar a cuenta de ahorros |
| Fondo de inversión colectiva o CDT | Rendimiento | Riesgo de pérdida o iliquidez; recomendar un producto de inversión es una actividad regulada |

**Criterios para elegir el proveedor de ahorro (fase 4):**

1. El producto queda a nombre del usuario en una entidad vigilada, con seguro de depósito cuando aplique.
2. Sirve para el objetivo: cuenta como ahorro previo ante las cajas o abre la puerta a un crédito.
3. API para abrir el producto, recibir aportes con referencia única, consultar saldo y movimientos, y webhooks firmados.
4. Sin tope que impida llegar a la cuota inicial, o con paso automático a un producto sin tope.
5. Costo por usuario y por aporte, cotizado por escrito.
6. Sandbox con estados controlables.

Si al llegar a producción no hay aliado de ahorro, la Meta Casa sale en modo seguimiento: simulador, plan y aportes que el usuario declara con soporte, marcados como no verificados. Es una decisión pendiente.

### Parámetros regulatorios

Viven en la tabla `regulatory_parameters`, con fecha de vigencia, fuente y quién los verificó. Los valores de 2026 que usa el simulador vienen de prensa y de páginas comerciales: **hay que verificarlos contra la norma antes de mostrarlos a usuarios reales.**

| Parámetro | Valor 2026 | Fuente |
| --- | --- | --- |
| Salario mínimo (SMMLV) | $1.750.905 | Decreto 1469 de 2025, citado en guías de subsidios |
| UVT | $52.374 | [Infobae](https://www.infobae.com/colombia/2026/01/08/nequi-y-daviplata-tienen-nuevos-topes-y-reglas-en-2026-asi-cobran-ahora-por-el-impuesto-del-4x1000-en-las-transferencias/) |
| Tope VIS | 135 SMMLV ($236.372.175); 150 SMMLV ($262.635.750) en algunos municipios | Guías de subsidios; Decreto 0584 de 2025 |
| Tope VIP | 90 SMMLV ($157.581.450) | Guías de subsidios |
| Financiación máxima | 80 % VIS nueva; 70 % No VIS y usada; leasing habitacional hasta 90 % en algunas entidades | [Bancolombia](https://blog.bancolombia.com/vida-cotidiana/como-tener-vivienda-propia-en-colombia-gcv/), [RCN](https://www.noticiasrcn.com/economia/bancos-prestan-90-ciento-comprar-vivienda-2026-1043012) |
| Relación cuota/ingreso máxima | 40 % en VIS y No VIS | [Decreto 0583 de 2025](https://www.minvivienda.gov.co/sites/default/files/normativa/0583_2025.pdf) |
| Subsidio de caja de compensación | 30 SMMLV ($52.527.150) o 20 SMMLV ($35.018.100) según ingreso, para hogares de hasta 4 SMMLV ($7.003.620) | Cifras de Comfama recogidas en prensa ([Blu Radio](https://www.bluradio.com/economia/subsidio-de-mas-de-100-millones-para-comprar-casa-los-montos-de-las-cajas-de-compensacion-en-2026-so35), [Portafolio](https://www.portafolio.co/mis-finanzas/vivienda/subsidios-de-vivienda-vigentes-en-2026-cajas-de-compensacion-y-programas-locales-tras-mi-casa-ya-485814)); cada caja fija las suyas |
| Tasa de referencia de crédito de vivienda | Cerca de 13 % efectivo anual en pesos | [Rankia](https://www.rankia.co/blog/mejores-creditos-y-prestamos-colombia/3805117-tasas-interes-creditos-hipotecarios); sin cifra oficial |
| Gastos de cierre (notaría, registro, avalúo) | Sin valor todavía | Pendiente de investigar |

No se confirmó en qué tramo de ingreso cambia el subsidio de 30 a 20 SMMLV (el ejemplo supone 2 SMMLV) ni el monto mínimo vigente del ahorro voluntario del FNA.

### Ejemplo

Hogar con ingreso de $3.400.000 que quiere una vivienda VIS nueva de $200.000.000, con crédito a 20 años al 13 % efectivo anual y sin contar gastos de cierre. Es una ilustración con los parámetros de arriba.

| Paso | Cálculo | Resultado |
| --- | --- | --- |
| Subsidio estimado | 30 SMMLV | $52.527.150 |
| Crédito máximo por valor | 80 % de $200.000.000 | $160.000.000 |
| Cuota máxima | 40 % de $3.400.000 | $1.360.000 |
| Crédito máximo por ingreso | Monto que se paga con esa cuota | $121.324.000 |
| Crédito estimado | El menor | $121.324.000 |
| Recursos propios | $200.000.000 − $52.527.150 − $121.324.000 | $26.149.000 |
| Aporte sugerido a 36 meses | $26.149.000 ÷ 36 | $726.000 al mes |
| Aporte sugerido a 48 meses | $26.149.000 ÷ 48 | $545.000 al mes |

Lo que limita a este hogar es el ingreso, no el porcentaje de financiación: sin el cálculo, el usuario creería que le falta el 20 % ($40.000.000). Este es el valor del simulador.

### Límites regulatorios del producto

1. **Sin captación:** ningún aporte pasa por una cuenta de la plataforma.
2. **Sin promesas:** simulaciones rotuladas como estimación; ninguna pieza dice que el usuario comprará vivienda, recibirá un subsidio o ganará una tasa (Estatuto del Consumidor).
3. **Sin recomendación de inversión:** la plataforma muestra los productos disponibles y sus reglas; no aconseja uno según el perfil del usuario mientras el abogado no defina el alcance permitido.
4. **Sin depósitos en garantía:** ningún ahorro del inquilino queda afectado a favor del dueño (Ley 820 de 2003, artículo 16).
5. **El usuario comparte sus datos:** score, certificado y carpeta salen por decisión del usuario. Reportar a centrales de riesgo convertiría a la plataforma en fuente de información bajo la Ley 1266 de 2008 y queda fuera del MVP.
6. **Conocimiento del cliente:** verificación de identidad antes del primer aporte; la entidad aliada aplica su propio control de lavado de activos.

### Modelo de ingresos

Pagos, recibos, score, certificado y Meta Casa son gratis para el inquilino. Las fuentes de ingreso son hipótesis sin validar y varias pueden requerir registro o licencia:

| Fuente | Cuándo | Qué hay que validar |
| --- | --- | --- |
| Comisión por crédito de vivienda o leasing originado con un banco, el FNA o una constructora | Cuando haya usuarios con la brecha cubierta | Si los bancos pagan por un cliente con historial verificado; figura legal de la referenciación |
| Intermediación de fianza o póliza de arrendamiento | Etapa de fianzas | Costo de mercado (entre el 2 % y el 6 % mensual del canon o medio canon al año, según [Portafolio](https://www.portafolio.co/economia/finanzas/seguro-de-arrendamiento-lo-que-cubre-y-lo-que-debe-saber-521766) y Ciencuadras); requisitos para intermediar seguros |
| Comisión del aliado de ahorro | Con el proveedor real | Si el aliado paga por saldos o por cuentas |
| Panel para dueños e inmobiliarias | Etapa de inmobiliarias | Disposición a pagar |
| Suscripción con funciones extra | Después del piloto | Qué funciones |

Duppla, que compra la vivienda y la arrienda con opción de compra desde un 15 % de cuota inicial ([Latam Fintech](https://www.latamfintech.co/articles/fintech-colombiana-duppla-levanta-us-60-millones-para-escalar-su-modelo-de-financiacion-alternativa-para-vivienda)), es a la vez una alternativa para el usuario y un posible aliado al que llevarle clientes con ahorro e historial.

## Principios de arquitectura fintech

Diez reglas aplican a todos los módulos; cualquier diseño que viole una se rechaza en revisión de código.

1. **No custodia.** El canon va de la cuenta del inquilino a la del dueño y el aporte va de la cuenta del inquilino a su propio producto de ahorro en una entidad vigilada. La plataforma nunca recibe fondos de terceros en una cuenta propia para reenviarlos ni para guardarlos.
2. **Ledger de partida doble.** Todo movimiento de valor, aunque sea simulado, genera asientos que suman cero. Los saldos se calculan desde el ledger, nunca se guardan sueltos.
3. **Inmutabilidad.** Pagos, asientos y eventos no se editan ni se borran. Un error se corrige con un asiento de reversa.
4. **Idempotencia en todo.** Cada operación que crea o mueve algo recibe una clave de idempotencia. Repetir una petición o un webhook produce el mismo resultado, no uno nuevo.
5. **Nunca confiar en un webhook.** Un aviso del proveedor dispara una consulta a su API; solo el resultado de esa consulta cambia estados.
6. **Proveedores intercambiables.** Cada servicio externo (pagos, identidad, notificaciones, almacenamiento) se usa a través de una interfaz con dos implementaciones: simulada y real.
7. **Reloj controlable.** Ninguna lógica lee la hora del sistema directamente; todo pasa por un servicio de reloj que el simulador puede adelantar.
8. **Auditoría completa.** Cada acción de usuario, de sistema o de proveedor deja un registro con quién, qué, cuándo y desde dónde.
9. **Parámetros regulatorios versionados.** Salario mínimo, UVT, topes VIS, financiación máxima, relación cuota/ingreso y subsidios se leen de una tabla con vigencia y fuente. Ningún valor regulatorio va escrito en el código, y todo cálculo guarda la versión que usó.
10. **Estimaciones explicables, sin promesas.** Ruta, score y bonos devuelven siempre su explicación y la versión de la fórmula. Ninguna respuesta de la API presenta una estimación como oferta de crédito, subsidio asignado o rendimiento garantizado.

Dinero siempre en **centavos y enteros** (`bigint`), nunca en decimales de punto flotante. Las fechas se guardan en UTC y se muestran en hora de Colombia (America/Bogota).

## Arquitectura del monorepo

Un solo repositorio con Turborepo y pnpm: cuatro aplicaciones desplegables y nueve paquetes compartidos, con reglas de dependencia que se validan en CI.

```
repo/
├─ apps/
│  ├─ api/            NestJS · API HTTP, auth, webhooks
│  ├─ worker/         NestJS (standalone) · colas y tareas programadas
│  ├─ provider-sim/   NestJS · simulador de Payments Way, KYC, entidad de ahorro y notificaciones
│  └─ web/            Next.js · PWA inquilino, dueño, verificación pública (fase 4)
├─ packages/
│  ├─ domain/         lógica pura: Money, contratos, cobros, ruta a la vivienda, aportes, score, reglas del ledger
│  ├─ contracts/      esquemas zod de la API + generación de OpenAPI
│  ├─ api-client/     cliente tipado para el frontend, generado desde contracts
│  ├─ db/             esquema Prisma, migraciones, seeds
│  ├─ integrations/   interfaces de proveedores + adaptadores mock y reales
│  ├─ observability/  logger, trazas y métricas compartidas
│  ├─ testing/        fábricas de datos, escenarios y utilidades de prueba
│  ├─ ui/             design system (Radix + Tailwind) (fase 4)
│  └─ config/         tsconfig, ESLint, Prettier compartidos
├─ infra/
│  └─ docker/         compose.yaml, perfiles y configuración de servicios locales
├─ turbo.json
└─ pnpm-workspace.yaml
```

&#91;embedded content: arquitectura · 4 apps, 4 paquetes clave, Postgres y Redis\]

La web y el simulador solo se comunican con la API por HTTP; `api` y `worker` comparten la lógica de `packages` y se coordinan por colas en Redis.

**Reglas de dependencia**

| Paquete o app | Puede importar | Nunca importa |
| --- | --- | --- |
| `domain` | Nada externo (solo TypeScript) | NestJS, Prisma, HTTP, proveedores |
| `contracts` | `zod` | `domain` interno, `db` |
| `db` | `@prisma/client`, `domain` (tipos) | `integrations`, apps |
| `integrations` | `domain`, `contracts` | `db`, apps |
| `api`, `worker` | todos los paquetes de backend | `web`, `ui` |
| `provider-sim` | `contracts`, `integrations` (formas de payload) | `db` de la plataforma (tiene su propia base) |
| `web` | `contracts`, `api-client`, `ui`, utilidades puras de `domain` | `db`, `integrations` |

Las reglas se hacen cumplir con `eslint-plugin-boundaries` o `dependency-cruiser` en CI: un import prohibido rompe el build.

**Capas dentro de cada módulo de NestJS** (arquitectura hexagonal):

- `domain/`: entidades y reglas del módulo, sin dependencias.
- `application/`: casos de uso (`CreateLease`, `ReserveCharge`), transacciones y orquestación.
- `infrastructure/`: repositorios con Prisma, adaptadores de proveedores, colas.
- `interface/`: controladores HTTP, receptores de webhooks y consumidores de colas.

**Herramientas base:** pnpm, Turborepo con caché remota, TypeScript estricto, Node.js 24 LTS, NestJS 12 en ESM, paquetes internos bajo el scope `@repo/*`, Docker y Docker Compose sobre Linux (ver la sección de contenedores).

**ORM:** Prisma 7. Desde la versión 7 el cliente se genera sin binario de Rust (compilador de consultas en TypeScript con el adaptador de pg), lo que simplifica las imágenes Docker. Migraciones con prisma migrate; lo que Prisma no expresa (triggers del ledger, permisos de solo inserción, índices parciales) va como SQL dentro de las mismas migraciones. Transacciones interactivas para el ledger y BigInt para el dinero.

## Contenedores y entorno Linux

Sí es posible y es lo recomendado: todo el sistema corre en contenedores Linux, del desarrollo local a producción, con la misma imagen promovida de un ambiente al siguiente. En Linux se usa Docker Engine directamente; en macOS y Windows (con WSL2) se usa Docker Desktop, y los contenedores siguen siendo Linux.

### Imágenes por aplicación

Cada app tiene su `Dockerfile` en `apps/<app>/Dockerfile`, construido en tres etapas:

1. **Poda:** `turbo prune <app> --docker` copia solo el código y las dependencias que esa app usa del monorepo.
2. **Construcción:** instala dependencias con `pnpm install --frozen-lockfile`, ejecuta `prisma generate` y compila TypeScript.
3. **Ejecución:** imagen mínima con Node.js 24 LTS sobre Debian slim, usuario sin privilegios, `HEALTHCHECK` y solo los archivos compilados.

Se prefiere Debian slim a Alpine: evita incompatibilidades con librerías nativas (fuentes para PDF, criptografía). Como Prisma 7 ya no usa binario de Rust, no hay que configurar destinos de binario por sistema operativo.

| Imagen | Contenido | Notas |
| --- | --- | --- |
| `api` | NestJS HTTP | Puerto 3000, healthcheck en `/health` |
| `worker` | NestJS standalone con BullMQ | Sin puerto público; varias réplicas posibles |
| `provider-sim` | Simulador de proveedores | Nunca se publica en el registro de producción |
| `migrator` | CLI de Prisma | Ejecuta `prisma migrate deploy` como tarea única antes de cada despliegue, nunca al arrancar la API |
| `web` | Next.js con salida `standalone` | Para portabilidad; en Vercel no se necesita la imagen |

### Entorno local con Docker Compose

Un archivo `infra/docker/compose.yaml` levanta todo con un comando. Los servicios tienen healthchecks y cada app espera a que sus dependencias estén sanas.

| Servicio | Imagen | Para qué |
| --- | --- | --- |
| `postgres` | PostgreSQL oficial | Base de la plataforma y base separada del simulador |
| `redis` | Redis oficial | Colas y reloj simulado |
| `minio` | MinIO | Almacenamiento compatible con S3 para PDFs y comprobantes |
| `mailpit` | Mailpit | Bandeja de correo falsa con interfaz web |
| `api`, `worker`, `provider-sim` | Imágenes propias | Con recarga automática mediante `docker compose watch` |
| `web` | Imagen propia | Se agrega en la fase 4 |

Perfiles de Compose para no levantar todo siempre: `infra` (solo Postgres, Redis, MinIO y Mailpit), `backend` (infra más `api`, `worker` y `provider-sim`) y `full`.

Opcional: un Dev Container (VS Code o JetBrains) con Node, pnpm y las herramientas fijadas, para que ambas personas trabajen con el mismo entorno exacto.

### CI y producción

- Las pruebas de integración usan Testcontainers, que crea Postgres y Redis desechables por suite; el runner de CI necesita Docker.
- En cada fusión a `main` se construyen las imágenes con caché de capas, se escanean con Trivy y se publican en un registro (GitHub Container Registry o Amazon ECR) etiquetadas con el hash del commit.
- La misma imagen pasa de `staging` a `production`; solo cambian variables de entorno y secretos, que nunca se copian dentro de la imagen.
- Destino de las imágenes: Railway o Render en staging (aceptan Dockerfile) y AWS ECS Fargate en producción.

## Backend NestJS: módulos

El backend se divide en 19 módulos de negocio (15 del ciclo del arriendo y 4 del ahorro para vivienda) y 4 transversales; cada uno tiene dueño, límites claros y se comunica con los demás por casos de uso o eventos, nunca leyendo tablas ajenas.

### Módulos de negocio

| # | Módulo | Responsabilidad | Endpoints y eventos clave |
| --- | --- | --- | --- |
| 1 | `auth` | Registro e inicio de sesión con correo o Google, sesiones, recuperación de cuenta, segundo factor para acciones sensibles | Rutas de Better Auth en `/v1/auth/*` (correo, Google, sesión, 2FA); evento `UserRegistered` |
| 2 | `users` | Perfil, roles (inquilino, dueño, admin, operaciones), preferencias | `GET/PATCH /me` |
| 3 | `consents` | Autorizaciones de tratamiento de datos con versión del texto, fecha, IP y canal; revocación | `POST /consents`, `DELETE /consents/:id`; evento `ConsentRevoked` |
| 4 | `identity` | Verificación de identidad (documento, biometría, listas restrictivas) a través de `IdentityProvider` | `POST /identity/verifications`; webhook del proveedor; evento `IdentityVerified` |
| 5 | `properties` | Inmuebles: dirección, ciudad, tipo, estrato; un dueño puede tener varios | CRUD `/properties` |
| 6 | `leases` | Contrato: partes, canon, día de pago, fecha de inicio y fin, reajuste anual por IPC con su tope. Dos niveles de verificación: autodeclarado por el inquilino (activo sin el dueño) y confirmado por el dueño (tras invitación y aceptación) | `POST /leases`, `POST /leases/:id/invite-owner`, `POST /leases/:id/accept`; eventos `LeaseActivated`, `LeaseConfirmedByOwner`, `LeaseEnded` |
| 7 | `payout-destinations` | Llave Bre-B o cuenta del dueño, verificación de titularidad antes de usarla. En un contrato autodeclarado la registra el inquilino y se valida con la resolución de la llave: el titular no puede ser el propio inquilino | `POST /payout-destinations`, `POST /:id/verify` |
| 8 | `charges` | Un cobro por periodo: generación, reserva de llave dinámica, expiración, renovación, estados | `GET /leases/:id/charges`, `POST /charges/:id/payment-intent`; eventos `ChargeCreated`, `ChargePaid`, `ChargeOverdue` |
| 9 | `provider-events` | Recepción de webhooks, deduplicación, verificación contra la API del proveedor, conciliación diaria | `POST /webhooks/paymentsway`; tarea `reconcile-daily` |
| 10 | `ledger` | Cuentas internas, asientos de partida doble, saldos, reversas | Solo interno; consulta `GET /admin/ledger/accounts/:id` |
| 11 | `receipts` | Recibo por cobro pagado: numeración consecutiva, PDF, hash, almacenamiento | `GET /receipts/:id`, `/receipts/:id/pdf`; evento `ReceiptIssued` |
| 12 | `score` | Eventos que mueven el puntaje (pagos, aportes, antigüedad, identidad, verificación del contrato), cálculo explicable y versionado de la fórmula; nunca bloquea funciones | `GET /me/score`, `/me/score/history`; evento `ScoreChanged` |
| 13 | `certificates` | Emisión, firma digital, expiración, revocación y página pública de verificación. Dos tipos: certificado de buena paga (desde tres periodos pagados) y carpeta de vivienda (pagos, aportes confirmados y ruta) | `POST /certificates`, `GET /public/certificates/:code` |
| 14 | `notifications` | Recordatorios y avisos por correo, push y WhatsApp con plantillas y preferencias; incluye el recordatorio de aporte el día de nómina y los hitos de la meta | Solo interno; consumidor de eventos |
| 15 | `backoffice` | Operaciones: buscar usuarios, cobros y aportes, reintentar, conciliar a mano con doble aprobación, publicar parámetros regulatorios | `/admin/*` con rol y segundo factor |
| 16 | `housing-parameters` | Parámetros regulatorios con vigencia, fuente y verificador; entrega el conjunto vigente en una fecha del reloj. Publicar un cambio exige doble aprobación | `GET /housing-parameters/current`; `POST /admin/housing-parameters`; evento `HousingParametersPublished` |
| 17 | `home-goals` | Meta (vivienda o mudanza), plan de ahorro, cálculo de la ruta con su explicación, preparación para la vivienda e hitos | `POST /home-goals/simulate` (sin sesión, no guarda nada), `POST /home-goals`, `GET /home-goals/:id/route`, `PATCH /home-goals/:id/plan`; eventos `HomeGoalCreated`, `HomeGoalMilestoneReached` |
| 18 | `savings` | Producto de ahorro del usuario en la entidad (apertura y estado), aportes, movimientos reportados por la entidad (retiros y rendimientos) y conciliación diaria de saldos, todo a través de `SavingsProvider` | `POST /savings/destinations`, `POST /home-goals/:id/contributions`, `GET /home-goals/:id/movements`; webhook `POST /webhooks/savings`; eventos `ContributionConfirmed`, `WithdrawalDetected`, `YieldReported` |
| 19 | `rewards` | Bonos con destino: reglas versionadas con tope, devengo en el ledger y, en producción, pago al producto de ahorro del usuario | `GET /me/rewards`; evento `RewardAccrued` |

### Módulos transversales

| Módulo | Qué resuelve |
| --- | --- |
| `audit` | Registro inmutable de toda acción: actor, acción, recurso, antes y después, IP, `request_id` |
| `outbox` | Los eventos de dominio se guardan en la misma transacción que el cambio y el worker los publica a la cola; así nunca se pierde un evento ni se publica uno de una transacción fallida |
| `idempotency` | Interceptor que exige `Idempotency-Key` en los `POST` que crean o mueven algo y guarda la respuesta para devolverla igual si se repite |
| `clock` | Servicio de hora inyectable; en simulación lo controla el panel |

### Colas y tareas programadas (worker)

Cola con BullMQ sobre Redis. Cada tarea es idempotente y reintenta con espera exponencial.

| Tarea | Cuándo | Qué hace |
| --- | --- | --- |
| `generate-charges` | Diario, 00:05 hora Colombia | Crea los cobros del periodo que vencen en los próximos 5 días |
| `reserve-dynamic-key` | Al crear un cobro y al expirar una llave | Pide una llave nueva al proveedor |
| `mark-overdue` | Diario | Marca cobros vencidos y emite `ChargeOverdue` |
| `poll-pending` | Cada 10 minutos | Consulta cobros pendientes sin webhook (por si el aviso nunca llega) |
| `reconcile-daily` | Diario | Compara las transacciones del proveedor con el ledger y abre incidencias si no cuadran |
| `render-receipt` | Al pagarse un cobro | Genera el PDF y lo guarda |
| `recompute-score` | Al pagarse o vencerse un cobro, y al confirmarse un aporte o detectarse un retiro | Recalcula y guarda el nuevo puntaje con su explicación |
| `send-notification` | Por evento | Envía por el canal que corresponda |
| `schedule-contributions` | Diario | Crea el aporte del periodo de cada plan activo cuando se acerca su día |
| `reserve-contribution-reference` | Al crear un aporte y al expirar su referencia | Pide al proveedor de ahorro la referencia o llave del aporte |
| `poll-pending-contributions` | Cada 10 minutos | Consulta aportes pendientes sin webhook |
| `reconcile-savings-daily` | Diario | Compara saldo y movimientos de cada producto en la entidad con el ledger; registra retiros y rendimientos y abre incidencias si no cuadra |
| `accrue-rewards` | Al pagarse un cobro en fecha o cumplirse una regla | Devenga el bono según la regla vigente y su tope |
| `recompute-route` | Al confirmarse un aporte, detectarse un retiro o publicarse parámetros | Recalcula la ruta y los hitos de cada meta afectada |

### Convenciones de la API

- REST versionado (`/v1`), JSON, documentado con OpenAPI generado desde `packages/contracts`.
- Validación con esquemas zod compartidos (`nestjs-zod`), los mismos que usa el frontend en sus formularios.
- Errores con formato único (`code`, `message`, `details`, `request_id`), basado en RFC 9457.
- Paginación por cursor, nunca por página numerada, en listas que crecen (cobros, movimientos, auditoría).

## Modelo de datos, estados y ledger

PostgreSQL con identificadores UUIDv7 (ordenables por tiempo), dinero en `bigint` de centavos y restricciones en la base, no solo en el código.

### Tablas principales

| Grupo | Tablas | Notas |
| --- | --- | --- |
| Identidad | `users`, `sessions`, `consents`, `identity_verifications` | Documento y datos sensibles cifrados a nivel de columna |
| Contratos | `properties`, `leases`, `lease_parties`, `lease_adjustments`, `payout_destinations` | `lease_adjustments` guarda cada reajuste por IPC con su fecha; `leases.verification_level` distingue autodeclarado de confirmado por el dueño |
| Ahorro para vivienda | `home_goals`, `savings_plans`, `goal_route_snapshots`, `savings_destinations`, `savings_contributions`, `savings_movements` | Un `savings_contribution` por aporte; `savings_movements` guarda lo que reporta la entidad (retiros, rendimientos); cada `goal_route_snapshot` guarda entradas, resultado y versión de parámetros. Ingreso y datos del hogar cifrados a nivel de columna |
| Parámetros y bonos | `regulatory_parameters`, `reward_rules`, `reward_accruals` | Solo inserción: un cambio es una fila nueva con su vigencia, nunca una edición |
| Cobros | `charges`, `charge_attempts`, `provider_transactions` | Un `charge` por periodo; cada llave reservada es un `charge_attempt` |
| Eventos externos | `provider_events` | Webhook crudo, `UNIQUE (provider, external_id, status)` para deduplicar |
| Ledger | `ledger_accounts`, `ledger_transactions`, `ledger_entries` | Partida doble, solo inserción |
| Documentos | `receipts`, `certificates`, `files` | Hash SHA-256 de cada PDF |
| Score | `score_events`, `score_snapshots`, `score_formulas` | La fórmula tiene versión; cada snapshot guarda con cuál se calculó |
| Plataforma | `outbox`, `idempotency_keys`, `audit_log`, `jobs_dead_letter` | `audit_log` sin `UPDATE` ni `DELETE` (permisos de base de datos) |

### Estados de un cobro

| Desde | Hacia | Disparador |
| --- | --- | --- |
| — | `scheduled` | La tarea `generate-charges` crea el cobro del periodo |
| `scheduled` | `awaiting_payment` | Se reserva la llave dinámica y se notifica al inquilino |
| `awaiting_payment` | `awaiting_payment` | La llave expira y se reserva una nueva (nuevo `charge_attempt`) |
| `awaiting_payment` | `paid` | El proveedor confirma por consulta que la transacción es exitosa |
| `awaiting_payment` | `overdue` | Pasa la fecha de pago sin confirmación |
| `overdue` | `paid_late` | Se confirma un pago después del vencimiento |
| `paid` / `paid_late` | `reversed` | El proveedor reporta reembolso o reversa; se crea asiento de reversa |
| cualquiera abierto | `cancelled` | El contrato termina o el dueño anula el periodo, con motivo |

La máquina de estados vive en `packages/domain` y rechaza transiciones inválidas (por ejemplo, de `paid` a `awaiting_payment` si llega un webhook tardío).

### Estados de un aporte

| Desde | Hacia | Disparador |
| --- | --- | --- |
| — | `scheduled` | La tarea `schedule-contributions` crea el aporte del periodo, o el usuario pide un aporte extra |
| `scheduled` | `awaiting_payment` | Se reserva la referencia en el proveedor de ahorro y se notifica al usuario |
| `awaiting_payment` | `confirmed` | El proveedor confirma por consulta que el dinero entró al producto del usuario |
| `awaiting_payment` | `expired` | Pasa la ventana del aporte sin confirmación. No genera deuda ni mora |
| `awaiting_payment` | `failed` | El proveedor rechaza el aporte (monto distinto, tope del producto, producto inactivo) |
| `confirmed` | `reversed` | La entidad reporta la reversa; se crea asiento de reversa |
| `scheduled` | `skipped` | El usuario pausa el plan u omite el periodo |

Un retiro no es un estado del aporte: es un `savings_movement` que reporta la entidad, con su propio asiento.

### Ledger de partida doble

En el MVP no hay dinero propio en custodia, así que el ledger registra **obligaciones y su cumplimiento**, y **posiciones de ahorro confirmadas por la entidad**, no saldos bancarios.

| Cuenta | Tipo | Qué representa |
| --- | --- | --- |
| `lease:{id}:receivable` | Activo del dueño | Lo que el inquilino debe al dueño |
| `lease:{id}:rent_income` | Ingreso del dueño | Canon devengado |
| `owner:{id}:settled_external` | Activo del dueño | Pagos confirmados que llegaron a su banco |
| `user:{id}:savings_external` | Activo del usuario | Saldo confirmado de su producto de ahorro en la entidad vigilada |
| `goal:{id}:contributions` | Patrimonio del usuario | Aportes netos de retiros a la meta |
| `goal:{id}:yield` | Ingreso del usuario | Rendimientos reportados por la entidad |
| `goal:{id}:rewards` | Ingreso del usuario | Bonos con destino ya pagados a su producto |
| `platform:rewards_expense` | Gasto de la plataforma | Bonos devengados |
| `platform:rewards_payable` | Pasivo de la plataforma | Bonos devengados y aún no pagados |
| `platform:fees` | Ingreso de la plataforma | Comisiones propias, si las hay (fase posterior) |

Ejemplo, canon de $1.500.000 del periodo 2026-12:

| Momento | Débito | Crédito | Valor (centavos) |
| --- | --- | --- | --- |
| Se crea el cobro | `lease:L1:receivable` | `lease:L1:rent_income` | 150000000 |
| Se confirma el pago | `owner:O1:settled_external` | `lease:L1:receivable` | 150000000 |

Ejemplo de la Meta Casa G1 del usuario U1:

| Momento | Débito | Crédito | Valor (centavos) |
| --- | --- | --- | --- |
| Se confirma un aporte de $700.000 | `user:U1:savings_external` | `goal:G1:contributions` | 70000000 |
| La entidad reporta $4.200 de rendimiento | `user:U1:savings_external` | `goal:G1:yield` | 420000 |
| La entidad reporta un retiro de $200.000 | `goal:G1:contributions` | `user:U1:savings_external` | 20000000 |
| Se devenga un bono de $7.000 por canon en fecha | `platform:rewards_expense` | `platform:rewards_payable` | 700000 |

- Cada `ledger_transaction` suma cero; un trigger diferido en Postgres lo verifica al confirmar la transacción; se crea con SQL dentro de una migración de Prisma.
- Los saldos se calculan con una vista materializada o una consulta agregada, nunca con un campo `balance` que se actualiza.
- Un aporte programado no genera asiento: a diferencia del canon, no es una obligación. Solo entra al ledger lo que la entidad confirma.
- La fuente de verdad del saldo de ahorro es la entidad. Si la conciliación diaria encuentra una diferencia, se abre una incidencia; nunca se ajusta el ledger en silencio.
- Este diseño sirve sin cambios cuando llegue la cuenta propia (BaaS): se agregan cuentas `wallet:{id}` para el apartado del arriendo.

## Integraciones externas: análisis y selección

No se elige proveedor de pagos para producción todavía: el MVP simula la API de Payments Way (la que mejor encaja con el cobro por periodo) y la decisión final se toma en la fase 4 con la matriz de criterios de abajo.

### Pagos y Bre-B

| Proveedor | Qué ofrece para este caso | Sandbox | Webhooks | Encaje |
| --- | --- | --- | --- | --- |
| [Payments Way](https://developer.paymentsway.co/docs/merchant/integracion-breb/llave-dinamica) | Llave dinámica Bre-B ligada a monto exacto con conciliación automática; QR estático y dinámico; PayOuts; billetera marca blanca con KYC | Se entrega al activar el servicio | Sin firma documentada; hay que confirmar consultando la API | Alto para el cobro por periodo; dudas sobre el modelo de fondos (agregador) |
| [Wompi](https://docs.wompi.co/en/docs/colombia/sandbox-breb/) (Grupo Cibest) | Pasarela, links y QR; resolución de llaves Bre-B (ver el titular enmascarado antes de pagar); dispersión por Bre-B | Autoservicio, con llaves de prueba y estados controlables | [Firmados con checksum](https://docs.wompi.co/en/docs/colombia/guia-integracion-breb/) | Alto para verificar la llave del dueño; revisar si concilia cobros por referencia |
| [Cobre](https://apis.io/providers/cobre/) | API empresarial: cuentas, contrapartes, llaves Bre-B, conciliación, pagos inmediatos | Sí | Firmados | Medio: orientado a empresas, venta consultiva |
| [Kushki](https://docs.kushki.com/es/co/apm/bre-b-payments) | QR Bre-B (beta, procesador Credibanco), dispersión Bre-B (beta), onboarding de subcomercios por API | Sí | Sí | Medio: útil si cada dueño debe ser subcomercio |
| [EBANX](https://docs.ebanx.com/docs/pay-in/processing/payment-methods/country-specific/colombia/breb) | QR Bre-B por API | Sí | Sí | Bajo: enfoque transfronterizo |
| [Bold](https://developers.bold.co/api-integrations/integration-sandbox) | API ligada a datáfono SmartPro | Requiere datáfono | — | Bajo: pensado para venta presencial |

**Criterios para elegir el de producción (fase 4):**

1. **Modelo de fondos:** el dinero debe llegar directo al dueño (subcomercio o llave propia), no a una cuenta de la plataforma.
2. **Conciliación por cobro:** una referencia o llave única por periodo que identifique el pago sin intervención manual.
3. **Webhooks firmados** y API de consulta de estado.
4. **Sandbox completo** con estados controlables.
5. **Precio por transacción Bre-B** y costo fijo mensual, cotizados por escrito.
6. **Respaldo regulatorio:** qué entidad vigilada está detrás de cada producto.

Precio público de referencia: Payments Way cobra 3 % + $800 + IVA en tarjeta y PSE ([tarifas](https://www.paymentsway.co/soluciones/pasarela-de-pago#tarifas)); Wompi anunció 1 % + IVA en pagos con QR ([Cambio](https://cambiocolombia.com/peso-a-peso-paso-a-paso/articulo/2026/9/wompi-amplia-los-pagos-sin-contacto-y-baja-al-uno-por-ciento-la-tarifa-de-los-pagos-con-qr)). Bre-B por llave dinámica hay que cotizarlo.

### Ahorro para vivienda

Tampoco se elige todavía el proveedor de ahorro: el MVP simula una entidad genérica con cuatro tipos de producto (ahorro voluntario del FNA, ahorro programado, cuenta AFC y bolsillo de bajo monto), cada uno con sus reglas de tope, retiro y beneficio como configuración. La comparación de productos y los criterios de selección están en "Dónde vive el ahorro".

La interfaz `SavingsProvider` de `packages/integrations` tiene cinco operaciones: abrir o vincular el producto del usuario, reservar la referencia de un aporte, consultar un aporte, consultar saldo y movimientos, y recibir avisos. Vale la misma regla que en pagos: un aviso de la entidad solo dispara una consulta.

### Verificación de identidad (KYC)

| Proveedor | Fortaleza | Precio | Uso propuesto |
| --- | --- | --- | --- |
| [Truora](https://www.truora.com/truchecks?hsLang=en) | Colombiana, consulta bases oficiales y listas, validación por WhatsApp | A cotizar | Candidato principal para producción |
| [Didit](https://didit.me/es/blog/comparison-didit-vs-truora-the-top-kyc-alternatives-es/) | API pública, webhooks con HMAC, 500 verificaciones gratis al mes según el proveedor | US$0,30 por verificación (dato del propio proveedor) | Sandbox de desarrollo real en fase 4 |
| KYC de Payments Way | Incluido en su billetera (biometría y listas restrictivas) | Con la billetera | Solo si se usa su billetera en la fase BaaS |

Las comparaciones de Didit vienen de su propio sitio; hay que validarlas con una prueba antes de decidir.

### Resto de la infraestructura

| Necesidad | MVP | Producción | Alternativa |
| --- | --- | --- | --- |
| Base de datos | Postgres en Docker local; Neon o Supabase (solo base) en staging | AWS RDS Postgres o Neon con plan pago | Supabase Postgres |
| Cola y caché | Redis en Docker; Upstash en staging | Redis gestionado (ElastiCache o Upstash) | — |
| Autenticación | Better Auth (TypeScript, adaptador Prisma, 2FA, Google) dentro de NestJS | Igual | Implementación propia con argon2 + JWT (`jose`) |
| Hosting API y worker | Railway o Render | AWS ECS Fargate | Fly.io |
| Hosting web | Vercel | Vercel | AWS Amplify |
| Archivos (PDF, comprobantes) | MinIO local | Cloudflare R2 o AWS S3 con URLs firmadas | — |
| Correo | Mailpit local (bandeja falsa) | Resend o AWS SES | Postmark |
| WhatsApp | Simulador | Meta WhatsApp Cloud API directa o un BSP | Twilio |
| Push | Web Push con VAPID | Igual | OneSignal |
| Errores | Sentry | Sentry | — |
| Logs, trazas, métricas | pino + OpenTelemetry a consola | OpenTelemetry a Grafana Cloud o Better Stack | Datadog |
| Secretos | `.env` local cifrado | Doppler o AWS Secrets Manager | Infisical |
| PDF | `@react-pdf/renderer` en el worker | Igual | Playwright HTML a PDF |
| Firma de certificados | Ed25519 con `node:crypto`, llave en archivo | Llave en AWS KMS | — |

Los precios de esta tabla no se verificaron; se cotizan antes de la fase 4. Dónde se alojan los datos (Colombia o exterior) es una decisión para el abogado por las reglas de transferencia internacional de datos personales.

## Capa de simulación

El simulador es una aplicación aparte (`apps/provider-sim`) con su propia base de datos que imita a los proveedores reales byte a byte; la plataforma no sabe si habla con él o con el proveedor de verdad.

### Qué simula

| Proveedor simulado | Comportamiento | Formas que imita |
| --- | --- | --- |
| Payments Way · llave dinámica | Reserva llave por monto, expira, acepta solo el monto exacto, notifica | `transaction_id`, `key.value`, `expires_at`, webhook con `idstatus.id` (34 exitosa, 36 fallida…), JWT de 1 hora |
| Payments Way · consulta | Devuelve el estado real de la transacción en el simulador | "Obtener transacción" |
| Resolución de llaves Bre-B | Devuelve titular enmascarado o error de llave inexistente | Formas de la API de Wompi para dejar abierta esa opción |
| KYC | Aprueba, rechaza o pide revisión según el número de documento de prueba | Genérico, mapeado por el adaptador |
| Entidad de ahorro | Abre el producto del usuario, reserva la referencia de un aporte, acepta solo el monto exacto, lleva el saldo, abona rendimientos al avanzar el reloj, registra retiros y aplica el tope del producto | Genérico, mapeado por el adaptador, hasta elegir proveedor real |
| Notificaciones | Guarda cada mensaje en una bandeja visible en el panel | WhatsApp, correo y push |

### Panel de escenarios

Una página interna (`/sim`) con botones que disparan cada caso sobre un cobro o un aporte elegido. Diez escenarios de cobro:

- [ ] Pago exitoso por el monto exacto
- [ ] Pago por monto distinto (rechazado)
- [ ] Llave expirada antes del pago
- [ ] Webhook duplicado (mismo aviso dos o tres veces)
- [ ] Webhooks fuera de orden (pendiente llega después de exitosa)
- [ ] Webhook que nunca llega (la tarea `poll-pending` debe encontrarlo)
- [ ] Webhook falso con un estado que la consulta contradice
- [ ] Proveedor caído (respuestas 503 y tiempos de espera)
- [ ] Reembolso después de un pago confirmado
- [ ] Pago tardío después del vencimiento

Ocho escenarios de ahorro:

- [ ] Aporte confirmado por el monto exacto
- [ ] Aporte por monto distinto (rechazado)
- [ ] Aviso de aporte duplicado
- [ ] Aviso que nunca llega (la tarea `poll-pending-contributions` debe encontrarlo)
- [ ] Retiro hecho por el usuario directamente en la entidad (lo detecta la conciliación)
- [ ] Rendimiento abonado por la entidad al cierre del mes
- [ ] Tope del producto alcanzado (el aporte falla y se explica por qué)
- [ ] Saldo de la entidad distinto del ledger (se abre una incidencia)

Un escenario solo se da por cumplido cuando tiene una prueba automática que lo reproduce.

### Reloj controlable

- `ClockService` es la única fuente de hora en `api` y `worker`. En simulación lee un valor guardado en Redis.
- El panel permite avanzar 1 día, 1 semana o 1 mes; al avanzar, el worker ejecuta las tareas programadas que hubieran corrido en ese lapso, en orden.
- Con esto se recorre un año de contratos en minutos y se prueba el reajuste anual por IPC, los atrasos y la evolución del score.
- También se recorre una meta de varios años: al cruzar el 1 de enero entran en vigencia los parámetros del año siguiente y la ruta se recalcula.

### Datos sintéticos

Un comando `pnpm seed:scenario <nombre>` crea personajes con historias predefinidas:

| Escenario | Personajes | Qué prueba |
| --- | --- | --- |
| `puntual` | Inquilina que paga siempre el día 3 | Score ascendente y certificado |
| `atrasos` | Inquilino que paga tarde 1 de cada 3 meses | Penalización y recuperación del score |
| `impago` | Inquilino que deja de pagar en el mes 4 | Estados vencidos y alertas al dueño |
| `multi-contrato` | Dueño con 3 inmuebles | Panel del dueño y conciliación |
| `reajuste` | Contrato que cumple un año | Reajuste por IPC con tope legal |
| `meta-casa` | Inquilina que paga en fecha y aporta cada mes durante 36 meses | Ruta, hitos, bonos, cambio de parámetros de año y carpeta de vivienda |
| `ahorro-irregular` | Inquilino que aporta un mes sí y dos no, y hace un retiro | Constancia en el score, retiro detectado y recálculo de la ruta |
| `autodeclarado` | Inquilino con contrato sin dueño registrado que luego el dueño confirma | Niveles de verificación y su peso en el score |

Ninguna base de prueba contiene datos personales reales: cédulas y teléfonos se generan con prefijos reservados para pruebas.

### Interruptor hacia producción

Cada proveedor se elige con su propia variable de entorno (`PAYMENTS_PROVIDER=mock|paymentsway|wompi`, `KYC_PROVIDER=mock|truora|didit`, `SAVINGS_PROVIDER=mock|<proveedor>`, etc.). El arranque del `api` falla si en producción alguna variable sigue en `mock`, y el módulo del simulador ni siquiera se carga en ese ambiente.

## Autenticación: Better Auth con Google

La decisión es Better Auth dentro de NestJS, con correo y contraseña, ingreso con Google y segundo factor. Da el mismo control que una auth propia (corre en nuestro proceso y guarda todo en nuestra base) sin escribir desde cero la parte criptográfica, que es donde una implementación casera suele fallar.

### Comparación

| Criterio | Better Auth (elegida) | Supabase Auth | Implementación propia |
| --- | --- | --- | --- |
| Dónde viven usuarios y sesiones | Tablas propias en nuestro Postgres, vía adaptador de Prisma | Esquema `auth` gestionado por Supabase | Tablas propias |
| Google y otros proveedores | Configuración (`socialProviders`) | Configuración en el panel | Implementar OAuth/OIDC a mano |
| Segundo factor | Plugin (TOTP, OTP, códigos de respaldo) | TOTP incluido; MFA avanzada como complemento pago | Construirlo |
| Auditoría | Hooks de endpoint y de base de datos escriben en nuestro `audit_log`, en la misma transacción | Tiene registro de auditoría propio; formato y retención los define Supabase | Total |
| Escalabilidad | Escala con nuestra API; sesiones en Postgres y caché en Redis; sin límite por usuarios | Probada a gran escala; 50.000 usuarios activos al mes gratis y luego pago por usuario activo | Depende de nosotros |
| Costo | Libre (código abierto); solo nuestra infraestructura | Por usuarios activos mensuales | Semanas de desarrollo y revisión de seguridad |
| Dependencia de proveedor | Baja | Media-alta: usuarios y tokens viven en Supabase | Ninguna |

**¿Supabase Auth es suficientemente escalable?** Sí: técnicamente aguanta este proyecto de sobra, y un análisis independiente lo ubica en unos US$100 al mes con 100.000 usuarios activos ([fuente](https://guptadeepak.com/ciam-compass/vendors/supabase-auth/)). No se elige por otras razones: los usuarios quedan fuera de nuestro esquema, la auditoría queda partida en dos sistemas y migrar después implica mover usuarios y tokens. Supabase sigue siendo válido como proveedor de Postgres gestionado, sin usar su Auth.

**¿Cuándo sí haría falta una implementación propia?** Solo si un requisito regulatorio o de un banco aliado no se puede cumplir con Better Auth. Como Better Auth guarda todo en nuestras tablas, ese cambio sería posible sin migrar usuarios.

### Diseño

- Better Auth se monta en NestJS bajo `/v1/auth/*`. Su configuración se divide en dos archivos: uno mínimo para generar el esquema de Prisma y otro con inyección de dependencias para correo y auditoría.
- Better Auth resuelve identidad y sesión; los roles y permisos (inquilino, dueño, operaciones, por contrato) siguen en nuestro módulo `users` y en guards de NestJS.
- Sesiones en Postgres con cookie `httpOnly` en el dominio raíz; Redis como almacenamiento secundario para sesiones y límite de peticiones.
- La web usa el cliente de Better Auth para React (botón de Google, sesión, 2FA). Para una futura app nativa se agrega el plugin de tokens Bearer.

### Ingreso con Google: reglas

- Google solo prueba que la persona controla ese correo, no su identidad: la verificación de identidad (KYC) sigue siendo obligatoria antes de crear contratos y antes del primer aporte. El simulador de ruta es lo único que funciona sin cuenta.
- Solo se piden los alcances `openid`, `email` y `profile`.
- Una cuenta de Google se vincula a una cuenta existente solo si el correo está verificado por ambos lados.
- Aunque se entre con Google, el segundo factor sigue siendo obligatorio para acciones sensibles (cambiar la llave del dueño, emitir certificados, backoffice).

### Auditoría de autenticación

Cada uno de estos eventos queda en `audit_log` con usuario, IP, agente de navegador y resultado: registro, inicio de sesión exitoso y fallido, ingreso con Google, vinculación de cuentas, cierre de sesión, activación y uso del segundo factor, cambio y recuperación de contraseña, y revocación de sesiones. Se implementa con los hooks `before` y `after` de los endpoints y los hooks de base de datos de Better Auth ([guía](https://supercode.sh/en/skills/better-auth/skills/better-auth-best-practices)), y cada evento tiene su prueba.

## Seguridad, datos y observabilidad

La seguridad se construye desde la fase 1, no al final: los controles de esta sección son criterios de aceptación de cada módulo.

### Autenticación y acceso

- Ingreso con correo y contraseña o con Google mediante Better Auth; sesiones guardadas en Postgres y enviadas en cookie `httpOnly`, `Secure`, `SameSite=Lax`.
- Segundo factor (OTP) obligatorio para cambiar la llave o cuenta del dueño, vincular o cambiar el producto de ahorro, emitir certificados y todo el `backoffice`.
- Autorización por rol y por recurso: un inquilino solo ve sus contratos; un dueño, los de sus inmuebles. Se prueba con casos específicos de acceso indebido.
- Límite de peticiones por IP y por usuario en login, OTP y endpoints públicos (verificación de certificados).

### Protección de datos personales

- Cifrado de columnas sensibles (documento, teléfono, datos de la llave del dueño, ingreso y datos del hogar, identificador del producto de ahorro) con cifrado de sobre: llave de datos por registro, llave maestra en KMS en producción.
- Compartir la carpeta de vivienda con un tercero (banco, FNA, caja, constructora) exige una autorización específica para ese destinatario, distinta de la autorización general.
- Minimización: solo se guarda lo que un caso de uso necesita; los comprobantes y selfies de KYC quedan en el proveedor cuando sea posible.
- Registro de autorizaciones (`consents`) con versión del texto; revocar una autorización detiene el tratamiento correspondiente.
- Política de retención y borrado por tipo de dato, definida con el abogado.
- Logs sin datos personales: un filtro de pino enmascara documento, correo, teléfono y tokens.

### Integridad financiera

- Firma Ed25519 de recibos y certificados; la página pública verifica la firma y el estado (vigente, expirado, revocado).
- Webhooks: endpoint con HTTPS, lista de IP del proveedor si la publica, deduplicación y confirmación por consulta.
- Acciones manuales del `backoffice` sobre dinero o estados requieren doble aprobación (cuatro ojos) y quedan en auditoría.
- Conciliación diaria automática entre transacciones del proveedor y ledger, y entre el saldo de cada producto de ahorro y el ledger; cualquier diferencia abre una incidencia.
- Fraude de historial en contratos autodeclarados (pagarse a sí mismo para subir el score): el titular de la llave del dueño no puede coincidir con el inquilino, el certificado muestra el nivel de verificación y el score lo pondera.
- Publicar parámetros regulatorios o reglas de bonos exige doble aprobación y queda en auditoría.

### Seguridad de la cadena de suministro

- Dependencias fijadas con `pnpm-lock.yaml`, instalación con `--frozen-lockfile` en CI.
- Renovate para actualizaciones, con espera mínima de algunos días antes de adoptar versiones nuevas.
- Escaneo de dependencias y secretos en cada PR (por ejemplo, `osv-scanner` y `gitleaks`).

### Observabilidad

| Señal | Herramienta | Qué se mide |
| --- | --- | --- |
| Errores | Sentry | Excepciones en `api`, `worker` y `web` con `request_id` |
| Trazas | OpenTelemetry | Petición HTTP → caso de uso → base de datos → proveedor |
| Métricas de negocio | OpenTelemetry + panel | Cobros creados, pagados, vencidos; tiempo de confirmación; webhooks duplicados; diferencias de conciliación; metas creadas, aportes confirmados, constancia mensual, retiros y brecha cubierta |
| Logs | pino en JSON | Con `request_id` y `correlation_id` del cobro |
| Alertas | Sobre las métricas | Diferencia en conciliación, cola con tareas fallidas, tasa de error del proveedor |

### Marco legal a validar con el abogado

Ley 1581 de 2012 (datos personales), Ley 1266 de 2008 (datos de comportamiento de pago, si el score se comparte con terceros), Ley 820 de 2003 (nada que funcione como depósito en garantía) y el contrato con el proveedor de pagos. Para el ahorro se suman: captación masiva y habitual (artículo 316 del Código Penal y Decreto 1068 de 2015), para confirmar que orquestar aportes hacia un producto del usuario no la configura; publicidad y promesas (Estatuto del Consumidor, Ley 1480 de 2011); si mostrar o comparar productos de ahorro e inversión cuenta como asesoría o como distribución; la figura para cobrar comisiones por referir créditos o seguros; el tratamiento tributario de los bonos; y el contrato con la entidad de ahorro. Ningún usuario real entra al sistema antes de esa validación.

## Frontend Next.js: FSD, PWA y mobile-first

Una sola app Next.js (App Router) sirve móvil y escritorio, se instala como PWA y organiza el código con Feature-Sliced Design; arranca cuando el backend cierra la fase 3.

### Estructura FSD adaptada a App Router

La carpeta `app/` de Next.js solo define rutas y layouts; toda la lógica vive en las capas de FSD dentro de `src/`. La capa `pages` de FSD se llama `views` para no chocar con el Pages Router.

```
apps/web/
├─ app/                      rutas: (tenant)/, (owner)/, verify/[code], admin/, sim/
└─ src/
   ├─ core/                  capa "app" de FSD: providers, estilos globales, config
   ├─ views/                 pantallas completas (TenantHome, HomeGoal, LeaseDetail, OwnerCharges)
   ├─ widgets/               bloques grandes (HomeGoalProgress, RouteToHome, ChargeTimeline, ScoreCard, PayWithBreB)
   ├─ features/              acciones del usuario (simulate-route, create-home-goal, make-contribution, register-lease, pay-charge, share-certificate)
   ├─ entities/              modelos de negocio en UI (home-goal, contribution, lease, charge, receipt, score)
   └─ shared/                api-client, ui (de packages/ui), lib, config
```

Regla de FSD: cada capa solo importa de las de abajo (`views` → `widgets` → `features` → `entities` → `shared`). Se hace cumplir con el linter `steiger` o `eslint-plugin-boundaries`.

### Pantallas del MVP

| Área | Pantallas |
| --- | --- |
| Inquilino · Meta Casa | Simulador de ruta, crear la meta, vincular el producto de ahorro, plan y día de aporte, inicio con avance de la meta y próximo cobro, pagar canon y aporte en un solo flujo, aporte extra, movimientos (aportes, retiros, rendimientos, bonos), hitos, carpeta de vivienda y compartir |
| Inquilino · arriendo | Registro y autorización de datos, verificación de identidad, registro del contrato (autodeclarado o con invitación al dueño), pagar con llave o QR, historial y recibos, score explicado, certificado y compartir |
| Dueño | Aceptar invitación o confirmar un contrato autodeclarado, inmuebles, llave o cuenta de destino con verificación, cobros por contrato, estado de pagos |
| Público | Simulador de ruta sin cuenta (puerta de entrada al registro); verificar certificado o carpeta por código o QR |
| Operaciones | Búsqueda de usuarios y cobros, incidencias de conciliación |
| Simulación | Panel de escenarios, reloj y bandeja de mensajes (solo fuera de producción) |

### Datos, estado y formularios

- Estado del servidor con TanStack Query; cliente tipado generado desde OpenAPI (`openapi-typescript` + `openapi-fetch`, u `orval` si se quieren hooks generados).
- Estado de interfaz mínimo con Zustand (por ejemplo, el paso actual de un flujo); nada de datos de negocio duplicados en el cliente.
- Formularios con react-hook-form y los mismos esquemas zod de `packages/contracts`.
- La sesión vive en cookies `httpOnly` emitidas por la API; nunca tokens en `localStorage`. API y web bajo el mismo dominio raíz (`api.` y `app.`) para que las cookies funcionen.
- Server Components para lecturas iniciales y SEO de la página pública; Client Components solo donde hay interacción.

### PWA

- Service worker con Serwist (sucesor de `next-pwa` para App Router) y manifiesto en `app/manifest.ts`.
- Caché del cascarón de la app y de las últimas lecturas (recibos, score) para consultarlas sin conexión; los pagos y cambios nunca se encolan sin conexión.
- Notificaciones Web Push (VAPID) para recordatorios de pago; en iOS solo funcionan con la app instalada en la pantalla de inicio.
- Pantalla propia de "instalar app" con instrucciones para iOS y Android.

### Mobile-first y escritorio

- Diseño desde 360 px de ancho; navegación inferior en móvil y barra lateral desde `lg` en escritorio.
- Acciones principales al alcance del pulgar; montos en grande con formato `Intl.NumberFormat('es-CO', { currency: 'COP' })`.
- Design system en `packages/ui` con Radix UI y Tailwind, documentado en Storybook; accesibilidad AA (contraste, foco, lectores de pantalla).
- Encabezados de seguridad: CSP estricta, `frame-ancestors 'none'` y sin scripts de terceros en pantallas de pago.

## Pruebas, CI/CD y ambientes

Ningún cambio llega a `main` sin pasar pruebas de dominio, integración con Postgres real y los escenarios del simulador.

### Pirámide de pruebas

| Nivel | Qué cubre | Herramienta | Meta |
| --- | --- | --- | --- |
| Unitarias | `packages/domain`: Money, máquinas de estado (cobro y aporte), ruta a la vivienda, score, bonos, reajuste por IPC, reglas del ledger | Vitest | Cobertura de ramas ≥ 90 % en `domain` |
| Basadas en propiedades | Que todo asiento sume cero y que ninguna secuencia de eventos deje un estado inválido. En la ruta: la brecha nunca es negativa, más ingreso o más ahorro nunca la aumentan, y el crédito estimado nunca supera ninguno de sus tres límites | `fast-check` | Casos aleatorios en cada corrida |
| Integración | Casos de uso con Postgres y Redis reales | Vitest + Testcontainers | Cada módulo con su suite |
| Contrato | Que el simulador y el adaptador real respeten las mismas formas | Esquemas zod + colección Postman del proveedor | Se corre al actualizar el adaptador |
| Escenarios | Los 18 casos del panel de simulación (10 de cobro y 8 de ahorro), automatizados | Vitest contra `provider-sim` | Todos en verde |
| Extremo a extremo | Simulador → registro → contrato → meta → cobro y aporte → recibo → certificado y carpeta, en móvil y escritorio | Playwright | Flujos críticos (fase frontend) |
| Carga | Generación de cobros y aportes, ráfagas de webhooks | k6 | Antes de producción |

### Política de pruebas por módulo, archivo y componente

Regla de "terminado": ningún módulo, archivo con lógica o componente se fusiona sin sus pruebas, y CI bloquea el PR si la cobertura del paquete baja del umbral.

| Qué se escribe | Pruebas obligatorias | Herramienta | Umbral |
| --- | --- | --- | --- |
| Entidad, valor o regla en `packages/domain` | Unitarias de cada regla y propiedades invariantes (asientos que suman cero, transiciones válidas) | Vitest + fast-check | 90 % de ramas |
| Caso de uso de NestJS (`application/`) | Unitarias con puertos simulados en memoria + integración con Postgres real | Vitest + Testcontainers | 85 % de líneas por módulo |
| Controlador y DTO | Por endpoint: un caso feliz, uno de validación, uno de acceso indebido | Vitest + Supertest sobre la app NestJS | Todos los endpoints |
| Repositorio con Prisma | Integración con migraciones aplicadas | Testcontainers | Cada consulta propia |
| Adaptador de proveedor | Contrato contra el simulador y contra ejemplos reales del proveedor (incluido el campo `ammount`) | Vitest + esquemas zod | Cada operación del adaptador |
| Tarea del worker | Integración con Redis y reloj controlado; ejecutar dos veces y verificar idempotencia | Vitest + Testcontainers | Cada tarea |
| Cálculo con parámetros regulatorios (ruta, subsidio, bonos) | Casos tabulados con los parámetros de dos años distintos y un caso por cada límite que recorta el crédito | Vitest + fast-check | Cada regla y cada límite |
| Hooks de autenticación | Un caso por evento auditado | Vitest + Supertest | Todos los eventos |
| Migración de base de datos | Aplicar desde base vacía y correr seeds | CI | Cada migración |
| Componente de `packages/ui` | Historia en Storybook con prueba de interacción y accesibilidad (axe) | Storybook + Vitest + Testing Library | Cada componente |
| Feature o widget de la web | Comportamiento con la API simulada | Vitest + Testing Library + MSW | 80 % de líneas |
| Hook o utilidad del frontend | Unitarias | Vitest | 90 % de ramas |
| Flujo crítico de usuario | Extremo a extremo en vista móvil y escritorio | Playwright | Flujos de la sección de frontend |

No requieren prueba propia: archivos solo de configuración, tipos, re-exportaciones y módulos de NestJS que solo declaran dependencias.

**Convenciones**

- Un solo ejecutor en todo el monorepo: Vitest. En NestJS se usa con el plugin SWC (`unplugin-swc`) para que funcionen los decoradores.
- Pruebas unitarias junto al archivo (`charge.entity.spec.ts`); integración en `test/integration/*.int-spec.ts`; extremo a extremo en `test/e2e/`.
- Fábricas de datos y escenarios compartidos en `packages/testing`.
- Cada prueba es independiente: la base se limpia o se revierte por transacción; ninguna prueba llama a internet.
- Turborepo ejecuta solo las pruebas de los paquetes afectados en cada PR; la suite completa corre cada noche, con pruebas de mutación (Stryker) sobre `packages/domain`.
- La plantilla de PR incluye la casilla "pruebas agregadas o actualizadas" y el revisor la verifica.

### CI/CD

- GitHub Actions con Turborepo: solo se construye y prueba lo que cambió, con caché remota.
- En cada PR: lint, chequeo de tipos, reglas de dependencia, pruebas, escaneo de secretos y dependencias, migraciones aplicadas a una base vacía.
- Migraciones de base de datos revisadas a mano; nunca destructivas sin un plan de dos pasos (agregar, migrar datos, retirar).
- Despliegue automático a `staging` al fusionar en `main`; a producción con aprobación manual.

### Ambientes

| Ambiente | Proveedores | Datos | Uso |
| --- | --- | --- | --- |
| `local` | Simulador | Sintéticos | Desarrollo diario con Docker Compose |
| `staging` | Simulador | Sintéticos | Demos a aliados, inversionistas y abogado; pruebas extremo a extremo |
| `sandbox` | Sandbox real del proveedor elegido | Sintéticos | Validar el adaptador real (fase 4) |
| `production` | Reales | Reales | Solo después de la validación legal |

Cada ambiente tiene su base de datos, sus secretos y sus llaves de firma; nada se comparte entre ellos.

## Fases y cronograma

Siete compuertas en unas 29 semanas con dos personas a tiempo completo (con dedicación parcial, multiplicar por 2): el backend completo y probado en la semana 17, la PWA en la 25 y la preparación para producción en la 29. Cada fase termina en una compuerta con criterios verificables; no se pasa a la siguiente sin cumplirlos.

El ahorro para vivienda agrega unas 5 semanas al plan v1 (24 semanas): una fase nueva, la 2B, y una semana más de frontend. Las fases 3, 4 y 5 conservan su número y su contenido; solo se corren sus semanas. La 2B va después de los cobros porque reutiliza su maquinaria (avisos, consulta al proveedor, conciliación, tareas del worker) y antes de los documentos porque el score y la carpeta dependen de los aportes.

**Roles**

- **Persona A, plataforma e integraciones:** monorepo, CI/CD, infraestructura, auth, simulador, adaptadores de proveedores, observabilidad y seguridad.
- **Persona B, dominio y negocio:** `packages/domain`, contratos, cobros, ledger, ruta a la vivienda, metas y aportes, score, recibos y certificados. En la fase 4 lidera el frontend.

| Fase | Semanas | Persona A | Persona B | Criterio de salida |
| --- | --- | --- | --- | --- |
| 0. Fundaciones | 1–2 | Monorepo, Turborepo, CI, Docker Compose, NestJS base, Prisma, imágenes Docker, logger, Sentry | Reglas de dependencia, `ClockService`, `outbox`, `idempotency`, `audit`, primer modelo de datos | `pnpm dev` levanta todo; pipeline en verde; una migración aplicada |
| 1. Núcleo de dominio | 3–6 | `auth` con Better Auth, Google y 2FA, `users`, `consents`, límite de peticiones, cifrado de columnas | `domain` (Money, máquina de estados, reglas del ledger, reajuste IPC), `properties`, `leases` (autodeclarado y confirmado por el dueño), `payout-destinations`, `ledger` | Contratos de los dos niveles creados por API con pruebas; pruebas de propiedades del ledger en verde |
| 2A. Cobros y simulador | 7–10 | `provider-sim` (llave dinámica, webhooks, consulta, KYC, notificaciones), panel de escenarios, adaptadores mock | `charges`, `provider-events`, tareas del worker, conciliación diaria, `identity` | Los 10 escenarios de cobro automatizados en verde; un año simulado sin diferencias de conciliación |
| 2B. Ahorro para vivienda | 11–14 | Entidad de ahorro en `provider-sim` (producto, aportes, saldo, rendimientos, retiros, tope), `SavingsProvider` con su adaptador mock, escenarios de ahorro en el panel | `housing-parameters`, ruta a la vivienda y máquina de estados del aporte en `domain`, `home-goals`, `savings` con conciliación, `rewards` (devengo) | Los 8 escenarios de ahorro en verde; una meta de 36 meses simulada sin diferencias entre el saldo de la entidad y el ledger; la ruta se recalcula al cambiar los parámetros de año |
| 3. Documentos y operaciones | 15–17 | `notifications`, `backoffice` con doble aprobación, OpenAPI final y `api-client`, despliegue a `staging` | `receipts` (PDF y hash), `certificates` (buena paga y carpeta de vivienda, firma y verificación), `score` explicable v1 con cinco factores | API v1 congelada y documentada; staging operando con datos sintéticos |
| 4. Frontend PWA | 18–25 | Evaluación de proveedores de pago, KYC y ahorro, adaptador real en sandbox, pruebas de carga | `packages/ui`, PWA, simulador público, Meta Casa, flujos de inquilino, dueño, página pública y panel de simulación | Flujos extremo a extremo en verde en móvil y escritorio; demo completa en staging |
| 5. Preparación para producción | 26–29 | Endurecimiento, revisión de seguridad externa, alertas, plan de respaldo y recuperación | Textos legales en la app, flujos de consentimiento finales, parámetros regulatorios verificados contra la norma, piloto cerrado en sandbox | Validación legal firmada; proveedores contratados (o Meta Casa en modo seguimiento decidido); lista de verificación de la última sección completa |

&#91;embedded content: hoja de ruta · fases y sus compuertas (bandas iguales, no a escala). El diagrama es de la v1 y no muestra la fase 2B\]

Cada rombo es una compuerta: la fase siguiente no empieza hasta cumplir el criterio escrito debajo de la fase.

La fase 4 es el primer punto donde ambos trabajan en paralelo en frentes distintos: el backend ya está congelado y la Persona A cambia el foco a proveedores reales.

## Escalamiento después del MVP

Cada etapa de escala se activa por una métrica o un acuerdo comercial, no por calendario; la arquitectura ya deja el lugar listo para cada una.

| Etapa | Se activa cuando | Qué se agrega | Dónde encaja |
| --- | --- | --- | --- |
| Producción con dinero real | Validación legal y proveedores contratados | Adaptador real de pagos, KYC y ahorro, pago real de los bonos, monitoreo 24/7, soporte | Variables de entorno de proveedores |
| Camino al crédito | Primeros usuarios con la brecha cubierta | Módulo `mortgage-referrals`: envío de la carpeta de vivienda, con autorización del usuario, a un banco, al FNA, a una constructora o a un aliado de arriendo con opción de compra; seguimiento de la solicitud y comisión | Nuevo módulo y cuentas `platform:fees` en el ledger |
| Fianza sin codeudor | Acuerdo con una afianzadora o aseguradora | Módulo `guarantees`: cotización con el score, solicitud, comisión; seguro de impago para el dueño | Nuevo módulo y cuentas `platform:fees` en el ledger |
| Cuenta y apartado del arriendo (BaaS) | Contrato con banco o billetera vigilada | `WalletProvider`, cuentas `wallet:{id}`, apartado automático del canon al entrar el sueldo y pago programado desde la cuenta | Interfaces de `integrations` y ledger existente |
| Vitrina de inmuebles y leads verificados | Dueños activos que pidan publicar | Publicación de inmuebles y perfil verificado del interesado | Nuevos módulos; es otro negocio y se evalúa aparte |
| Panel para inmobiliarias | 20+ dueños profesionales activos | Organizaciones, agentes, permisos por cartera, carga masiva | Módulos `organizations` y `memberships` |
| Open finance | Acceso a datos bajo el Decreto 0368 de 2026, que hizo obligatorias las finanzas abiertas ([Superfinanciera](https://www.superfinanciera.gov.co/publicaciones/10116081/finanzas-abiertas-obligatorias-impulsaran-el-desarrollo-del-sistema-y-la-inclusion-financiera-en-el-pais/)); falta confirmar si una empresa no vigilada puede recibir datos | Lectura, con consentimiento, de ingresos, pagos y saldos de ahorro en otras entidades, para verificar lo que hoy el usuario declara | Nuevo `FinancialDataProvider` |
| Reporte a centrales de riesgo | Convenio con una central y validación legal | Reporte positivo del pago del arriendo, con autorización del usuario | Nuevo adaptador; obligaciones de fuente de información de la Ley 1266 |
| Score con modelos estadísticos | Unos 12 meses de historial real | Servicio Python (FastAPI) aparte, con su propio despliegue; el backend lo consulta por HTTP o colas | Microservicio fuera del monorepo TS o en `services/` |
| App nativa | La PWA limita (por ejemplo, push en iOS o biometría) | Expo con React Native, reutilizando `contracts`, `api-client` y `domain` | Nueva app en `apps/mobile` |

**Escala técnica:**

- **Base de datos:** índices por `lease_id` y `status`; particionar `ledger_entries`, `audit_log` y `provider_events` por mes cuando superen decenas de millones de filas; réplica de lectura para reportes.
- **Worker:** varias instancias consumiendo la misma cola; las tareas ya son idempotentes, así que escalar es agregar réplicas.
- **Separación de servicios:** el monolito modular se mantiene hasta que un módulo tenga carga o equipo propio. Los candidatos naturales a separarse primero son `provider-events` (recepción de webhooks) y `notifications`.
- **Eventos:** si la cola de Redis se queda corta, el `outbox` permite cambiar a un bus de eventos (por ejemplo, SQS o Kafka) sin tocar los módulos.

## Riesgos, decisiones pendientes y lista de verificación

El mayor riesgo no es técnico: es que el modelo de fondos de un proveedor, de pagos o de ahorro, obligue a la plataforma a recibir dinero de terceros. Por eso esa pregunta va primero en las dos listas.

### Riesgos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| El proveedor solo ofrece modelo agregador (fondos pasan por la plataforma) | Implicaciones legales y tributarias de recaudar para terceros | Exigir subcomercio o llave propia del dueño; si no, cambiar de proveedor |
| La API real difiere del simulador | Retrasos en la fase 4 | Pedir la colección Postman y el sandbox en la fase 2A; pruebas de contrato |
| Webhooks sin firma | Pagos falsos marcados como recibidos | Confirmación por consulta siempre; lista de IP si existe |
| El score se considera dato financiero regulado | Obligaciones de la Ley 1266 | Certificado compartido por el propio usuario; validación con el abogado |
| Dos personas para un producto fintech | Cuello de botella y riesgo de persona única | Documentación de decisiones (ADR), revisión cruzada de código, alcance cerrado |
| Costos de proveedores no cotizados | Modelo de negocio sin margen | Cotizaciones por escrito antes de la fase 4 |
| El flujo de aportes se interpreta como captación | Riesgo penal y cierre del producto | Los aportes nunca pasan por la plataforma; concepto del abogado antes de la fase 4 |
| Ninguna entidad de ahorro ofrece integración por API o no le interesa el segmento | Meta Casa sin aportes verificados en producción | Contactar al FNA, a un banco y a un aliado BaaS durante la fase 2B; modo seguimiento como salida |
| Parámetros regulatorios desactualizados o mal tomados (hoy vienen de prensa) | El simulador da cifras falsas y genera reclamos | Tabla con fuente y verificador; verificación contra la norma en la fase 5; aviso de estimación en toda pantalla |
| Subsidios y reglas cambian (Mi Casa Ya cerrado, reforma al tope de las AFC, crédito del FNA al 100 %) | La ruta promete más de lo que el usuario puede obtener | Parámetros con vigencia; el subsidio siempre como estimación sujeta a asignación |
| La promesa comercial ("tu casa propia") supera lo que el producto garantiza | Reclamos de consumidor y pérdida de confianza | Regla de estimaciones sin promesas; textos revisados por el abogado |
| Historial inflado con contratos autodeclarados | El certificado pierde valor ante un banco | Nivel de verificación visible, titular de la llave distinto del inquilino, peso menor en el score |
| El alcance creció unas 5 semanas (de 24 a 29) | Más tiempo sin validar con usuarios | Simulador público como primera entrega de la fase 4; si hay que recortar, los bonos (`rewards`) salen del MVP primero |
| El modelo de ingresos no está validado | Producto gratis sin fuente de ingresos | Entrevistas con un banco, el FNA y una afianzadora antes de la fase 4 |

### Decisiones pendientes

- [ ] ORM: Prisma 7 — decidido
- [ ] Auth: Better Auth con Google y 2FA — decidido; probar los hooks de auditoría en la semana 1
- [ ] Hosting de staging: Railway o Render — semana 2
- [ ] Nombre del producto y dominio — antes de la fase 3
- [ ] Proveedor de pagos de producción con la matriz de criterios — fase 4
- [ ] Proveedor de KYC de producción — fase 4
- [ ] País de alojamiento de los datos — con el abogado
- [ ] Contrato autodeclarado en el MVP — propuesto que sí; confirmar antes de la fase 1
- [ ] Pesos de la fórmula v1 del score — propuesta en "Meta Casa: lógica de negocio"; calibrar en la fase 3
- [ ] Bonos con destino: si entran al MVP, con qué reglas y tope, y cómo se financian — antes de la fase 2B
- [ ] Producto y proveedor de ahorro de producción con la matriz de criterios — fase 4
- [ ] Meta Casa en modo seguimiento (aportes declarados) si no hay aliado de ahorro — fase 4
- [ ] Verificación de ingresos y de afiliación a caja (hoy declarados) — después del MVP
- [ ] Fuente de ingresos principal a validar primero — antes de la fase 4

### Preguntas para la entidad de ahorro (y para cada proveedor evaluado)

1. ¿El producto se abre a nombre del usuario y el aporte entra directo a él, sin pasar por una cuenta de la plataforma?
2. ¿El producto cuenta como ahorro previo ante las cajas de compensación o da acceso a un crédito de vivienda?
3. ¿Hay API para abrir el producto, generar una referencia por aporte y consultar saldo y movimientos? ¿Los avisos van firmados?
4. ¿Qué topes de saldo y de movimiento tiene, y cómo se pasa a un producto sin tope?
5. ¿La entidad certifica el saldo para trámites de subsidio y de crédito?
6. ¿Cuánto cuesta por usuario y por aporte, y paga alguna comisión por saldos o cuentas?
7. ¿Hay sandbox con estados controlables, y cuándo lo entregan?

### Preguntas para Payments Way (y para cada proveedor evaluado)

1. ¿El dinero de la llave dinámica puede llegar directo a la cuenta del dueño (subcomercio) en lugar de a la plataforma?
2. ¿Qué entidad vigilada respalda la billetera y las cuentas?
3. ¿Los webhooks se pueden firmar o tienen IP fijas?
4. ¿Hay sandbox completo de Bre-B con estados controlables, y cuándo lo entregan?
5. ¿Tarifa por transacción con llave dinámica y costo fijo mensual?
6. ¿El campo del monto en el webhook es `amount` o `ammount`?

### Lista de verificación antes de usuarios reales

- [ ] Validación legal firmada (términos, política de datos, autorizaciones, modelo de fondos, flujo de aportes, textos de la promesa comercial)
- [ ] Contrato con proveedor de pagos, de KYC y de ahorro (o Meta Casa en modo seguimiento)
- [ ] Parámetros regulatorios del año verificados contra la norma, con su fuente
- [ ] Ninguna pantalla presenta una estimación como oferta de crédito, subsidio asignado o rendimiento garantizado
- [ ] Ninguna variable de proveedor en `mock` en producción
- [ ] Llaves de firma y cifrado en KMS; secretos fuera del repositorio
- [ ] Revisión de seguridad externa sin hallazgos críticos abiertos
- [ ] Conciliación diaria y alertas probadas en sandbox
- [ ] Respaldo de base de datos con restauración probada
- [ ] Plan de atención de incidentes y canal de soporte al usuario
- [ ] Piloto cerrado completado con métricas revisadas

### Fuentes

- [Payments Way — documentación para desarrolladores](https://developer.paymentsway.co/)
- [Payments Way — llave dinámica](https://developer.paymentsway.co/docs/merchant/integracion-breb/llave-dinamica)
- [Payments Way — webhook](https://developer.paymentsway.co/docs/merchant/webhook/notificaciones)
- [Wompi — sandbox Bre-B](https://docs.wompi.co/en/docs/colombia/sandbox-breb/)
- [Wompi — guía de integración Bre-B](https://docs.wompi.co/en/docs/colombia/guia-integracion-breb/)
- [Kushki — pagos con Bre-B](https://docs.kushki.com/es/co/apm/bre-b-payments)
- [EBANX — Bre-B](https://docs.ebanx.com/docs/pay-in/processing/payment-methods/country-specific/colombia/breb)
- [Bold — ambiente de pruebas](https://developers.bold.co/api-integrations/integration-sandbox)
- [Cobre en APIs.io](https://apis.io/providers/cobre/)
- [Truora — TruChecks](https://www.truora.com/truchecks?hsLang=en)
- [Didit vs. Truora (fuente del proveedor)](https://didit.me/es/blog/comparison-didit-vs-truora-the-top-kyc-alternatives-es/)

* [Supabase — Auth](https://supabase.com/docs/guides/auth)
* [Supabase — Auth de terceros](https://supabase.com/docs/guides/auth/third-party/overview.md)
* [Supabase Auth: precios y capacidades (análisis independiente)](https://guptadeepak.com/ciam-compass/vendors/supabase-auth/)
* [Better Auth — guía de buenas prácticas](https://supercode.sh/en/skills/better-auth/skills/better-auth-best-practices)
* [Prisma 7 — cambios de arquitectura](https://www.prisma.io/blog/prisma-7-ama-clearing-up-the-why-behind-the-changes)
* [Prisma — controladores y adaptadores](https://www.prisma.io/docs/v6/orm/overview/databases/database-drivers)

Fuentes de la v2 (ahorro para vivienda). Casi todas son prensa o páginas comerciales, no la norma, y las cifras se tomaron de resúmenes de búsqueda: antes de usar una cifra hay que abrir su fuente y confirmarla.

- [Habify — sitio](https://www.habify.com.ar/)
- [DANE, Encuesta de Calidad de Vida 2025 (La República)](https://www.larepublica.co/economia/resultados-de-la-encuesta-calidad-de-vida-2025-del-dane-4375167)
- [Hogares en arriendo por departamento (Portafolio)](https://www.portafolio.co/mis-finanzas/vivienda/meta-risaralda-y-cundinamarca-superan-el-47-de-hogares-en-arriendo-colombia-tiene-116-685-inmuebles-en-rentas-495288)
- [Bancolombia — cómo tener vivienda propia (porcentajes de financiación)](https://blog.bancolombia.com/vida-cotidiana/como-tener-vivienda-propia-en-colombia-gcv/)
- [Decreto 0583 de 2025 — relación cuota/ingreso](https://www.minvivienda.gov.co/sites/default/files/normativa/0583_2025.pdf)
- [Subsidios de vivienda vigentes en 2026 (Portafolio)](https://www.portafolio.co/mis-finanzas/vivienda/subsidios-de-vivienda-vigentes-en-2026-cajas-de-compensacion-y-programas-locales-tras-mi-casa-ya-485814)
- [Montos del subsidio de las cajas en 2026 (Blu Radio)](https://www.bluradio.com/economia/subsidio-de-mas-de-100-millones-para-comprar-casa-los-montos-de-las-cajas-de-compensacion-en-2026-so35)
- [Requisitos del subsidio de vivienda nueva (Comfenalco Quindío)](https://comfenalcoquindio.com/wp-content/uploads/2026/02/requisitos-subsidio-vivienda-nueva.pdf)
- [Estado de Mi Casa Ya en 2026 (Colombia Move)](https://colombiamove.com/blog/subsidio-vivienda-mi-casa-ya-2026-colombia/)
- [FNA — cuánto ahorrar para la cuota inicial (Vanguardia)](https://www.vanguardia.com/colombia/2026/01/25/fna-2026-cuanto-ahorrar-para-la-cuota-inicial-de-su-vivienda/)
- [FNA — crédito del 100 % para primera vivienda VIS o VIP (El País)](https://www.elpais.com.co/economia/fna-anuncio-que-acaba-con-la-cuota-inicial-para-quienes-compren-la-primera-vivienda-vis-o-vip-0609.html)
- [Cuenta AFC (BBVA)](https://www.bbva.com.co/personas/blog/educacion-financiera/cuentas/que-es-una-cuenta-afc.html)
- [Aportes a cuentas AFC en la declaración de renta (Siempre al Día)](https://siemprealdia.co/colombia/impuestos/renta-exenta-aportes-a-cuentas-afc/)
- [Advertencia de la DIAN sobre retiros anticipados (Valora Analitik)](https://www.valoraanalitik.com/advertencia-de-la-dian-sobre-retiros-de-ahorros-de-pension/)
- [Topes de los depósitos de bajo monto en 2026 (Infobae)](https://www.infobae.com/colombia/2026/01/08/nequi-y-daviplata-tienen-nuevos-topes-y-reglas-en-2026-asi-cobran-ahora-por-el-impuesto-del-4x1000-en-las-transferencias/)
- [Captación ilegal de dinero (Portafolio)](https://www.portafolio.co/economia/finanzas/como-identificar-las-nuevas-tipologias-de-captacion-ilegal-de-dinero-607882)
- [Licencias para operar una fintech en Colombia (Latam Fintech)](https://www.latamfintech.co/articles/debo-tener-una-licencia-especial-en-colombia-para-operar-mi-negocio-en-fintech)
- [Depósitos en el arriendo y Ley 820 de 2003 (El Espectador)](https://www.elespectador.com/economia/pedir-un-deposito-para-arrendar-un-inmueble-en-colombia-es-legal/)
- [Seguro de arrendamiento: costos (Portafolio)](https://www.portafolio.co/economia/finanzas/seguro-de-arrendamiento-lo-que-cubre-y-lo-que-debe-saber-521766)
- [Cesantías para vivienda (Bancolombia)](https://blog.bancolombia.com/vida-cotidiana/cesantias-para-vivienda-usos-requisitos/)
- [Tasas de crédito hipotecario (Rankia)](https://www.rankia.co/blog/mejores-creditos-y-prestamos-colombia/3805117-tasas-interes-creditos-hipotecarios)
- [Duppla — financiación alternativa para vivienda (Latam Fintech)](https://www.latamfintech.co/articles/fintech-colombiana-duppla-levanta-us-60-millones-para-escalar-su-modelo-de-financiacion-alternativa-para-vivienda)
- [Finanzas abiertas obligatorias, Decreto 0368 de 2026 (Superfinanciera)](https://www.superfinanciera.gov.co/publicaciones/10116081/finanzas-abiertas-obligatorias-impulsaran-el-desarrollo-del-sistema-y-la-inclusion-financiera-en-el-pais/)

## Registro de cambios

**v2 — 13 nov 2026.** El gancho del producto pasa a ser el ahorro para compra de vivienda, tras comparar el plan con Habify y adaptar sus funciones a Colombia.

- Sección nueva "Producto: del arriendo a la casa propia": problema, comparación con Habify, lógica de la Meta Casa, dónde vive el ahorro, parámetros regulatorios, ejemplo, límites regulatorios y modelo de ingresos.
- Principios 9 y 10 (parámetros regulatorios versionados; estimaciones explicables sin promesas) y principio 1 ampliado al ahorro.
- Cuatro módulos nuevos (`housing-parameters`, `home-goals`, `savings`, `rewards`), la interfaz `SavingsProvider`, seis tareas del worker, dos grupos de tablas, la máquina de estados del aporte y seis cuentas del ledger.
- `leases` admite el contrato autodeclarado; `score` pasa a cinco factores; `certificates` agrega la carpeta de vivienda.
- El simulador incorpora una entidad de ahorro, ocho escenarios y tres historias de datos sintéticos.
- Fase nueva 2B (semanas 11–14); el plan pasa de 24 a 29 semanas. Las fases 0, 1, 3, 4 y 5 conservan su número.
- Escalamiento: camino al crédito, fianza sin codeudor, cuenta y apartado del arriendo, vitrina y reporte a centrales.
- Corrección: la tabla de reglas de dependencia decía "Drizzle"; el ORM es Prisma.
