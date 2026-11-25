import { Suspense } from "react";
import { CheckoutReturnClient } from "@/components/CheckoutReturnClient";

export default function CheckoutReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto py-16 text-center text-sm text-[#526071]">
          Memuat status pengembalian checkout...
        </div>
      }
    >
      <CheckoutReturnClient />
    </Suspense>
  );
}
