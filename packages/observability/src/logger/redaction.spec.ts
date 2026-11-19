import { describe, expect, it } from 'vitest';

import {
  isSensitiveKey,
  MAX_REDACTION_DEPTH,
  normalizeKey,
  redact,
  REDACTED,
} from './redaction.js';

describe('normalizeKey', () => {
  it.each([
    ['Set-Cookie', 'setcookie'],
    ['Teléfono', 'telefono'],
    ['número_documento', 'numerodocumento'],
    ['x-api-key', 'xapikey'],
  ])('%s → %s', (key, expected) => {
    expect(normalizeKey(key)).toBe(expected);
  });
});

describe('isSensitiveKey', () => {
  it.each([
    'documento',
    'documentNumber',
    'cedula',
    'email',
    'correo',
    'customerEmail',
    'phone',
    'Teléfono',
    'celular',
    'password',
    'contraseña',
    'newPassword',
    'token',
    'accessToken',
    'refresh_token',
    'clientSecret',
    'x-api-key',
    'Authorization',
    'cookie',
    'Set-Cookie',
    'otp',
  ])('%s es sensible', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each([
    'amount',
    'chargeId',
    'status',
    'request_id',
    'tokenCount',
    'emailVerified',
    'nombre',
    'name',
    'addressId',
  ])('%s no es sensible', (key) => {
    expect(isSensitiveKey(key)).toBe(false);
  });
});

describe('redact', () => {
  it('enmascara claves sensibles en objetos anidados y en arreglos', () => {
    const input = {
      user: { email: 'persona@example.test', profile: { phone: '+57 300 000 0000' } },
      tenants: [
        { documento: '1000000000', name: 'Inquilina' },
        { documento: '2000000000', contacts: [{ correo: 'otro@example.test' }] },
      ],
      headers: { authorization: 'Bearer abc.def', cookie: 'sid=xyz', accept: 'application/json' },
      amount: 120_000n,
    };

    expect(redact(input)).toEqual({
      user: { email: REDACTED, profile: { phone: REDACTED } },
      tenants: [
        { documento: REDACTED, name: 'Inquilina' },
        { documento: REDACTED, contacts: [{ correo: REDACTED }] },
      ],
      headers: { authorization: REDACTED, cookie: REDACTED, accept: 'application/json' },
      amount: 120_000n,
    });
  });

  it('enmascara el valor entero aunque sea un objeto o un arreglo', () => {
    expect(redact({ tokens: ['a', 'b'], password: { hash: 'x' } })).toEqual({
      tokens: REDACTED,
      password: REDACTED,
    });
  });

  it('no modifica el objeto original', () => {
    const input = { password: 'secreto-sintetico', nested: { token: 't' } };
    redact(input);
    expect(input).toEqual({ password: 'secreto-sintetico', nested: { token: 't' } });
  });

  it('marca las referencias circulares y respeta la profundidad máxima', () => {
    const circular: Record<string, unknown> = { name: 'raíz' };
    circular['self'] = circular;
    expect(redact(circular)).toEqual({ name: 'raíz', self: '[Circular]' });

    let deep: Record<string, unknown> = { leaf: true };
    for (let level = 0; level < MAX_REDACTION_DEPTH + 2; level++) {
      deep = { child: deep };
    }
    expect(JSON.stringify(redact(deep))).toContain('[MaxDepth]');
  });

  it('repite el mismo objeto en dos ramas sin confundirlo con una referencia circular', () => {
    const shared = { email: 'compartido@example.test' };
    expect(redact({ a: shared, b: shared })).toEqual({
      a: { email: REDACTED },
      b: { email: REDACTED },
    });
  });

  it('deja intactos los primitivos y aplica toJSON como JSON.stringify', () => {
    expect(redact('texto')).toBe('texto');
    expect(redact(null)).toBeNull();
    expect(redact(42)).toBe(42);
    expect(redact({ at: new Date(0) })).toEqual({ at: '1970-01-01T00:00:00.000Z' });
    expect(redact({ value: { toJSON: () => ({ token: 't', ok: true }) } })).toEqual({
      value: { token: REDACTED, ok: true },
    });
    expect(redact(Object.assign(Object.create(null) as object, { pin: '1234' }))).toEqual({
      pin: REDACTED,
    });
  });

  it('recorre instancias de clases y errores (propiedades propias y cause)', () => {
    class Tenant {
      constructor(
        readonly name: string,
        readonly email: string,
      ) {}
    }
    expect(redact({ tenant: new Tenant('Inquilina', 'persona@example.test') })).toEqual({
      tenant: { name: 'Inquilina', email: REDACTED },
    });

    const cause = Object.assign(new Error('raíz'), { token: 't' });
    const error = Object.assign(new Error('fallo', { cause }), {
      config: { authorization: 'Bearer x' },
    });
    const result = redact({ error }) as unknown as { error: Record<string, unknown> };
    expect(result.error).toMatchObject({
      type: 'Error',
      message: 'fallo',
      config: { authorization: REDACTED },
      cause: { type: 'Error', message: 'raíz', token: REDACTED },
    });
    expect(result.error['stack']).toEqual(expect.stringContaining('fallo'));
  });

  it('cubre variantes compuestas de documento, teléfono, correo, credenciales e IP', () => {
    for (const key of [
      'customerDocument',
      'tenantDocumento',
      'ownerCedula',
      'numeroTelefono',
      'ownerCelular',
      'contactoCorreo',
      'emailAddress',
      'mobileNumber',
      'privateKey',
      'proxy-authorization',
      'sessionId',
      'ip',
      'x-forwarded-for',
      'remoteAddress',
      // Dominio (D-2 de la 0.7)
      'ingreso',
      'ingresos',
      'monthlyIncome',
      'hogar',
      'household',
      'savingsProductId',
      'productoAhorro',
      'llaveBreb',
      'brebKey',
      'direccion',
      'dirección',
      'address',
    ]) {
      expect(isSensitiveKey(key)).toBe(true);
    }
  });
});
