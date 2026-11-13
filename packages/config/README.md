# @repo/config

Configuración compartida del monorepo: TypeScript, ESLint, Prettier y Vitest. No contiene lógica de negocio ni depende de otros paquetes del repositorio.

## Contenido

| Export | Archivo | Uso |
| --- | --- | --- |
| `@repo/config/tsconfig/base.json` | `tsconfig/base.json` | TypeScript puro en ESM (`domain`, `contracts`). Estricto, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `module`/`moduleResolution` `Node16` |
| `@repo/config/tsconfig/node.json` | `tsconfig/node.json` | Paquetes que corren en Node.js 24 (añade los tipos de Node) |
| `@repo/config/tsconfig/nest.json` | `tsconfig/nest.json` | Apps y paquetes NestJS 12: `experimentalDecorators`, `emitDecoratorMetadata`, `useDefineForClassFields: false` |
| `@repo/config/eslint/base` | `eslint/base.js` | `createBaseConfig({ tsconfigRootDir })`: JS recomendado, `typescript-eslint` `strictTypeChecked` con `projectService`, imports ordenados (`simple-import-sort`), sin `any`. Ignora `node_modules`, `dist`, `coverage`, `generated` y `migrations` |
| `@repo/config/prettier` | `prettier/index.json` | Estilo único de Prettier; la raíz lo usa desde `.prettierrc` |
| `@repo/config/vitest/base` | `vitest/base.ts` | `createVitestConfig({ profile, kind })`: fábrica única de Vitest con los umbrales de cobertura del plan |
| `@repo/config/vitest/node` | `vitest/node.ts` | `createNodeVitestConfig()`: paquetes de Node sin decoradores (perfil `utility` por defecto) |
| `@repo/config/vitest/nest` | `vitest/nest.ts` | `createNestVitestConfig()`: NestJS; transforma con SWC (`unplugin-swc`) emitiendo metadatos de decoradores en ESM (perfil `nest` por defecto) |

## Pruebas: convenciones y umbrales

| Tipo | Ubicación y nombre | Configuración | Comando |
| --- | --- | --- | --- |
| Unitaria | Junto al archivo: `src/**/*.spec.ts` (por ejemplo `charge.entity.spec.ts`) | `kind: 'unit'` (por defecto), cobertura v8 siempre activa | `pnpm test` |
| Integración | `test/integration/**/*.int-spec.ts` | `kind: 'integration'`, sin cobertura, `passWithNoTests` | `pnpm test:int` |
| Extremo a extremo | `test/e2e/**/*.e2e-spec.ts` | Se define con la primera app (0.8) | — |

Perfiles de cobertura (tabla "Política de pruebas" del plan). Si no se alcanza el umbral, `vitest run` termina con código 1 y la tarea de Turbo falla:

| Perfil | Umbral | Para |
| --- | --- | --- |
| `domain` | 90 % de ramas | `packages/domain` |
| `nest` | 85 % de líneas | Casos de uso y módulos NestJS |
| `utility` | 80 % de líneas | Utilidades y paquetes técnicos |

Un paquete puede añadir o endurecer umbrales con `thresholds` (por ejemplo, ramas en `observability`), nunca bajarlos. Quedan fuera de la cobertura las pruebas, los `.d.ts` y `generated/`. Ninguna prueba unitaria llama a la red ni lee fuera del repositorio.

Correspondencia con la tabla del plan maestro: `domain` = "Entidad, valor o regla en `packages/domain`"; `nest` = "Caso de uso de NestJS"; `utility` = umbral de "utilidades" que fija la sub-fase 0.3 del plan de la Fase 0 para paquetes técnicos de backend (la fila "Hook o utilidad del frontend", 90 % de ramas, se aplicará en la Fase 4 con su propio perfil).

`vitest.config.ts` de un paquete Nest:

```ts
import { createNestVitestConfig } from '@repo/config/vitest/nest';

export default createNestVitestConfig();
```

Y para integración, `vitest.int.config.ts` con `createNestVitestConfig({ kind: 'integration' })` y el script `"test:int": "vitest run --config vitest.int.config.ts"`.

## Cómo lo consume un paquete

`tsconfig.json`:

```json
{
  "extends": "@repo/config/tsconfig/node.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

`eslint.config.js` (cada paquete tiene el suyo; ESLint 10 usa la configuración más cercana a cada archivo):

```js
// @ts-check
import { createBaseConfig } from '@repo/config/eslint/base';

export default createBaseConfig({ tsconfigRootDir: import.meta.dirname });
```

Scripts mínimos del paquete: `"lint": "eslint --max-warnings=0 ."`, `"typecheck": "tsc --noEmit -p tsconfig.json"` y `"test": "vitest run"`. Las tareas y su caché las define `turbo.json` en la raíz.

## Notas

- Los binarios (`eslint`, `tsc`, `prettier`, `turbo`) y los plugins se instalan en la raíz del monorepo con versión exacta (ver `docs/adr/0001-toolchain-y-versiones.md`).
- Los archivos `.js` de configuración se lintean sin información de tipos; su tipado se comprueba con `checkJs` en el `typecheck` de este paquete.
- Cualquier archivo `.ts` del repositorio debe pertenecer a un `tsconfig.json`; si no, el lint con tipos falla ("not found by the project service").
- Las fábricas de `vitest/` se publican como `.ts` sin compilar. El cargador de configuración de Vite deja el paquete enlazado en manos de Node, que lo carga quitando los tipos (Node 24). Por eso:
  - entre ellas se importan por el export del propio paquete (`@repo/config/vitest/base`), no por ruta relativa: `./base.js` no existe para Node y `./base.ts` rompería el `tsc` de los consumidores (TS5097). Los `*.spec.ts` sí usan rutas relativas con `.js`, porque solo los ejecuta Vitest (que las resuelve);
  - solo usan sintaxis borrable (`erasableSyntaxOnly`): nada de `enum`, `namespace` ni propiedades de parámetro.
- Los umbrales del perfil son un piso: `thresholds` puede endurecerlos o añadir métricas, pero `createVitestConfig` lanza un error si se pide un valor menor que el del perfil.
- Las dependencias de las fábricas (`eslint`, `typescript-eslint`, `vitest`, `unplugin-swc`, `@swc/core`, etc.) no se declaran en este paquete: se instalan una sola vez en la raíz con versión exacta y se resuelven desde ahí (decisión de la 0.2 y la 0.3; ver ADR-0001).
