import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/auth";
import StudioLoader from "@/components/StudioLoader";

export default async function StudioPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");
  return <StudioLoader />;
}
