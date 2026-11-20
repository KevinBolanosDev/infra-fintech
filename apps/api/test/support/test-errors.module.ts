// SOLO PRUEBAS. Vive en test/ (fuera de tsconfig.build.json): nunca se compila a dist/ ni lo
// registra bootstrap(). Las pruebas lo pasan a createApp() con `extraModules`.
import { setTimeout as sleep } from 'node:timers/promises';

import { Body, Controller, ForbiddenException, Get, Module, Post, Query } from '@nestjs/common';
import { DomainError } from '@repo/domain';
import { executionContext } from '@repo/observability';
import { z } from 'zod';

import { createZodDto } from '../../src/common/validation/zod-validation.pipe.js';

const createTestChargeSchema = z.object({
  monto: z.number().int().positive(),
  concepto: z.string().min(3),
  inquilino: z.object({ documento: z.string().min(5) }),
});

export class CreateTestChargeDto extends createZodDto(createTestChargeSchema) {}

@Controller('pruebas')
export class TestErrorsController {
  @Get('error-inesperado')
  unexpected(): never {
    throw new Error(
      'detalle interno sintético: SELECT * FROM charges WHERE documento = 1000000000',
    );
  }

  @Get('error-dominio')
  domain(): never {
    throw new DomainError('CHARGE_ALREADY_PAID', 'El cobro ya fue pagado.');
  }

  @Get('prohibido')
  forbidden(): never {
    throw new ForbiddenException('mensaje interno sintético que no debe salir');
  }

  @Post('validacion')
  validate(@Body() body: CreateTestChargeDto): CreateTestChargeDto {
    return body;
  }

  @Post('contexto')
  contextWithBody(@Body() body: unknown): {
    requestId?: string;
    correlationId?: string;
    received: unknown;
  } {
    const store = executionContext.get();
    return { requestId: store?.requestId, correlationId: store?.correlationId, received: body };
  }

  @Get('contexto')
  async context(
    @Query('espera') wait?: string,
  ): Promise<{ requestId?: string; correlationId?: string }> {
    await sleep(Number(wait ?? '0'));
    const store = executionContext.get();
    return { requestId: store?.requestId, correlationId: store?.correlationId };
  }
}

@Module({ controllers: [TestErrorsController] })
export class TestErrorsModule {}
