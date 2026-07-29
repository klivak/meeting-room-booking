import Link from "next/link";

// The frame shared by sign-in and registration: one narrow column in the middle
// of an otherwise empty screen, because there is nothing else to look at and
// nothing else to do here.
export function AuthCard({
  title,
  subtitle,
  footerText,
  footerLinkHref,
  footerLinkText,
  children,
}: {
  title: string;
  subtitle: string;
  footerText: string;
  footerLinkHref: string;
  footerLinkText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full w-full items-center justify-center px-4 py-12">
      <div className="bg-surface border-border-grid rounded-panel shadow-panel flex w-full max-w-[376px] flex-col gap-4 border px-7 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-text-tertiary text-[13px] leading-relaxed">{subtitle}</p>
        </div>

        {children}

        <p className="text-text-tertiary text-center text-[13px] leading-relaxed">
          {footerText}{" "}
          <Link href={footerLinkHref} className="text-link">
            {footerLinkText}
          </Link>
        </p>
      </div>
    </div>
  );
}
