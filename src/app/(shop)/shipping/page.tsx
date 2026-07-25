import { InfoPageView, infoMetadata } from "@/components/layout/InfoPageView";

export const generateMetadata = () => infoMetadata("shipping");

export default function Page() {
  return <InfoPageView slug="shipping" />;
}
