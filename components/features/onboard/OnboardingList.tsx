import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { PendingUser } from '@/lib/onboarding';
import { PendingApprovalItem } from './PendingApprovalItem';

interface OnboardingListProps {
  canApprove: boolean;
  pending: PendingUser[];
}

const OnboardingList = ({ canApprove, pending }: OnboardingListProps) => {
  if (!canApprove) return null;

  return (
    pending.length !== 0 && (
      <Card>
        <CardHeader>
          <CardTitle>Pending approvals</CardTitle>
          <CardDescription>
            Users who completed onboarding and are waiting for admin or office
            approval.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
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
