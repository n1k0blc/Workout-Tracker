import { BaseText, NAME_MAX } from '../../common/validation/field-rules';

export class UpdateHomeGymDto {
  @BaseText(NAME_MAX)
  name: string;
}
