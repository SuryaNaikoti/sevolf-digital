"use client";

import React, { useState } from "react";
import { CheckCircle2, User, KeyRound } from "lucide-react";

export default function ProfilePage() {
  const [name, setName] = useState("Valued Patron");
  const [email, setEmail] = useState("patron@example.com");
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h2 className="font-serif text-2xl font-normal text-[#292B27]">
          Personal Profile & Preferences
        </h2>
        <p className="text-xs text-[#77766E] mt-1">
          Manage your contact credentials and notification choices.
        </p>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Profile changes updated successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#292B27] mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-2.5 text-sm text-[#292B27] rounded-xs focus:outline-none focus:border-[#657052]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#292B27] mb-1.5">
            Registered Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-2.5 text-sm text-[#292B27] rounded-xs focus:outline-none focus:border-[#657052]"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            className="bg-[#292B27] hover:bg-[#657052] text-white px-6 py-2.5 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
