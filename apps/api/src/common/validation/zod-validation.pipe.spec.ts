import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { RequestValidationError } from './request-validation.error.js';
import { createZodDto, ZodValidationPipe } from './zod-validation.pipe.js';

const schema = z.object({
  monto: z.number().int().positive(),
  etiquetas: z.array(z.string()).default([]),
});
class CreateDto extends createZodDto(schema) {}

const pipe = new ZodValidationPipe();
const bodyOf = (metatype: unknown) => ({ type: 'body' as const, metatype: metatype as never });

describe('createZodDto', () => {
  it('expone el esquema como dato estático de la clase (también en subclases)', () => {
    expect(CreateDto.schema).toBe(schema);
  });
});

describe('ZodValidationPipe', () => {
  it('devuelve el valor parseado (con defaults) si es válido', () => {
    expect(pipe.transform({ monto: 100 }, bodyOf(CreateDto))).toEqual({
      monto: 100,
      etiquetas: [],
    });
  });

  it('lanza RequestValidationError con un detalle por campo (ruta con puntos)', () => {
    try {
      pipe.transform({ monto: -1, etiquetas: ['ok', 3] }, bodyOf(CreateDto));
      expect.unreachable('debía lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(RequestValidationError);
      const { details } = error as RequestValidationError;
      expect(details.map((detail) => detail.field).sort()).toEqual(['etiquetas.1', 'monto']);
      expect(details.every((detail) => detail.code.length > 0 && detail.message.length > 0)).toBe(
        true,
      );
    }
  });

  it.each([
    undefined,
    String,
    class Plain {
      readonly value = 1;
    },
    { schema: 'no es un esquema' },
  ])('deja pasar sin tocar los parámetros que no son DTO de Zod (%#)', (metatype) => {
    const value = { cualquier: 'cosa' };
    expect(pipe.transform(value, bodyOf(metatype))).toBe(value);
  });
});
