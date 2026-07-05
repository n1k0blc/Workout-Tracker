-- Restores a guarantee the old model had (WorkoutTemplate.@@unique([userId, name])) that
-- was dropped when WorkoutTemplate folded into the unified Workout table during PR2a --
-- a custom template name must be unique per owner. Partial (kind=TEMPLATE only), since
-- BLUEPRINT/WORKOUT rows have no `name` and system templates (userId IS NULL) are exempt
-- from per-user uniqueness by construction (NULL <> NULL in a unique index).
CREATE UNIQUE INDEX "Workout_template_name_per_user_unique" ON "Workout"("userId", "name") WHERE "kind" = 'TEMPLATE'::"WorkoutKind";
