import { InfoPageView, infoMetadata } from "@/app/components/about/InfoPageView";

export const generateMetadata = () => infoMetadata("contact");

export default function Page() {
  return <InfoPageView page="contact" />;
}
