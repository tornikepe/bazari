import { InfoPageView, infoMetadata } from "@/components/layout/InfoPageView";

export const generateMetadata = () => infoMetadata("terms");

export default function Page() {
  return <InfoPageView slug="terms" />;
}
