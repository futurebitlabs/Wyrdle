import { Suspense } from "react";
import { RoomClient } from "@/components/RoomClient";
import { WendClient } from "@/components/WendClient";
import { createServiceClient } from "@/lib/supabase/server";

async function RoomPageInner({ params, searchParams }: PageProps<"/room/[code]">) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  const query = await searchParams;
  const solo = query.solo === "1";

  const supabase = createServiceClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("game_type")
    .eq("code", code)
    .maybeSingle();

  if (room?.game_type === "wend") {
    return <WendClient code={code} solo={solo} />;
  }
  return <RoomClient code={code} solo={solo} />;
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
