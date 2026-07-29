"use client";

// Last line of defence: catches a failure in the root layout itself, where no
// other boundary is mounted yet. It therefore has to render its own document
// and cannot use the shared components, tokens or fonts — none of them exist at
// this point. Both languages are printed because the dictionary is gone too.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uk">
      <body
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: "0.75rem",
          margin: 0,
          padding: "3rem 1.5rem",
          background: "#fff",
          color: "#111",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
          Застосунок не завантажився · The application did not start
        </h1>
        <p style={{ fontSize: "0.9375rem", lineHeight: 1.5, margin: 0, maxWidth: "48ch" }}>
          Перезавантажте сторінку — найчастіше цього достатньо. Ваші бронювання в безпеці.
          <br />
          Reload the page — that is usually enough. Your bookings are safe.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: "2px solid #111",
            background: "transparent",
            color: "#111",
            font: "inherit",
            fontWeight: 700,
            padding: "0.5rem 0.875rem",
            cursor: "pointer",
          }}
        >
          Перезавантажити · Reload
        </button>
        {/* The digest is what a support request can be searched by. */}
        {error.digest ? (
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.75rem",
              color: "#555",
              margin: 0,
            }}
          >
            error id: {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  );
}
