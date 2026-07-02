import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));

const validators = new Map();

const formatErrors = (errors = []) =>
  errors
    .map((error) => {
      const location = error.instancePath || '/';
      return `${location} ${error.message}`;
    })
    .join('; ');

export const loadSchemaValidator = async (schemaRelativePath) => {
  if (validators.has(schemaRelativePath)) {
    return validators.get(schemaRelativePath);
  }

  const validatorPromise = (async () => {
    const schema = await readJson(path.join(projectRoot, schemaRelativePath));
    const ajv = new Ajv2020({
      allErrors: true,
      strict: false
    });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    return (value) => {
      const valid = validate(value);
      return {
        valid,
        errors: valid ? [] : validate.errors || []
      };
    };
  })();

  validators.set(schemaRelativePath, validatorPromise);

  try {
    return await validatorPromise;
  } catch (error) {
    validators.delete(schemaRelativePath);
    throw error;
  }
};

export const assertValid = (label, result) => {
  if (!result.valid) {
    throw new Error(`${label} failed schema validation: ${formatErrors(result.errors)}`);
  }
};

export const validateStagingReport = async (report) => {
  const validate = await loadSchemaValidator('schemas/exhibition-staging.schema.json');
  const result = validate(report);
  assertValid('Staging report', result);
  return report;
};

export const validateSourceConfig = async (sourceConfig) => {
  const validate = await loadSchemaValidator('schemas/exhibition-source.schema.json');
  const result = validate(sourceConfig);
  assertValid(`Source config ${sourceConfig?.id || ''}`.trim(), result);
  return sourceConfig;
};

export const validateExhibitionRecord = async (record) => {
  const validate = await loadSchemaValidator('schemas/exhibition.schema.json');
  const result = validate(record);
  assertValid(`Exhibition record ${record?.id || ''}`.trim(), result);
  return record;
};
