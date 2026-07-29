import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Picaso Token — Collateralised NFT Positions",
  description:
    "Deposit an ERC20 to mint a position NFT; burn it to redeem through Bancor. Unaudited demonstration contract.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
        {/* Applies the stored choice before first paint. Without this the page
            renders at the OS preference and then snaps to the chosen theme —
            a flash of the wrong sheet on every load. Deliberately tiny and
            inline: an external script would still be a round trip too late.
            Key must match THEME_STORAGE_KEY in ThemeToggle. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("picaso-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
