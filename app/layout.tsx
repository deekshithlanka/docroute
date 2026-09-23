import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "DocRoute: construction document intake",
  description: "Upload supplier invoices, change orders and submittals. AI reads them, checks the math and the job number, and routes them to the right approver.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&display=swap"
        />
      </head>
      <body>
        <Nav live={Boolean(process.env.GEMINI_API_KEY)} persistent={Boolean(process.env.DATABASE_URL)} />
        <main>{children}</main>
      </body>
    </html>
  );
}
