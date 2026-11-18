import { InfoPageView, infoMetadata } from "@/app/components/about/InfoPageView";

export const generateMetadata = () => infoMetadata("a-propos");

export default function Page() {
  return <InfoPageView page="a-propos" />;
}
