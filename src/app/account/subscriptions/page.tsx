import React from "react";
import Link from "next/link";
import { Layers, ArrowRight } from "lucide-react";

export const metadata = {
  title: "My Subscriptions — SEVOLF Digital",
  description: "Manage your ongoing seasonal publication memberships and digital subscriptions.",
};

export default function SubscriptionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-normal text-[#292B27]">
          Active Subscriptions
        </h2>
        <p className="text-xs text-[#77766E] mt-1">
          Seasonal edition passes and recurring digital tool memberships.
        </p>
      </div>

      <div className="p-8 border border-dashed border-[#DDD8CD] rounded-sm text-center space-y-4 bg-[#F5F2EB]/30">
        <Layers className="w-10 h-10 text-[#77766E] mx-auto" />
        <h3 className="font-serif text-xl text-[#292B27]">No active recurring subscriptions</h3>
        <p className="text-xs text-[#77766E] max-w-sm mx-auto">
          All your current products are one-time acquisitions with permanent lifetime access. Upcoming seasonal education subscriptions will appear here.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-[#657052] hover:underline"
        >
          <span>Explore standalone suites</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
