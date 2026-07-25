import { InfoPageView, infoMetadata } from "@/components/layout/InfoPageView";

export const generateMetadata = () => infoMetadata("faq");

export default function Page() {
  return <InfoPageView slug="faq" />;
}
