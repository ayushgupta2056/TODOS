import { requireStudio } from "@/lib/auth";
import { BrandForm } from "./brand-form";

export const metadata = { title: "Brand" };

export default async function BrandPage() {
  const studio = await requireStudio();
  const custom = studio.plan === "pro" || studio.plan === "studio";
  return (
    <div className="mx-auto grid max-w-3xl gap-10 px-4 py-8 sm:px-8 lg:py-12">
      <div className="grid gap-2">
        <p className="eyebrow">Brand</p>
        <h1 className="font-display text-display-md">How guests see you</h1>
      </div>
      <BrandForm name={studio.name} color={studio.brand_color} custom={custom} />
    </div>
  );
}
