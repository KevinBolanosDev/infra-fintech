# @repo/platform

Módulos NestJS transversales que comparten `api` y `worker` (D-05, ADR-0003): hoy el reloj; más adelante auditoría, `outbox` e idempotencia. Cada módulo sigue las capas `application/`, `infrastructure/` (y `domain/`, `interface/` si las necesita) con su `*.module.ts` como raíz de composición. Paquete compilado (ADR-0005); perfil `nest` (85 % de líneas).

## Reloj de negocio (`src/clock/`, ADR-0011)

```ts
import { ClockModule, ClockService } from '@repo/platform';

// AppModule: ClockModule.forRoot({ mode: config.CLOCK_MODE, appEnv: config.APP_ENV, redisUrl: config.REDIS_URL })

@Injectable()
export class RegisterPayment {
  constructor(private readonly clock: ClockService) {} // importado como valor

  async execute(): Promise<void> {
    const now = await this.clock.now(); // una vez por caso de uso; las reglas puras reciben `now`
  }
}
```

| Modo (`CLOCK_MODE`) | Implementación | Dónde |
| --- | --- | --- |
| `system` (por defecto) | `SystemClock`: hora real. Único archivo de negocio que la lee (excepción `systemClockFiles` de ESLint) | Todos los ambientes |
| `controllable` | `RedisControllableClock`: hora real + desfase en Redis (`fintech:clock:offset_ms`); `ControllableClockService.set/advance` | Nunca en `production`; exige `REDIS_URL` |

En las pruebas se usa `ManualClock` de `@repo/testing`.

## Comandos

```bash
pnpm turbo run lint typecheck test --filter=@repo/platform
pnpm turbo run test:int --filter=@repo/platform   # Redis real del harness: dos instancias ven el mismo instante
```
