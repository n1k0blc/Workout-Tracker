import { Email, Password } from '../../common/validation/field-rules';

export class LoginDto {
  @Email()
  email: string;

  @Password()
  password: string;
}
