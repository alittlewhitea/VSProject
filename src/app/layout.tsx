import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { loadMessages } from "../i18n/messages";
import { defaultLocale, isLocale } from "../i18n/routing";

export const metadata: Metadata = {
  title: {
    default: "DreamFace AI Image and Video Generator",
    template: "%s | DreamFace"
  },
  description:
    "DreamFace is an AI creative studio for text-to-image, image-to-image, and text-to-video generation with routed models, prompt references, credits, billing, and creation history.",
  keywords: [
    "DreamFace",
    "AI image generator",
    "AI video generator",
    "AI creative studio",
    "text to image",
    "image to image",
    "text to video",
    "AI image editing",
    "prompt gallery",
    "GPT Image 2",
    "Nano Banana 2",
    "FLUX Schnell"
  ],
  openGraph: {
    title: "DreamFace AI Image and Video Generator",
    description:
      "Create AI images and videos with text-to-image, image-to-image, text-to-video, model routing, credits, and organized creation history.",
    type: "website",
    siteName: "DreamFace"
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/dreamface-favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/favicon-64x64.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/favicon-128x128.png", sizes: "128x128", type: "image/png" },
      { url: "/icons/favicon-256x256.png", sizes: "256x256", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestLocale = headers().get("x-dreamface-locale");
  const locale = isLocale(requestLocale) ? requestLocale : defaultLocale;
  const messages = await loadMessages(locale);

  return (
    <html lang={locale}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WG68M9NW');"
          }}
        />
      </head>
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WG68M9NW"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
