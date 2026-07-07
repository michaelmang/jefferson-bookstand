import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/auth";
import { getStandDetail } from "@/lib/server/feed";
import StandViewerLoader from "@/components/StandViewerLoader";

export default async function StandPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const detail = await getStandDetail(id, user.id);
  if (!detail) notFound();
  return <StandViewerLoader detail={detail} />;
}
