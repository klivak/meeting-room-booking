import { notFound } from "next/navigation";

import { prisma } from "@/lib/server/db";

// Placeholder for the weekly schedule grid, which arrives in a later stage.
export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const room = await prisma.room.findUnique({ where: { id } });

  if (!room) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">{room.name}</h1>
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Тижневий розклад цієї кімнати зʼявиться на наступному етапі.
      </p>
    </div>
  );
}
