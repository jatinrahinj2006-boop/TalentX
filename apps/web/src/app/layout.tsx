// apps/web/src/app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "TalentX AI — Enterprise Recruiter Intelligence Platform",
  description: "Multi-agent AI resume screening with evidence-grounded candidate match scores",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@400,0&display=swap"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
