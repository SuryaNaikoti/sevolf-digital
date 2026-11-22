import { FileText, Eye, CheckCircle2, Globe, LayoutTemplate } from "lucide-react";
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
    <div className="space-y-4">
      {/* Unified Page Header */}
      <AdminPageHeader
        title="Store Content & CMS"
        subtitle="Manage storefront editorial sections, banners, announcements, and narrative copy."
        actions={
          <AdminButton
            variant="secondary"
            icon={Globe}
            onClick={undefined}
          >
            <Link href="/" target="_blank" className="flex items-center space-x-1.5">
              <span>View Online Store</span>
            </Link>
          </AdminButton>
        }
      />

      {/* Main Table Card */}
      <AdminCard
        title={`Configured Content Blocks (${sections.length})`}
        subtitle="Editorial sections rendered on customer storefront"
        padding={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E1E3E5] bg-[#FAFBFB] text-[#6D7175] font-medium">
                <th className="py-2.5 px-4">Section Name</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Identifier Key</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E3E5]">
              {sections.map((sec) => (
                <tr key={sec.key} className="hover:bg-[#F6F6F7]/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-[#202223]">
                    <div className="flex items-center space-x-2.5">
                      <LayoutTemplate className="w-4 h-4 text-[#6D7175]" />
                      <span>{sec.title}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#6D7175]">{sec.type}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-[#6D7175]">{sec.key}</td>
                  <td className="py-3 px-4">
                    <AdminStatusBadge variant="success">Active</AdminStatusBadge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href="/"
                      target="_blank"
                      className="inline-flex items-center space-x-1 text-[#008060] font-medium hover:underline text-xs"
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
