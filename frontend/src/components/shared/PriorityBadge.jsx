import { cn, PRIORITY_COLORS } from '@/lib/utils';

export function PriorityBadge({ priority }) {
  return (
    <span
      className={cn(
        'px-2 py-1 rounded-full text-xs font-medium',
        PRIORITY_COLORS[priority] || 'bg-gray-100 text-gray-600'
      )}
    >
      {priority}
    </span>
  );
}
