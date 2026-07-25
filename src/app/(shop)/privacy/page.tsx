import { InfoPageView, infoMetadata } from "@/components/layout/InfoPageView";

export const generateMetadata = () => infoMetadata("privacy");

export default function Page() {
  return <InfoPageView slug="privacy" />;
}
