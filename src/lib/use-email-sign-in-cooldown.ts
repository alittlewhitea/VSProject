"use client";

import { useEffect, useState } from "react";

export function useEmailSignInCooldown(email: string) {
  const [cooldown, setCooldown] = useState<{ email: string; deadline: number } | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= cooldown.deadline) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function startCooldown(address: string, seconds: number) {
    if (seconds <= 0) return;
    const time = Date.now();
    setNow(time);
    setCooldown({ email: address.trim().toLowerCase(), deadline: time + seconds * 1000 });
  }

  const remaining = cooldown?.email === email.trim().toLowerCase()
    ? Math.max(0, Math.ceil((cooldown.deadline - now) / 1000))
    : 0;
  return { remaining, startCooldown };
}
