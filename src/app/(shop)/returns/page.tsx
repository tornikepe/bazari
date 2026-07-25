import { InfoPageView, infoMetadata } from "@/components/layout/InfoPageView";

export const generateMetadata = () => infoMetadata("returns");

export default function Page() {
  return <InfoPageView slug="returns" />;
}
