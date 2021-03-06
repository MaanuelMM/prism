import { IPrismDiagnostic } from '@stoplight/prism-core';
import { DiagnosticSeverity } from '@stoplight/types';
import { getSemigroup, NonEmptyArray, fromArray, map } from 'fp-ts/lib/NonEmptyArray';
import { getValidation } from 'fp-ts/lib/Either';
import * as O from 'fp-ts/lib/Option';
import { pipe } from 'fp-ts/lib/pipeable';
import { sequenceT } from 'fp-ts/lib/Apply';
import * as Ajv from 'ajv';
import { JSONSchema } from '../../';
import * as AjvOAI from 'ajv-oai';

const ajv = new AjvOAI({ allErrors: true, messages: true, schemaId: 'auto' });
const ajvNoCoerce = new AjvOAI({ allErrors: true, messages: true, schemaId: 'auto', coerceTypes: false });

export const convertAjvErrors = (
  errors: NonEmptyArray<Ajv.ErrorObject>,
  severity: DiagnosticSeverity,
  prefix?: string
) =>
  pipe(
    errors,
    map<Ajv.ErrorObject, IPrismDiagnostic>(error => {
      const allowedParameters = 'allowedValues' in error.params ? `: ${error.params.allowedValues.join(', ')}` : '';
      const errorPath = error.dataPath.split('.').slice(1);
      const path = prefix ? [prefix, ...errorPath] : errorPath;

      return {
        path,
        code: error.keyword || '',
        message: `${error.message || ''}${allowedParameters}`,
        severity,
      };
    })
  );

export const validateAgainstSchema = (value: unknown, schema: JSONSchema, coerce: boolean, prefix?: string) =>
  pipe(
    O.tryCatch(() => (coerce ? ajv : ajvNoCoerce).compile(schema)),
    O.chain(validateFn =>
      pipe(
        O.tryCatch(() => validateFn(value)),
        O.mapNullable(() => validateFn.errors)
      )
    ),
    O.chain(fromArray),
    O.map(errors => convertAjvErrors(errors, DiagnosticSeverity.Error, prefix))
  );

export const sequenceOption = sequenceT(O.option);
export const sequenceValidation = sequenceT(getValidation(getSemigroup<IPrismDiagnostic>()));
