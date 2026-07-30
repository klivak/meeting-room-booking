import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { JetBrains_Mono, Manrope } from "next/font/google";

import { THEME_STORAGE_KEY } from "@/components/theme";

import "./globals.css";

// Manrope draws Cyrillic as a first-class script: at the 11-12px used on the
// grid axis and inside booking blocks, a font whose "Щ" and "ґ" are narrower
// than its Latin costs real legibility.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  // Not "swap": a font that arrives after the first paint shifts every label on
  // the grid, and the grid is the whole screen.
  display: "block",
  preload: true,
});

// Times, dates and counters only line up in a column with tabular figures.
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "cyrillic"],
  display: "block",
  preload: true,
});

// Resolves the stored preference before the first paint, so switching to the
// dark theme and reloading does not flash a white page.
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");

  return {
    // Every page fills in the template, so the tab always says where you are.
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
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
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="bg-surface-sunken text-text-primary flex min-h-full flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
