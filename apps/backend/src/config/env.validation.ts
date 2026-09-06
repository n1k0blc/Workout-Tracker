import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidationError,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

// OWASP-floor minimum length for an HS256 JWT signing secret.
const MIN_JWT_SECRET_LENGTH = 32;

// Placeholder values shipped in .env.example / .env.local.example — never valid in a real deployment.
const KNOWN_WEAK_JWT_SECRETS = new Set([
  'your-super-secret-jwt-key-change-this-in-production',
  'changeme',
  'change-me',
  'secret',
  'password',
]);

class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsOptional()
  @IsInt()
  @Min(1)
  PORT?: number;

  @IsString()
  @Matches(/^postgres(ql)?:\/\/.+/, {
    message: 'DATABASE_URL must be a postgres(ql):// connection string',
  })
  DATABASE_URL: string;

  @IsString()
  @MinLength(MIN_JWT_SECRET_LENGTH, {
    message: `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`,
  })
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRATION?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @IsString()
  MOCK_DATE?: string;

  // Have I Been Pwned "Pwned Passwords" range API. Both optional — sensible
  // defaults live in BreachedPasswordService. Override the URL to point at a
  // mirror; raise the timeout on a slow link.
  @IsOptional()
  @IsString()
  PWNED_PASSWORDS_API_URL?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  PWNED_PASSWORDS_TIMEOUT_MS?: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (
    typeof validatedConfig.JWT_SECRET === 'string' &&
    KNOWN_WEAK_JWT_SECRETS.has(validatedConfig.JWT_SECRET.trim().toLowerCase())
  ) {
    const weakSecretError = new ValidationError();
    weakSecretError.property = 'JWT_SECRET';
    weakSecretError.constraints = {
      knownWeakSecret:
        'JWT_SECRET is a known placeholder value from .env.example — set a real, unique secret',
    };
    errors.push(weakSecretError);
  }

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  return validatedConfig;
}
