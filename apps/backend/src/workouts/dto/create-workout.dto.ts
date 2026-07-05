import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsArray,
  IsDateString,
  IsEnum,
  ValidateNested,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WorkoutExerciseInputDto } from '../../common/dto/workout-tree.dto';

export enum SaveAsTemplateMode {
  NONE = 'none',
  NEW = 'new',
  OVERWRITE = 'overwrite',
}

/**
 * The single transactional save endpoint (§3.3/§3.4): the client builds the whole workout
 * locally (structure, values, rest-attribution) and submits it once, complete, along with
 * optional side-effect flags. The server validates the availability matrix (§3.4) and copies
 * the same tree into every requested target inside one transaction via the shared primitive.
 */
export class CreateWorkoutDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalDuration?: number;

  @IsOptional()
  @IsBoolean()
  isFreeWorkout?: boolean;

  @IsOptional()
  @IsString()
  homeGymId?: string;

  @IsOptional()
  @IsString()
  cycleId?: string;

  @IsOptional()
  @IsString()
  workoutDayId?: string;

  // Which template (if any) this was started from -- drives the "overwrite template" auto-detect.
  @IsOptional()
  @IsString()
  originTemplateId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkoutExerciseInputDto)
  @ArrayMinSize(1)
  exercises: WorkoutExerciseInputDto[];

  // Side effects -- see §3.4 availability matrix.
  @IsOptional()
  @IsBoolean()
  overwriteBlueprint?: boolean;

  @IsOptional()
  @IsEnum(SaveAsTemplateMode)
  saveAsTemplateMode?: SaveAsTemplateMode;

  @IsOptional()
  @IsString()
  saveAsTemplateName?: string;

  @IsOptional()
  @IsString()
  overwriteTemplateId?: string;
}
