/** Texto que reemplaza un valor sensible en los logs. */
export const REDACTED = '[REDACTED]';

/** Profundidad máxima que se recorre; más allá, el valor se sustituye (evita estructuras enormes). */
export const MAX_REDACTION_DEPTH = 10;

/**
 * Nombres de clave sensibles, normalizados (minúsculas, sin acentos ni separadores). Cubren
 * documento, correo, teléfono, contraseñas, tokens, cookies y la cabecera `Authorization`, en
 * inglés y en español.
 */
export const SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  // Documento de identidad
  'document',
  'documento',
  'documentnumber',
  'documentid',
  'numerodocumento',
  'nrodocumento',
  'cedula',
  'nit',
  'dni',
  'passport',
  'pasaporte',
  // Correo
  'email',
  'mail',
  'correo',
  'correoelectronico',
  // Teléfono
  'phone',
  'phonenumber',
  'telefono',
  'celular',
  'mobile',
  'movil',
  // Contraseñas y códigos
  'password',
  'passwd',
  'pwd',
  'contrasena',
  'clave',
  'pin',
  'otp',
  // Tokens, secretos y cabeceras
  'token',
  'tokens',
  'secret',
  'apikey',
  'authorization',
  'cookie',
  'cookies',
  'setcookie',
  // Variantes compuestas y credenciales (revisión de la 0.7)
  'emailaddress',
  'mobilenumber',
  'idnumber',
  'identificacion',
  'numeroidentificacion',
  'jwt',
  'bearer',
  'session',
  'sessionid',
  'privatekey',
  'accesskey',
  'secretkey',
  // IP: dato personal (el contexto la guarda, pero no debe llegar al log)
  'ip',
  'ipaddress',
  'remoteaddress',
  'xforwardedfor',
  'xrealip',
  // Dominio (D-2 de la 0.7): hogar, producto de ahorro, llave Bre-B y dirección
  'hogar',
  'household',
  'savingsproductid',
  'productoahorro',
  'llavebreb',
  'brebkey',
  'direccion',
  'address',
]);

/** Sufijos que delatan un dato sensible (`accessToken`, `customerEmail`, `clientSecret`…). */
export const SENSITIVE_KEY_SUFFIXES: readonly string[] = [
  'password',
  'contrasena',
  'token',
  'secret',
  'apikey',
  'privatekey',
  'authorization',
  'email',
  'correo',
  'phone',
  'telefono',
  'celular',
  'document',
  'documento',
  'cedula',
  'cookie',
  // Ingresos (D-2 de la 0.7): `ingreso`, `ingresos`, `monthlyIncome`, `ingresoMensual`…
  'ingreso',
  'ingresos',
  'income',
];

/** Minúsculas, sin acentos y sin separadores: `Set-Cookie` → `setcookie`, `Teléfono` → `telefono`. */
export function normalizeKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return (
    SENSITIVE_KEYS.has(normalized) ||
    SENSITIVE_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

/** Forma JSON de un error: nombre, mensaje, pila, propiedades propias y `cause`. */
function errorToObject(error: Error): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: error.name,
    message: error.message,
    stack: error.stack,
    ...Object.fromEntries(Object.entries(error)),
  };
  if (error.cause !== undefined) {
    result['cause'] = error.cause;
  }
  return result;
}

function hasToJson(value: object): value is { toJSON: () => unknown } {
  return typeof (value as { toJSON?: unknown }).toJSON === 'function';
}

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  if (depth >= MAX_REDACTION_DEPTH) {
    return '[MaxDepth]';
  }
  seen.add(value);
  let result: unknown;
  if (Array.isArray(value)) {
    result = value.map((item) => redactValue(item, depth + 1, seen));
  } else if (value instanceof Error) {
    // Los errores llevan propiedades propias (config de HTTP con cabeceras, `meta` de Prisma, cause).
    result = redactValue(errorToObject(value), depth, seen);
  } else if (hasToJson(value)) {
    // Lo mismo que escribiría JSON.stringify (Date → texto ISO, Buffer → datos…).
    result = redactValue(value.toJSON(), depth, seen);
  } else {
    // Objetos planos e instancias de clases (DTOs, entidades): sus propiedades propias enumerables,
    // que es lo que se serializa.
    result = Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        isSensitiveKey(key) ? REDACTED : redactValue(child, depth + 1, seen),
      ]),
    );
  }
  seen.delete(value);
  return result;
}

/**
 * Copia de `value` con los valores de claves sensibles reemplazados por `REDACTED`, a cualquier
 * profundidad: objetos planos, arreglos, instancias de clases (DTOs, entidades), errores (incluidas
 * sus propiedades propias y `cause`) y objetos con `toJSON`. No modifica el original.
 *
 * Es una red de seguridad: el código solo debe registrar identificadores (`chargeId`, `leaseId`),
 * nunca datos personales. Límite conocido: el enmascarado es por nombre de clave; un dato personal
 * dentro de un texto libre (por ejemplo, el mensaje del log o el de un error) no se detecta.
 */
export function redact<T>(value: T): T {
  return redactValue(value, 0, new WeakSet()) as T;
}
