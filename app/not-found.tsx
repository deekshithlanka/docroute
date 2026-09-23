import Link from "next/link";
export default function NotFound() {
  return (
    <div className="panel" style={{ maxWidth: 520 }}>
      <h2>That document isn't here</h2>
      <p className="muted" style={{ marginTop: 6 }}>
        It may have been uploaded before the app restarted. Without a database connected, uploads are kept in memory only.
      </p>
      <p style={{ marginTop: 12 }}><Link href="/">Back to inbox</Link></p>
    </div>
  );
}
