import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, Min, MinLength, ValidateNested } from 'class-validator';
import { createValidationPipe } from './validation-pipe';

class Item {
  @IsInt()
  @Min(1)
  quantity: number;
}

class Body {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @MinLength(8)
  @IsNotEmpty()
  password: string;

  @ValidateNested({ each: true })
  @Type(() => Item)
  items: Item[];
}

const meta: ArgumentMetadata = { type: 'body', metatype: Body };

async function failure(value: unknown): Promise<{ response: any }> {
  const pipe = createValidationPipe();
  try {
    await pipe.transform(value, meta);
  } catch (e) {
    expect(e).toBeInstanceOf(BadRequestException);
    const response = (e as BadRequestException).getResponse() as any;
    return { response };
  }
  throw new Error('expected a validation failure');
}

describe('createValidationPipe — machine-readable validation errors (#190)', () => {
  it('sends no generated prose: the body is just the code and the per-property errors', async () => {
    const { response } = await failure({ email: 'nope', password: 'x', items: [] });

    expect(Object.keys(response).sort()).toEqual(['code', 'errors']);
  });

  it('adds code and per-property constraint keys that behave like codes', async () => {
    const { response } = await failure({ email: 'nope', password: 'x', items: [] });

    expect(response.code).toBe('VALIDATION_FAILED');
    expect(response.errors).toEqual(
      expect.arrayContaining([
        { property: 'email', constraints: ['isEmail'] },
        { property: 'password', constraints: ['minLength'] },
      ]),
    );
  });

  it('reports nested failures under their full property path', async () => {
    const { response } = await failure({
      email: 'a@b.de',
      password: 'longenough',
      items: [{ quantity: 0 }],
    });

    expect(response.errors).toEqual([{ property: 'items.0.quantity', constraints: ['min'] }]);
  });

  it('reports a forbidden extra property with the whitelist constraint', async () => {
    const { response } = await failure({
      email: 'a@b.de',
      password: 'longenough',
      items: [],
      admin: true,
    });

    expect(response.errors).toEqual([{ property: 'admin', constraints: ['whitelistValidation'] }]);
  });
});
