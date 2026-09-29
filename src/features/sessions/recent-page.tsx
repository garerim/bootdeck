import { History } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Page, PageHeader } from "@/components/layout/page";

export function RecentPage() {
  return (
    <Page width="narrow" header={<PageHeader title="Recent" description="Your latest launches" />}>
      <EmptyState
        icon={History}
        title="No launches yet"
        description="Each time you launch a preset, it appears here with the status of every item."
      />
    </Page>
  );
}
