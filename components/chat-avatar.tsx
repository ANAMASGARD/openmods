"use client";

import { CreatureAvatar } from "@/components/creatures/creature-avatar";
import { useCreatureMotion } from "@/components/creatures/creature-motion";

type ChatAvatarProps = {
  seed: string;
  animated?: boolean;
  className?: string;
  alt?: string;
};

export function ChatAvatar({ seed, animated = false, className, alt = "Bot avatar" }: ChatAvatarProps) {
  const { paused } = useCreatureMotion();
  return (
    <CreatureAvatar seed={seed} animated={animated} className={className} alt={alt} paused={paused} />
  );
}
