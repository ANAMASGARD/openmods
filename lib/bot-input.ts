export const BOT_LIMITS = { name: 80, job: 240, instructions: 4000 } as const;
export const AVATAR_SEED_LENGTH = 21;

export type BotField = keyof typeof BOT_LIMITS;
export type BotInputErrors = Partial<Record<BotField | "avatar", string>>;

export function parseBotInput(formData: FormData) {
  const values = { name: "", job: "", instructions: "", avatar: "" };
  const errors: BotInputErrors = {};

  for (const field of Object.keys(BOT_LIMITS) as BotField[]) {
    const value = formData.get(field);
    if (value !== null && typeof value !== "string") {
      errors[field] = "Enter text for this field.";
      continue;
    }
    values[field] = (value ?? "").trim();
    if (field !== "instructions" && !values[field]) {
      errors[field] = field === "name" ? "Give your bot a name." : "Describe your bot’s job.";
    } else if (values[field].length > BOT_LIMITS[field]) {
      errors[field] = `Use ${BOT_LIMITS[field]} characters or fewer.`;
    }
  }

  const avatars = formData.getAll("avatar");
  const avatar = avatars[0];
  if (avatars.length !== 1 || typeof avatar !== "string" || avatar.length !== AVATAR_SEED_LENGTH || /[^A-Za-z0-9_-]/.test(avatar)) {
    errors.avatar = "We couldn’t verify your bot’s avatar. Please reopen this dialog and try again.";
  } else {
    values.avatar = avatar;
  }

  return { values, errors, valid: Object.keys(errors).length === 0 };
}
