import { Suspense } from "react";
import { PaymentInstructions } from "@/components/PaymentInstructions";

async function PaymentPageContent({
  params,
  searchParams,
}: {
  params: Promise<{ referenceId: string }>;
  searchParams: Promise<{ refresh?: string }>;
}) {
  const { referenceId } = await params;
  const sp = await searchParams;
  return (
    <PaymentInstructions
      referenceId={decodeURIComponent(referenceId)}
      initialRefresh={sp.refresh === "1" || sp.refresh === "true"}
    />
  );
}

export default function PayDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ referenceId: string }>;
  searchParams: Promise<{ refresh?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto py-16 text-center text-sm text-[#526071]">
          Menyiapkan halaman instruksi pembayaran...
        </div>
      }
    >
      <PaymentPageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
