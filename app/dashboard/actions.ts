"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { auth0 } from "@/lib/auth0";
import { parseBotInput, type BotInputErrors } from "@/lib/bot-input";
import { getDb } from "@/lib/db";
import { bots, chats, chatMembers } from "@/lib/db/schema";

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
    const db = getDb();
    const botId = nanoid();
    const chatId = nanoid();
    // Neon HTTP batches run in one transaction: no partial bot/chat on failure.
    await db.batch([
      db.insert(bots).values({
        id: botId,
        userId: session.user.sub,
        name: values.name,
        avatar: values.avatar,
        job: values.job,
        instructions: values.instructions || null,
      }),
      db.insert(chats).values({ id: chatId, userId: session.user.sub, kind: "direct" }),
      db.insert(chatMembers).values({ chatId, botId }),
    ]);
  } catch {
    return { error: "We couldn’t save your bot. Your details are still here — please try again." };
  }

  // Reload the shared sidebar's chat query as well as the dashboard's bot list.
  revalidatePath("/(dashboard)", "layout");
  return { success: true };
}
