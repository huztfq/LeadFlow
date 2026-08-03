import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="lf-mkt">
      <MarketingHeader />
      {children}
      <MarketingFooter />
    </div>
  );
}
