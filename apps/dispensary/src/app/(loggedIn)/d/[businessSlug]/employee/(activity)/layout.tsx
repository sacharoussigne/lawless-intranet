import { EmployeeSectionTabs } from '@/app/_components/SectionTabs/EmployeeSectionTabs';

/** Pages of this section keep their URL; the tabs link them together. */
export default function ActivitySectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EmployeeSectionTabs section="activity" />
      {children}
    </>
  );
}
