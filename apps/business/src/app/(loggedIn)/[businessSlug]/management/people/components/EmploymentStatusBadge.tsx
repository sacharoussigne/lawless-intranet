import { Badge } from '@mantine/core';
import { apothecaryBooleanPills } from '@/lib/apothecaryPill';
import { formatRpDate } from '@/lib/rpCalendar';
import type { EmploymentStatus } from '@/lib/staff/types';

export function EmploymentStatusBadge({ status }: { status: EmploymentStatus }) {
  if (status.active) {
    return (
      <Badge variant="outline" radius="sm" style={apothecaryBooleanPills.yes}>
        Employé·e depuis le {formatRpDate(status.since, 'dd/MM/yyyy')}
      </Badge>
    );
  }
  if (status.leftAt) {
    return (
      <Badge variant="outline" radius="sm" style={apothecaryBooleanPills.craft}>
        Parti·e le {formatRpDate(status.leftAt, 'dd/MM/yyyy')}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" radius="sm" style={apothecaryBooleanPills.no}>
      Jamais embauché·e
    </Badge>
  );
}
