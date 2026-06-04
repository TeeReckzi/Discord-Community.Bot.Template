import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Aethoria's Keep Dashboard",
  description: 'Manage your Discord server with Aethoria Bot',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
