import { LinkButton } from "@/components/ui/LinkButton";

// Handles notFound() raised inside the application, for example a room id that
// no longer exists. Rendered inside the app layout, so the header and the way
// back stay in place.
export default function AppNotFound() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm font-medium text-slate-500">404</p>
      <h1 className="text-lg font-semibold text-slate-900">Нічого не знайдено</h1>
      <p className="text-sm text-slate-600">
        Кімнати за цим посиланням немає — можливо, її видалили.
      </p>
      <LinkButton href="/" variant="primary">
        До списку кімнат
      </LinkButton>
    </div>
  );
}
