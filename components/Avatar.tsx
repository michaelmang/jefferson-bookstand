/* eslint-disable @next/next/no-img-element -- avatars come from arbitrary
   Google account hosts; next/image would require enumerating them. */

export default function Avatar({ name, picture }: { name: string; picture: string | null }) {
  if (picture) {
    return <img className="avatar" src={picture} alt="" referrerPolicy="no-referrer" />;
  }
  return (
    <span className="avatar avatar-monogram" aria-hidden>
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
