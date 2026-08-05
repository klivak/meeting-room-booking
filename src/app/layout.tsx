import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { JetBrains_Mono, Manrope } from "next/font/google";

import { THEME_SCRIPT } from "@/components/themeScript";
import { env } from "@/lib/server/env";

import "./globals.css";

// Manrope draws Cyrillic as a first-class script: at the 11-12px used on the
// grid axis and inside booking blocks, a font whose "Щ" and "ґ" are narrower
// than its Latin costs real legibility.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  // "swap" rather than "block": blocking hid every word until the font arrived,
  // which on a throttled phone was 2.6s of blank screen and the whole of the
  // largest-contentful-paint. next/font builds a fallback whose metrics are
  // adjusted to match, so the swap costs no measurable layout shift — which was
  // the reason to block in the first place.
  display: "swap",
  preload: true,
});

// Times, dates and counters only line up in a column with tabular figures.
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "cyrillic"],
  display: "swap",
  preload: true,
});

// The browser chrome on a phone takes the brand jade rather than the default
// white, so the app does not end below a strip of someone else's colour.
export const viewport: Viewport = {
  themeColor: "#0d8460",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  const locale = await getLocale();

  // The social preview carries the headline as baked-in text, so it has to
  // follow the language the visitor is reading the app in.
  const image = {
    url: locale === "uk" ? "/og-uk.jpg" : "/og-en.jpg",
    width: 1200,
    height: 630,
    alt: t("description"),
  };

  return {
    // og:image must be absolute; without a base Next leaves it relative and the
    // card silently does not render.
    metadataBase: new URL(env.SITE_URL),
    // Every page fills in the template, so the tab always says where you are.
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
    // Neither block states a title or a description: left out, Next fills them
    // from the resolved title and description of the page being rendered, and a
    // shared link then says which page it points at instead of always naming the
    // application.
    openGraph: {
      type: "website",
      locale: locale === "uk" ? "uk_UA" : "en_US",
      siteName: t("title"),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      images: [image],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The language decides both the markup attribute and the messages the client
  // components receive, so it is resolved once here.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      // Light until the script above says otherwise; without it the very first
      // paint of a dark-theme user would be white.
      data-theme="light"
      className={`${manrope.variable} ${jetBrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Allowed by its hash in the policy, not by a nonce: browsers blank
            the nonce attribute once the policy is applied, and React then reads
            "" on the client where the server wrote a value and reports a
            hydration mismatch on every page. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-surface-sunken text-text-primary flex min-h-full flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
