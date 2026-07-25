import { InfoPageView, infoMetadata } from "@/components/layout/InfoPageView";

export const generateMetadata = () => infoMetadata("contact");

export default function Page() {
  return <InfoPageView slug="contact" />;
}
