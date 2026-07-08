import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser, googleClientId } from "@/lib/server/auth";
import { getStandDetail } from "@/lib/server/feed";
import StandViewerLoader from "@/components/StandViewerLoader";
import StandPreviewGate from "@/components/StandPreviewGate";

async function loadStand(id: string) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  return getStandDetail(numericId, null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const detail = await loadStand((await params).id);
  if (!detail) return {};
  const restCount = detail.slots.filter(Boolean).length;
  const description = `Curated by ${detail.author.name} — ${restCount} ${
    restCount === 1 ? "paper" : "papers"
  } resting on this stand.`;
  return {
    title: detail.title,
    description,
    // openGraph/twitter titles don't inherit from the plain fields above —
    // each metadata block needs its own copy or social unfurls fall back
    // to the site-wide text from the root layout.
    openGraph: { title: detail.title, description },
    twitter: { title: detail.title, description },
  };
}

export default async function StandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const user = await getSessionUser();
  const detail = await getStandDetail(numericId, user?.id ?? null);
  if (!detail) notFound();

  if (!user) {
    return (
      <StandPreviewGate
        title={detail.title}
        author={detail.author}
        background={detail.background}
        restCount={detail.slots.filter(Boolean).length}
        clientId={googleClientId()}
      />
    );
  }

  return <StandViewerLoader detail={detail} />;
}
