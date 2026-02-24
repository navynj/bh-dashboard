import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { PendingUser } from '@/features/onboard/utils/onboarding';
import { PendingApprovalItem } from './PendingApprovalItem';

interface OnboardingListProps {
  canApprove: boolean;
  pending: PendingUser[];
}

const OnboardingList = ({ canApprove, pending }: OnboardingListProps) => {
  if (!canApprove) return null;

  return (
    pending.length !== 0 && (
      <Card className="bg-yellow-50 border-yellow-300 flex flex-col gap-4 justify-between gap-4">
        <CardHeader className="flex-1 grid-rows-[auto_1fr]">
          <CardTitle>Pending approvals</CardTitle>
          <CardDescription>
            Users who completed onboarding and are waiting for admin or office
            approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border gap-2 flex flex-wrap">
            {pending.map((user) => (
              <PendingApprovalItem key={user.id} user={user} />
            ))}
          </ul>
        </CardContent>
      </Card>
    )
  );
};

export default OnboardingList;
