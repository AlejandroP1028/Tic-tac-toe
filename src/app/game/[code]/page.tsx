import OnlineGame from "@/components/OnlineGame";

export default async function GamePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <OnlineGame code={code.toUpperCase()} />;
}
