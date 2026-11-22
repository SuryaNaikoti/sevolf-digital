export type ProductFormat = 
  | "pdf" 
  | "zip" 
  | "template" 
  | "digital_resource" 
  | "interactive_app" 
  | "bundle" 
  | "subscription";

export type PublicationStatus = "draft" | "published" | "archived";

export interface ProductMedia {
  id: string;
  url: string;
  alt: string;
  type: "cover" | "mockup" | "gallery" | "preview";
  width?: number;
  height?: number;
}

export interface EducationalMeta {
  ageRange?: string;
  learningObjectives?: string[];
  pagesIncluded?: number;
  language?: string;
  printingInstructions?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  shortDescription: string;
  fullDescription: string;
  category: "home-living" | "kids-education" | "productivity" | "business";
  categoryLabel: string;
  productType: string;
  format: ProductFormat;
  formatLabel: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  coverImage: string;
  galleryImages: string[];
  mockupImages: string[];
  features: string[];
  whatsIncluded: string[];
  requirements: string[];
  licenceType: "personal" | "commercial" | "extended";
  licenceDescription: string;
  status: PublicationStatus;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  isBestseller?: boolean;
  isBundle?: boolean;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  educationalMeta?: EducationalMeta;
  keyBenefits?: string[];
  specifications?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  image: string;
  featuredProductCount: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
