"use client";

// Last line of defence: catches a failure in the root layout itself, where no
// other boundary is mounted yet. It therefore has to render its own document
// and cannot use the shared components or styles.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="uk">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "3rem 1.5rem",
          color: "#0f172a",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
          Застосунок не вдалося завантажити · The application could not start
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#475569", margin: 0 }}>
          Спробуйте оновити сторінку і перевірте базу даних · Try reloading the page and check the database
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            borderRadius: "0.5rem",
            border: "none",
            background: "#0f172a",
            color: "white",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Спробувати ще раз · Try again
        </button>
      </body>
    </html>
  );
}
