import { BaseText, NAME_MAX } from '../../common/validation/field-rules';

export class CreateHomeGymDto {
  @BaseText(NAME_MAX)
  name: string;
}
