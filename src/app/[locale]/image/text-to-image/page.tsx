import { landingMetadata, LocalizedLanding } from "../../../../features/landing-pages/localized-landing";
type Props = { params: Promise<{ locale:string }> };
export async function generateMetadata({params}:Props) { return landingMetadata((await params).locale,"text-image"); }
export default async function Page({params}:Props) { return <LocalizedLanding locale={(await params).locale} kind="text-image" />; }
