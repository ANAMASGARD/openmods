"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { useController, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { nanoid } from "nanoid";
import { createBot, type CreateBotState } from "@/app/dashboard/actions";
import { AVATAR_SEED_LENGTH, BOT_LIMITS, botFormSchema, type BotField, type BotFormValues } from "@/lib/bot-form-schema";
import { BOT_PRESETS } from "@/lib/bot-presets";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

function CreateBotForm({ avatarSeed, onCreated }: { avatarSeed: string; onCreated: () => void }) {
  const form = useForm<BotFormValues>({
    resolver: zodResolver(botFormSchema),
    defaultValues: { name: "", job: "", instructions: "" },
  });
  const name = useController({ control: form.control, name: "name" });
  const job = useController({ control: form.control, name: "job" });
  const instructions = useController({ control: form.control, name: "instructions" });
  const selectedJob = useWatch({ control: form.control, name: "job" });
  const selectedPreset = BOT_PRESETS.find((preset) => preset.job === selectedJob);
  const submitting = useRef(false);
  const [state, action, pending] = useActionState<CreateBotState, FormData>(
    async (_previous, formData) => {
      try {
        const result = await createBot(formData);
        for (const field of ["name", "job", "instructions"] as BotField[]) {
          const message = result.errors?.[field];
          if (message) form.setError(field, { type: "server", message });
        }
        if (result.success) onCreated();
        return result;
      } finally {
        submitting.current = false;
      }
    },
    {},
  );

  return (
    <form
      action={action}
      noValidate
      className="flex flex-col gap-3"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        const data = new FormData(event.currentTarget);
        void form.handleSubmit(
          () => startTransition(() => action(data)),
          () => { submitting.current = false; },
        )(event);
      }}
    >
      <input type="hidden" name="avatar" value={avatarSeed} />
      <DialogHeader className="flex-row items-center gap-3 pr-6">
        <ChatAvatar seed={avatarSeed} animated className="size-16" alt="Your new bot’s avatar" />
        <div className="flex min-w-0 flex-col gap-1">
          <DialogTitle>Create your bot</DialogTitle>
          <DialogDescription>A developer agent for your GitLab workflow.</DialogDescription>
        </div>
      </DialogHeader>
      <FieldGroup className="gap-2.5">
        <Field data-disabled={pending}>
          <FieldLabel id="bot-specialty-label">Start with a specialty</FieldLabel>
          <ToggleGroup
            aria-labelledby="bot-specialty-label"
            variant="outline"
            size="sm"
            spacing={1.5}
            className="grid w-full grid-cols-2 sm:grid-cols-3"
            value={selectedPreset ? [selectedPreset.id] : []}
            disabled={pending}
            onValueChange={(ids) => {
              const preset = BOT_PRESETS.find((item) => item.id === ids[0]);
              if (!preset) return;
              const previousInstructions = form.getValues("instructions");
              form.setValue("job", preset.job, { shouldDirty: true, shouldValidate: true });
              if (!previousInstructions.trim() || BOT_PRESETS.some((item) => item.instructions === previousInstructions)) {
                form.setValue("instructions", preset.instructions, { shouldDirty: true, shouldValidate: true });
              }
            }}
          >
            {BOT_PRESETS.map((preset) => (
              <ToggleGroupItem key={preset.id} value={preset.id} type="button">{preset.label}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <Field data-invalid={name.fieldState.invalid} data-disabled={pending}>
          <FieldLabel htmlFor="bot-name">Name</FieldLabel>
          <Input {...name.field} id="bot-name" placeholder="e.g. Atlas" required maxLength={BOT_LIMITS.name} disabled={pending} aria-invalid={name.fieldState.invalid} aria-describedby={name.fieldState.error ? "bot-name-error" : undefined} />
          <FieldError id="bot-name-error">{name.fieldState.error?.message}</FieldError>
        </Field>
        <Field data-invalid={job.fieldState.invalid} data-disabled={pending}>
          <FieldLabel htmlFor="bot-job">What’s their job?</FieldLabel>
          <Input {...job.field} id="bot-job" placeholder="e.g. Node.js API developer" required maxLength={BOT_LIMITS.job} disabled={pending} aria-invalid={job.fieldState.invalid} aria-describedby={job.fieldState.error ? "bot-job-error" : undefined} />
          <FieldError id="bot-job-error">{job.fieldState.error?.message}</FieldError>
        </Field>
        <Field data-invalid={instructions.fieldState.invalid} data-disabled={pending}>
          <FieldLabel htmlFor="bot-instructions">Instructions (optional)</FieldLabel>
          <Textarea {...instructions.field} id="bot-instructions" placeholder="Stack, testing expectations, and how to approach the work" rows={3} className="h-16 resize-none field-sizing-fixed sm:h-20" maxLength={BOT_LIMITS.instructions} disabled={pending} aria-invalid={instructions.fieldState.invalid} aria-describedby={instructions.fieldState.error ? "bot-instructions-error" : undefined} />
          <FieldError id="bot-instructions-error">{instructions.fieldState.error?.message}</FieldError>
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

export function CreateBotDialog({ initialAvatarSeed, trigger, finalFocus }: {
  initialAvatarSeed?: string;
  trigger?: ReactNode;
  finalFocus?: RefObject<HTMLElement | null>;
}) {
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
      {trigger ?? <DialogTrigger render={<CreepyButton />}>
        <PlusIcon data-icon="inline-start" />
        Create a new bot
      </DialogTrigger>}
      <DialogContent className="dark dashboard-theme max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" finalFocus={finalFocus}>
        <CreatureMotionForeground>
          {avatarSeed && <CreateBotForm key={avatarSeed} avatarSeed={avatarSeed} onCreated={() => {
            if (currentSeed.current === avatarSeed) changeOpen(false);
          }} />}
        </CreatureMotionForeground>
      </DialogContent>
    </Dialog>
  );
}
