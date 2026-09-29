"use client";

import { useActionState } from "react";
import { Field, inputCls, Notice, PrimaryButton } from "@/components/admin/ui";
import { signIn } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email" htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="email" required className={inputCls} />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputCls} />
      </Field>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <PrimaryButton type="submit" pending={pending}>{pending ? "Signing in…" : "Sign in"}</PrimaryButton>
    </form>
  );
}
