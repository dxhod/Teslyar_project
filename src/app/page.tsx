import { Dashboard } from "@/components/Dashboard";
import { getDashboardData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function Home() {
  const data = getDashboardData();

  return <Dashboard data={data} />;
}
