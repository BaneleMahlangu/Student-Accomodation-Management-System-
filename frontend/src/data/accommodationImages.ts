export interface AccommodationImage {
  url: string;
  category: string;
  caption: string;
}

export interface RoomImageSource {
  id?: number;
  image: string;
  caption?: string;
  display_order?: number;
}

interface PropertyImageFamily {
  accommodationCategory: string;
  accommodationCaption: string;
  facilityCategory: string;
  facilityCaption: string;
}

// Local image families keep each residence visually distinct. The first
// family has a coordinated three-bedroom gallery for its shared residence.
const propertyImageFamilies: PropertyImageFamily[] = [
  { accommodationCategory: "Accommodation", accommodationCaption: "Three-bedroom shared student residence", facilityCategory: "Study Area", facilityCaption: "Shared library and study tables" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student room with bed and study desk", facilityCategory: "Study Area", facilityCaption: "Student computer study room" },
  { accommodationCategory: "Exterior", accommodationCaption: "Student residence apartments", facilityCategory: "Study Area", facilityCaption: "Study desk and computer" },
  { accommodationCategory: "Exterior", accommodationCaption: "University student housing building", facilityCategory: "Study Area", facilityCaption: "Residence bookshelf and study corner" },
  { accommodationCategory: "Exterior", accommodationCaption: "Modern brick apartment building", facilityCategory: "Study Area", facilityCaption: "Residence library shelving" },
  { accommodationCategory: "Exterior", accommodationCaption: "Contemporary student residence buildings", facilityCategory: "Study Area", facilityCaption: "Student desk and study area" },
  { accommodationCategory: "Exterior", accommodationCaption: "Modern accommodation building", facilityCategory: "Study Area", facilityCaption: "Quiet study room" },
  { accommodationCategory: "Exterior", accommodationCaption: "University residence exterior", facilityCategory: "Study Area", facilityCaption: "Student study workspace" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student accommodation interior", facilityCategory: "Kitchen", facilityCaption: "Shared residence kitchen" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student accommodation interior", facilityCategory: "Kitchen", facilityCaption: "Shared residence kitchen" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student residence interior", facilityCategory: "Dining", facilityCaption: "Shared kitchen and dining area" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student residence interior", facilityCategory: "Kitchen", facilityCaption: "Shared residence kitchen" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student residence interior", facilityCategory: "Kitchen", facilityCaption: "Communal cooking facilities" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student residence interior", facilityCategory: "Kitchen", facilityCaption: "Shared residence kitchen" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student residence interior", facilityCategory: "Kitchen", facilityCaption: "Residence kitchen interior" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student residence interior", facilityCategory: "Kitchen", facilityCaption: "Shared residence kitchen" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student residence interior", facilityCategory: "Dining", facilityCaption: "Shared dining space" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student residence interior", facilityCategory: "Kitchen", facilityCaption: "Shared residence kitchen" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student residence interior", facilityCategory: "Kitchen", facilityCaption: "Shared residence kitchen" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student residence interior", facilityCategory: "Kitchen", facilityCaption: "Shared residence kitchen" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student residence interior", facilityCategory: "Kitchen", facilityCaption: "Shared residence kitchen" },
  { accommodationCategory: "Accommodation", accommodationCaption: "Student residence interior", facilityCategory: "Kitchen", facilityCaption: "Shared residence kitchen" },
];

function getPropertyFamilyNumber(propertyId: number): number {
  return (Math.abs(propertyId - 1) % propertyImageFamilies.length) + 1;
}

function getPropertyImageFamily(propertyId: number): PropertyImageFamily {
  return propertyImageFamilies[getPropertyFamilyNumber(propertyId) - 1];
}

function localPropertyImage(familyNumber: number, suffix: string): string {
  return resolveAccommodationImage(`/media/properties/interiors/property-${familyNumber}-${suffix}.jpg`);
}

export const ACCOMMODATION_IMAGE_LIBRARY: AccommodationImage[] = [
  { url: resolveAccommodationImage("/media/properties/BloemCentral.jfif"), category: "Accommodation", caption: "Bloem Central student residence" },
  { url: resolveAccommodationImage("/media/properties/CampusView.jfif"), category: "Accommodation", caption: "Campus View student residence" },
  { url: resolveAccommodationImage("/media/properties/CityEdge.jfif"), category: "Accommodation", caption: "City Edge student residence" },
  { url: resolveAccommodationImage("/media/properties/FreeState_SH.jfif"), category: "Accommodation", caption: "Free State student housing" },
  { url: resolveAccommodationImage("/media/properties/NorthernCape_SV.jfif"), category: "Accommodation", caption: "Northern Cape student village" },
  { url: resolveAccommodationImage("/media/properties/VarsityHeights.jfif"), category: "Accommodation", caption: "Varsity Heights student residence" },
  { url: resolveAccommodationImage("/media/properties/Metro_Student_Suites.-_Acc.jpg"), category: "Accommodation", caption: "Metro Student Suites" },
];

export function getFallbackPropertyImages(propertyId: number, count = 3): AccommodationImage[] {
  const familyNumber = getPropertyFamilyNumber(propertyId);
  const family = getPropertyImageFamily(propertyId);
  const images: AccommodationImage[] = [
    {
      url: localPropertyImage(familyNumber, "accommodation"),
      category: family.accommodationCategory,
      caption: family.accommodationCaption,
    },
    {
      url: localPropertyImage(familyNumber, "room-detail"),
      category: "Room",
      caption: "Bedroom interior with student study space",
    },
    {
      url: localPropertyImage(familyNumber, "facility"),
      category: family.facilityCategory,
      caption: family.facilityCaption,
    },
  ];
  return images.slice(0, Math.max(0, count));
}

export function getFallbackRoomImages(propertyId: number): AccommodationImage[] {
  const familyNumber = getPropertyFamilyNumber(propertyId);
  if (familyNumber === 1) {
    return [
      { url: localPropertyImage(1, "room-detail"), category: "Room", caption: "Bedroom one in the shared three-bedroom residence" },
      { url: localPropertyImage(1, "room-detail-2"), category: "Room", caption: "Bedroom two in the shared three-bedroom residence" },
      { url: localPropertyImage(1, "room-detail-3"), category: "Room", caption: "Bedroom three in the shared three-bedroom residence" },
    ];
  }

  return [
    { url: localPropertyImage(familyNumber, "room-detail"), category: "Room", caption: "Bedroom interior with student study space" },
  ];
}

export function getFallbackRoomImage(propertyId: number, roomId: number): AccommodationImage {
  const images = getFallbackRoomImages(propertyId);
  return images[Math.abs(roomId - 1) % images.length];
}

/** Return the canonical gallery for a room, shared by every room preview and detail view. */
export function getRoomGalleryImages(
  propertyId: number,
  roomId: number,
  roomImages: RoomImageSource[] = [],
): AccommodationImage[] {
  const suppliedImages = roomImages
    .filter((image) => !isTemporaryPexelsCaption(image.caption))
    .slice()
    .sort((a, b) =>
      (a.display_order ?? 0) - (b.display_order ?? 0)
      || (a.id ?? 0) - (b.id ?? 0)
    );

  if (suppliedImages.length > 0) {
    return suppliedImages.map((image) => ({
      url: resolveAccommodationImage(image.image),
      category: "Room",
      caption: cleanAccommodationCaption("ROOM", image.caption),
    }));
  }

  return [getFallbackRoomImage(propertyId, roomId)];
}

export function cleanAccommodationCaption(category: string, caption?: string): string {
  if (caption && !/^temporary pexels\b/i.test(caption.trim())) {
    return caption.trim().replace(/^Student Haven demo image:\s*/i, "");
  }
  switch (category.toUpperCase()) {
    case "ROOM": return "Student room interior";
    case "STUDY": return "Shared study area";
    case "KITCHEN": return "Shared residence kitchen";
    case "DINING": return "Shared dining area";
    case "LAUNDRY": return "Residence laundry facilities";
    case "ACCOMMODATION": return "Student accommodation interior";
    default: return "Student residence facilities";
  }
}

export function isTemporaryPexelsCaption(caption?: string): boolean {
  return Boolean(caption && /^temporary pexels\b/i.test(caption.trim()));
}

export function resolveAccommodationImage(imageUrl: string): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;

  const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
  const apiBaseUrl = rawApiBaseUrl.endsWith("/") ? rawApiBaseUrl.slice(0, -1) : rawApiBaseUrl;
  const mediaBaseUrl = apiBaseUrl.toLowerCase().endsWith("/api") ? apiBaseUrl.slice(0, -4) : apiBaseUrl;
  return `${mediaBaseUrl}${imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`}`;
}

export function getPropertyGallery(property: {
  id: number;
  images?: Array<{
    image: string;
    category?: string;
    caption?: string;
    display_order?: number;
  }>;
}): AccommodationImage[] {
  const suppliedImages = property.images?.filter((image) =>
    !isTemporaryPexelsCaption(image.caption)
    && (image.category || "").toUpperCase() !== "OTHER"
  ) ?? [];
  if (suppliedImages.length > 0) {
    return [...suppliedImages]
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((image) => ({
        url: resolveAccommodationImage(image.image),
        category: image.category || "Accommodation",
        caption: cleanAccommodationCaption(image.category || "Accommodation", image.caption),
      }));
  }
  return getFallbackPropertyImages(property.id);
}

export function getPrimaryPropertyImage(property: {
  id: number;
  images?: Array<{ image: string; category?: string; caption?: string; display_order?: number; is_primary?: boolean }>;
}): string {
  const suppliedImages = property.images
    ?.filter((image) => !isTemporaryPexelsCaption(image.caption))
    .slice()
    .sort((a, b) => {
      const rank = (category?: string) => {
        switch ((category || "").toUpperCase()) {
          case "EXTERIOR": return 0;
          case "ACCOMMODATION": return 1;
          case "ENTRANCE": return 2;
          case "ROOM": return 3;
          case "RECEPTION": return 4;
          case "LOUNGE": return 5;
          case "STUDY": return 6;
          case "DINING": return 7;
          case "KITCHEN": return 8;
          case "BATHROOM": return 9;
          case "OTHER": return 11;
          default: return 10;
        }
      };
      return rank(a.category) - rank(b.category)
        || Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary))
        || (a.display_order ?? 0) - (b.display_order ?? 0);
    }) ?? [];
  const suppliedImage = suppliedImages.find((image) => (image.category || "").toUpperCase() !== "OTHER");
  return suppliedImage
    ? resolveAccommodationImage(suppliedImage.image)
    : getFallbackPropertyImages(property.id, 1)[0].url;
}
