import { InfoPageView, infoMetadata } from "@/app/components/about/InfoPageView";

export const generateMetadata = () => infoMetadata("methodologie");

export default function Page() {
  return <InfoPageView page="methodologie" />;
}
