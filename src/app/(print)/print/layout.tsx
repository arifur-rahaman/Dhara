import { AutoPrint } from '@/features/print/auto-print';

/** Print pages (always light, TECH_GUIDE section 14). */
export default function PrintLayout({ children }: LayoutProps<'/print'>) {
  return (
    <>
      <AutoPrint />
      {children}
    </>
  );
}
