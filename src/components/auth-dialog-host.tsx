"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { AUTH_DIALOG_EVENT, type SignInRequest } from "../lib/auth-navigation";

const AuthDialog = dynamic(() => import("./auth-dialog"), { ssr: false });

export function AuthDialogHost() {
  const [request, setRequest] = useState<(SignInRequest & { id: number }) | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    const open = (event: Event) => setRequest({ ...(event as CustomEvent<SignInRequest>).detail, id: ++sequence.current });
    window.addEventListener(AUTH_DIALOG_EVENT, open);
    return () => window.removeEventListener(AUTH_DIALOG_EVENT, open);
  }, []);
  return request ? <AuthDialog key={request.id} request={request} onClose={() => setRequest(null)} /> : null;
}
