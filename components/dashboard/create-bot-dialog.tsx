"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { PlusIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { createBot, type CreateBotState } from "@/app/dashboard/actions";
import { AVATAR_SEED_LENGTH, BOT_LIMITS } from "@/lib/bot-input";
import { resolveCreature } from "@/lib/creatures/catalog";
import { seedForCreature } from "@/lib/creatures/selection";
import { ChatAvatar } from "@/components/chat-avatar";
import { CreatureMotionForeground, useCreatureMotion } from "@/components/creatures/creature-motion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CreepyButton } from "@/components/ui/creepy-button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

function CreateBotForm({ avatarSeed, onCreated }: { avatarSeed: string; onCreated: () => void }) {
  const [values, setValues] = useState({ name: "", job: "", instructions: "" });
  const [state, action, pending] = useActionState<CreateBotState, FormData>(
    async (_previous, formData) => {
      const result = await createBot(formData);
      if (result.success) onCreated();
      return result;
    },
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4" aria-busy={pending}>
      <input type="hidden" name="avatar" value={avatarSeed} />
      <DialogHeader className="pr-6">
        <DialogTitle>Create your bot</DialogTitle>
        <DialogDescription>Give your companion a name and a purpose.</DialogDescription>
      </DialogHeader>
      <ChatAvatar seed={avatarSeed} animated className="size-20 self-center" alt="Your new bot’s avatar" />
      <FieldGroup className="gap-3">
        <Field data-invalid={!!state.errors?.name} data-disabled={pending}>
          <FieldLabel htmlFor="bot-name">Name</FieldLabel>
          <Input id="bot-name" name="name" placeholder="e.g. Atlas" required maxLength={BOT_LIMITS.name} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} disabled={pending} aria-invalid={!!state.errors?.name} aria-describedby={state.errors?.name ? "bot-name-error" : undefined} />
          <FieldError id="bot-name-error">{state.errors?.name}</FieldError>
        </Field>
        <Field data-invalid={!!state.errors?.job} data-disabled={pending}>
          <FieldLabel htmlFor="bot-job">What’s their job?</FieldLabel>
          <Input id="bot-job" name="job" placeholder="e.g. Research ideas for my next project" required maxLength={BOT_LIMITS.job} value={values.job} onChange={(event) => setValues({ ...values, job: event.target.value })} disabled={pending} aria-invalid={!!state.errors?.job} aria-describedby={state.errors?.job ? "bot-job-error" : undefined} />
          <FieldError id="bot-job-error">{state.errors?.job}</FieldError>
        </Field>
        <Field data-invalid={!!state.errors?.instructions} data-disabled={pending}>
          <FieldLabel htmlFor="bot-instructions">Instructions (optional)</FieldLabel>
          <Textarea id="bot-instructions" name="instructions" placeholder="How should your bot approach the job?" rows={3} className="h-20 resize-none field-sizing-fixed" maxLength={BOT_LIMITS.instructions} value={values.instructions} onChange={(event) => setValues({ ...values, instructions: event.target.value })} disabled={pending} aria-invalid={!!state.errors?.instructions} aria-describedby={state.errors?.instructions ? "bot-instructions-error" : undefined} />
          <FieldError id="bot-instructions-error">{state.errors?.instructions}</FieldError>
        </Field>
      </FieldGroup>
      {state.errors?.avatar && <Alert variant="destructive"><AlertDescription>{state.errors.avatar}</AlertDescription></Alert>}
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      <DialogFooter className="flex-row justify-end">
        <DialogClose render={<Button variant="ghost" disabled={pending} />}>Cancel</DialogClose>
        <Button type="submit" disabled={pending || !avatarSeed}>
          {pending ? <Spinner data-icon="inline-start" /> : <PlusIcon data-icon="inline-start" />}
          {pending ? "Creating…" : "Create bot"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CreateBotDialog({ initialAvatarSeed }: { initialAvatarSeed?: string }) {
  const [open, setOpen] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState<string | null>(null);
  const currentSeed = useRef<string | null>(null);
  const dialogId = useId();
  const { setDialogOpen } = useCreatureMotion();

  useEffect(() => () => setDialogOpen(dialogId, false), [dialogId, setDialogOpen]);

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen && !open) {
      const randomSeed = nanoid(AVATAR_SEED_LENGTH);
      const preferred = initialAvatarSeed ? resolveCreature(initialAvatarSeed) : null;
      const seed = preferred ? seedForCreature(randomSeed, preferred.id, preferred.variant) : randomSeed;
      currentSeed.current = seed;
      setAvatarSeed(seed);
    } else if (!nextOpen) {
      currentSeed.current = null;
    }
    setOpen(nextOpen);
    setDialogOpen(dialogId, nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger render={<CreepyButton />}>
        <PlusIcon data-icon="inline-start" />
        Create a new bot
      </DialogTrigger>
      <DialogContent className="dark dashboard-theme max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <CreatureMotionForeground>
          {avatarSeed && <CreateBotForm key={avatarSeed} avatarSeed={avatarSeed} onCreated={() => {
            if (currentSeed.current === avatarSeed) changeOpen(false);
          }} />}
        </CreatureMotionForeground>
      </DialogContent>
    </Dialog>
  );
}
