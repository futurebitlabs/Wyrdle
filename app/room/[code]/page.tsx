import { Suspense } from "react";
import { RoomClient } from "@/components/RoomClient";

async function RoomPageInner({ params }: PageProps<"/room/[code]">) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase()} />;
}

export default function RoomPage(props: PageProps<"/room/[code]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-background text-foreground">
          Loading…
        </div>
      }
    >
      <RoomPageInner {...props} />
    </Suspense>
  );
}
