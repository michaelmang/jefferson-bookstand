import { PAINTINGS, paintingUrl } from "@/lib/paintings";
import { backgroundById } from "@/lib/standState";
import Avatar from "./Avatar";
import GoogleSignIn from "./GoogleSignIn";

type Props = {
  title: string;
  author: { name: string; picture: string | null };
  background: string;
  restCount: number;
  clientId: string | null;
};

/**
 * What a signed-out visitor (or a link-unfurl bot) sees at /stand/[id]:
 * enough to know what's being shared — never the papers, letters, or the
 * interactive stand itself, which stay behind sign-in.
 */
export default function StandPreviewGate({
  title,
  author,
  background,
  restCount,
  clientId,
}: Props) {
  return (
    <main className="landing">
      <div
        className="landing-art"
        style={{ backgroundImage: `url(${paintingUrl(PAINTINGS.reader, 1800)})` }}
      />
      <div className="landing-veil" />
      <div className="landing-card">
        <p className="overline">A stand in the reading society</p>
        <h1>{title}</h1>
        <div className="fleuron" aria-hidden>
          ❦
        </div>
        <p className="preview-byline">
          <Avatar name={author.name} picture={author.picture} />
          {`Curated by ${author.name} — ${backgroundById(background).name} — ${restCount} ${
            restCount === 1 ? "paper" : "papers"
          } resting`}
        </p>
        <p>Sign in to spin the stand, read the papers, and stamp the ones you treasure.</p>
        <GoogleSignIn clientId={clientId} />
      </div>
    </main>
  );
}
