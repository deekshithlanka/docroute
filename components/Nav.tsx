"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ live, persistent }: { live: boolean; persistent: boolean }) {
  const path = usePathname();
  const onInbox = path === "/" || path.startsWith("/documents");
  return (
    <header className="topbar">
      <Link href="/" className="brand">DocRoute</Link>
      <nav className="nav" aria-label="Main">
        <Link href="/" aria-current={onInbox ? "page" : undefined}>Inbox</Link>
        <Link href="/metrics" aria-current={path === "/metrics" ? "page" : undefined}>Cost and quality</Link>
      </nav>
      <span className="mode small muted">
        {live ? "Live extraction on" : "Samples only"}
        {persistent ? "" : ", data resets on restart"}
      </span>
    </header>
  );
}
