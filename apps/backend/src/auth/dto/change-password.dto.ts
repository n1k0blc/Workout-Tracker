import { Password } from '../../common/validation/field-rules';

export class ChangePasswordDto {
  @Password()
  currentPassword: string;

  @Password()
  newPassword: string;
}
