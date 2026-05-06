import { Badge, type badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import type { CostTag } from '../types/cost';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

const COLOR_VARIANT_MAP: Record<string, BadgeVariant> = {
  red: 'red',
  orange: 'amber',
  yellow: 'amber',
  green: 'green',
  blue: 'blue',
  purple: 'purple',
  pink: 'red',
  brown: 'amber',
  gray: 'gray',
};

function getVariant(color: string): BadgeVariant {
  return COLOR_VARIANT_MAP[color] ?? 'gray';
}

interface TagBadgeProps {
  tag: CostTag;
  className?: string;
}

export default function TagBadge({ tag, className }: TagBadgeProps) {
  return (
    <Badge variant={getVariant(tag.color)} className={className}>
      {tag.name}
    </Badge>
  );
}
