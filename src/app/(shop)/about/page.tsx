import { InfoPageView, infoMetadata } from "@/components/layout/InfoPageView";

export const generateMetadata = () => infoMetadata("about");

export default function Page() {
  return <InfoPageView slug="about" />;
}
