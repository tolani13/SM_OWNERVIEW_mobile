import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'Paid' | 'Unpaid' | 'Partial' | 'Upcoming' | 'In Progress' | 'Completed';
  size?: 'sm' | 'md';
}

export const StatusBadge = ({ status, size = 'md' }: StatusBadgeProps) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'Paid':
      case 'Completed':
        return 'bg-success/10 text-success border-success/20';
      case 'Unpaid':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'Partial':
      case 'In Progress':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'Upcoming':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <span className={cn(
      'inline-flex items-center rounded-full border font-medium',
      getStatusStyles(),
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
    )}>
      {status}
    </span>
  );
};
