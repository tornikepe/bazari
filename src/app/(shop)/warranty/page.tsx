import { InfoPageView, infoMetadata } from "@/components/layout/InfoPageView";

export const generateMetadata = () => infoMetadata("warranty");

export default function Page() {
  return <InfoPageView slug="warranty" />;
}
