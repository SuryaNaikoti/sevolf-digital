import { FileText, Eye, Globe, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import {
  AdminPageHeader,
  AdminCard,
  AdminButton,
  AdminStatusBadge,
} from "@/components/admin/ui/AdminComponents";

export default function AdminContentPage() {
  const sections = [
    { key: "hero_banner", title: "Homepage Hero Section", type: "Hero Banner", status: "Published" },
    { key: "featured_collection", title: "Curated Kids Education & Home Living", type: "Collection Showcase", status: "Published" },
    { key: "brand_ethos", title: "Editorial Studio Philosophy & Manifesto", type: "Story Section", status: "Published" },
    { key: "announcement_bar", title: "Studio Launch Announcement Bar", type: "Top Banner", status: "Published" },
    { key: "footer_manifesto", title: "Global Studio Navigation & Legal Disclaimers", type: "Footer", status: "Published" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        title="Store Content & CMS"
        subtitle="Manage storefront editorial sections, banners, announcements, and narrative brand copy."
        actions={
          <Link href="/" target="_blank">
            <AdminButton variant="secondary" icon={Globe}>
              View Online Store
            </AdminButton>
          </Link>
        }
      />

      {/* Main Table Card */}
      <AdminCard
        title={`Configured Editorial Blocks (${sections.length})`}
        subtitle="Dynamic CMS sections rendered across customer storefront"
        padding={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E8E5DD] bg-[#FAF8F5] text-[#85847D] font-mono uppercase text-[10px] tracking-wider">
                <th className="py-3 px-5">Section Title</th>
                <th className="py-3 px-5">Type</th>
                <th className="py-3 px-5">Identifier Key</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E5DD]">
              {sections.map((sec) => (
                <tr key={sec.key} className="hover:bg-[#FAF8F5] transition-colors">
                  <td className="py-3.5 px-5 font-medium text-[#22231F]">
                    <div className="flex items-center space-x-2.5">
                      <LayoutTemplate className="w-4 h-4 text-[#85866A]" />
                      <span>{sec.title}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-5 text-[#85847D]">{sec.type}</td>
                  <td className="py-3.5 px-5 font-mono text-[11px] text-[#85847D]">{sec.key}</td>
                  <td className="py-3.5 px-5">
                    <AdminStatusBadge variant="success">Active</AdminStatusBadge>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <Link
                      href="/"
                      target="_blank"
                      className="inline-flex items-center space-x-1 text-[#85866A] font-mono uppercase text-[11px] tracking-wider hover:text-[#22231F] hover:underline"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}
