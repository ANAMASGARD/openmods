"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { parseBotInput, type BotInputErrors } from "@/lib/bot-input";
import { getDb } from "@/lib/db";
import { bots } from "@/lib/db/schema";

export type CreateBotState = {
  success?: boolean;
  errors?: BotInputErrors;
  error?: string;
};

export async function createBot(formData: FormData): Promise<CreateBotState> {
  const session = await auth0.getSession();
  if (!session?.user.sub) redirect("/sign-in");

  const { values, errors, valid } = parseBotInput(formData);
  if (!valid) return { errors };

  try {
    await getDb().insert(bots).values({
      userId: session.user.sub,
      name: values.name,
      avatar: values.avatar,
      job: values.job,
      instructions: values.instructions || null,
    });
  } catch {
    return { error: "We couldn’t save your bot. Your details are still here — please try again." };
  }

  refresh();
  return { success: true };
}
