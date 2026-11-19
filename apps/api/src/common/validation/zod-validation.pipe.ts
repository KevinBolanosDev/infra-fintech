import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import { RequestValidationError } from './request-validation.error.js';

/** Clase DTO con el esquema Zod (de `@repo/contracts`) que valida su entrada. */
export interface ZodDtoClass<T> {
  new (): T;
  readonly schema: z.ZodType<T>;
}

/**
 * Crea una clase DTO a partir de un esquema Zod: `class CreateChargeDto extends createZodDto(schema) {}`.
 * El tipo del parámetro (`@Body() body: CreateChargeDto`) llega al pipe por los metadatos del
 * decorador, y el pipe valida con el esquema. Sustituye a `nestjs-zod`, que no admite Nest 12 (ADR-0008).
 */
export function createZodDto<S extends z.ZodType>(schema: S): ZodDtoClass<z.infer<S>> {
  // La clase existe para que Nest la vea como tipo del parámetro; su único dato es el esquema.
  // La marca `declare` es solo de tipos (no emite nada) y evita que sea una clase de solo estáticos.
  class ZodDto {
    static readonly schema = schema;
    declare readonly zodDto: true;
  }
  return ZodDto as unknown as ZodDtoClass<z.infer<S>>;
}

function schemaOf(metatype: ArgumentMetadata['metatype']): z.ZodType | undefined {
  const candidate = (metatype as { schema?: unknown } | undefined)?.schema;
  return typeof candidate === 'object' && candidate !== null && 'safeParse' in candidate
    ? (candidate as z.ZodType)
    : undefined;
}

/**
 * Pipe global: si el parámetro es un DTO de `createZodDto`, lo valida y devuelve el valor ya
 * parseado; si no, lo deja pasar sin tocarlo.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema = schemaOf(metadata.metatype);
    if (schema === undefined) {
      return value;
    }
    const result = schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    throw new RequestValidationError(
      result.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.'),
        code: issue.code,
        message: issue.message,
      })),
    );
  }
}
