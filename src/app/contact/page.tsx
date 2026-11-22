"use client";

import React, { useState } from "react";
import { Mail, MessageSquare, Send, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "support", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.email && formData.message) {
      setSubmitted(true);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-20">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10 text-center">
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
            CLIENT ASSISTANCE
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
            Connect With SEVOLF
          </h1>
          <p className="text-sm md:text-base text-[#77766E] leading-relaxed max-w-lg mx-auto font-sans">
            Need support with a digital download, require classroom licensing, or have questions about a specific toolkit? We are here to help.
          </p>
        </div>

        <div className="bg-white border border-[#DDD8CD] rounded-sm p-8 md:p-12 shadow-xs">
          {submitted ? (
            <div className="py-12 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-[#657052] mx-auto" />
              <h3 className="font-serif text-2xl text-[#292B27]">Thank you for reaching out</h3>
              <p className="text-sm text-[#77766E] max-w-md mx-auto">
                Your message has been safely received. A member of our editorial support team will respond within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#292B27] mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-3 text-sm text-[#292B27] focus:outline-none focus:border-[#657052] rounded-xs"
                    placeholder="E.g. Elena Rostova"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#292B27] mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-3 text-sm text-[#292B27] focus:outline-none focus:border-[#657052] rounded-xs"
                    placeholder="elena@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#292B27] mb-2">
                  Topic of Inquiry
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-3 text-sm text-[#292B27] focus:outline-none focus:border-[#657052] rounded-xs cursor-pointer"
                >
                  <option value="support">Digital Download & Library Assistance</option>
                  <option value="licensing">Classroom & Commercial Licensing</option>
                  <option value="feedback">Product Feedback & Suggestions</option>
                  <option value="other">General Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#292B27] mb-2">
                  Message
                </label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-[#F5F2EB]/50 border border-[#DDD8CD] px-4 py-3 text-sm text-[#292B27] focus:outline-none focus:border-[#657052] rounded-xs"
                  placeholder="How can we assist you?"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#292B27] hover:bg-[#657052] text-white py-4 px-6 text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-colors rounded-sm"
              >
                <Send className="w-4 h-4" />
                <span>Submit Inquiry</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
