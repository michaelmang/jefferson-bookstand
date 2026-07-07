"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions";
import Avatar from "./Avatar";

export default function UserMenu({ name, picture }: { name: string; picture: string | null }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="user-menu">
      <Avatar name={name} picture={picture} />
      <span className="user-name">{name}</span>
      <button
        className="btn"
        disabled={pending}
        onClick={() => startTransition(async () => void (await signOut()))}
      >
        Sign out
      </button>
    </div>
  );
}
