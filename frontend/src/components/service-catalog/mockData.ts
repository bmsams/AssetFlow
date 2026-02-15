/**
 * Mock data for the Service Catalog
 * Used for development and testing
 * Implements Requirements 6B.1, 6B.2: Service catalog with items and categories
 */

import type { CatalogItem, CategoryInfo, CatalogCategory } from '../../types/service-catalog';

/**
 * Mock catalog items
 */
export const mockCatalogItems: CatalogItem[] = [
  // Laptops
  {
    itemId: 'cat-001',
    name: 'MacBook Pro 16" M3 Max',
    description: 'High-performance laptop for developers and creative professionals. Features the latest M3 Max chip with 36GB unified memory.',
    category: 'LAPTOPS',
    manufacturer: 'Apple',
    model: 'MacBook Pro 16" (2024)',
    imageUrl: '/images/catalog/macbook-pro-16.jpg',
    price: 3499,
    availability: 'IN_STOCK',
    stockQuantity: 15,
    leadTimeDays: 0,
    specifications: {
      'Processor': 'Apple M3 Max',
      'Memory': '36GB Unified',
      'Storage': '512GB SSD',
      'Display': '16.2" Liquid Retina XDR',
      'Battery': 'Up to 22 hours',
    },
    tags: ['developer', 'creative', 'high-performance'],
    isPopular: true,
    isFeatured: true,
  },
  {
    itemId: 'cat-002',
    name: 'Dell Latitude 5540',
    description: 'Business-class laptop with enterprise security features and long battery life. Ideal for corporate users.',
    category: 'LAPTOPS',
    manufacturer: 'Dell',
    model: 'Latitude 5540',
    imageUrl: '/images/catalog/dell-latitude-5540.jpg',
    price: 1299,
    availability: 'IN_STOCK',
    stockQuantity: 42,
    leadTimeDays: 0,
    specifications: {
      'Processor': 'Intel Core i7-1365U',
      'Memory': '16GB DDR5',
      'Storage': '512GB SSD',
      'Display': '15.6" FHD',
      'Battery': 'Up to 12 hours',
    },
    tags: ['business', 'enterprise', 'security'],
    isPopular: true,
  },
  {
    itemId: 'cat-003',
    name: 'ThinkPad X1 Carbon Gen 11',
    description: 'Ultra-lightweight business laptop with military-grade durability and exceptional keyboard.',
    category: 'LAPTOPS',
    manufacturer: 'Lenovo',
    model: 'ThinkPad X1 Carbon Gen 11',
    imageUrl: '/images/catalog/thinkpad-x1-carbon.jpg',
    price: 1849,
    availability: 'LOW_STOCK',
    stockQuantity: 5,
    leadTimeDays: 3,
    specifications: {
      'Processor': 'Intel Core i7-1365U',
      'Memory': '32GB LPDDR5',
      'Storage': '1TB SSD',
      'Display': '14" 2.8K OLED',
      'Weight': '2.48 lbs',
    },
    tags: ['ultralight', 'business', 'premium'],
  },
  // Desktops
  {
    itemId: 'cat-004',
    name: 'Dell OptiPlex 7010',
    description: 'Compact desktop workstation for office productivity. Small form factor saves desk space.',
    category: 'DESKTOPS',
    manufacturer: 'Dell',
    model: 'OptiPlex 7010 SFF',
    imageUrl: '/images/catalog/dell-optiplex-7010.jpg',
    price: 899,
    availability: 'IN_STOCK',
    stockQuantity: 28,
    leadTimeDays: 0,
    specifications: {
      'Processor': 'Intel Core i5-13500',
      'Memory': '16GB DDR5',
      'Storage': '256GB SSD',
      'Form Factor': 'Small Form Factor',
      'Ports': '8x USB, 2x DisplayPort',
    },
    tags: ['office', 'compact', 'productivity'],
  },
  {
    itemId: 'cat-005',
    name: 'Mac Studio M2 Ultra',
    description: 'Professional desktop for demanding creative workflows. Exceptional performance for video editing and 3D rendering.',
    category: 'DESKTOPS',
    manufacturer: 'Apple',
    model: 'Mac Studio (2023)',
    imageUrl: '/images/catalog/mac-studio.jpg',
    price: 3999,
    availability: 'IN_STOCK',
    stockQuantity: 8,
    leadTimeDays: 0,
    specifications: {
      'Processor': 'Apple M2 Ultra',
      'Memory': '64GB Unified',
      'Storage': '1TB SSD',
      'GPU Cores': '60-core',
      'Connectivity': 'Thunderbolt 4, USB-A, HDMI',
    },
    tags: ['creative', 'professional', 'high-performance'],
    isFeatured: true,
  },
  // Monitors
  {
    itemId: 'cat-006',
    name: 'Dell UltraSharp U2723QE',
    description: '27-inch 4K USB-C Hub Monitor with excellent color accuracy. Perfect for design and productivity.',
    category: 'MONITORS',
    manufacturer: 'Dell',
    model: 'UltraSharp U2723QE',
    imageUrl: '/images/catalog/dell-ultrasharp-27.jpg',
    price: 799,
    availability: 'IN_STOCK',
    stockQuantity: 35,
    leadTimeDays: 0,
    specifications: {
      'Resolution': '3840 x 2160 (4K)',
      'Panel': 'IPS Black',
      'Size': '27 inches',
      'Connectivity': 'USB-C 90W, HDMI, DP',
      'Color': '100% sRGB, 98% DCI-P3',
    },
    tags: ['4k', 'usb-c', 'color-accurate'],
    isPopular: true,
  },
  {
    itemId: 'cat-007',
    name: 'LG 34WN80C-B UltraWide',
    description: '34-inch curved ultrawide monitor for enhanced productivity. Great for multitasking.',
    category: 'MONITORS',
    manufacturer: 'LG',
    model: '34WN80C-B',
    imageUrl: '/images/catalog/lg-ultrawide-34.jpg',
    price: 649,
    availability: 'IN_STOCK',
    stockQuantity: 18,
    leadTimeDays: 0,
    specifications: {
      'Resolution': '3440 x 1440 (UWQHD)',
      'Panel': 'IPS',
      'Size': '34 inches',
      'Curve': '1800R',
      'Connectivity': 'USB-C 60W, HDMI',
    },
    tags: ['ultrawide', 'curved', 'productivity'],
  },
  // Peripherals
  {
    itemId: 'cat-008',
    name: 'Logitech MX Master 3S',
    description: 'Premium wireless mouse with ergonomic design and quiet clicks. Works on any surface.',
    category: 'PERIPHERALS',
    manufacturer: 'Logitech',
    model: 'MX Master 3S',
    imageUrl: '/images/catalog/logitech-mx-master.jpg',
    price: 99,
    availability: 'IN_STOCK',
    stockQuantity: 85,
    leadTimeDays: 0,
    specifications: {
      'Sensor': '8000 DPI',
      'Battery': '70 days',
      'Connectivity': 'Bluetooth, USB receiver',
      'Buttons': '7 programmable',
      'Charging': 'USB-C',
    },
    tags: ['ergonomic', 'wireless', 'productivity'],
    isPopular: true,
  },
  {
    itemId: 'cat-009',
    name: 'Logitech MX Keys',
    description: 'Premium wireless keyboard with backlit keys and smart illumination. Perfect typing experience.',
    category: 'PERIPHERALS',
    manufacturer: 'Logitech',
    model: 'MX Keys',
    imageUrl: '/images/catalog/logitech-mx-keys.jpg',
    price: 119,
    availability: 'IN_STOCK',
    stockQuantity: 62,
    leadTimeDays: 0,
    specifications: {
      'Type': 'Low-profile',
      'Backlight': 'Smart illumination',
      'Battery': '10 days (backlit)',
      'Connectivity': 'Bluetooth, USB receiver',
      'Layout': 'Full-size',
    },
    tags: ['wireless', 'backlit', 'productivity'],
  },
  // Mobile Devices
  {
    itemId: 'cat-010',
    name: 'iPhone 15 Pro',
    description: 'Latest iPhone with titanium design and A17 Pro chip. Enterprise-ready with advanced security.',
    category: 'MOBILE_DEVICES',
    manufacturer: 'Apple',
    model: 'iPhone 15 Pro 256GB',
    imageUrl: '/images/catalog/iphone-15-pro.jpg',
    price: 1199,
    availability: 'LOW_STOCK',
    stockQuantity: 8,
    leadTimeDays: 5,
    specifications: {
      'Chip': 'A17 Pro',
      'Storage': '256GB',
      'Display': '6.1" Super Retina XDR',
      'Camera': '48MP Main',
      'Material': 'Titanium',
    },
    tags: ['mobile', 'enterprise', 'secure'],
  },
  {
    itemId: 'cat-011',
    name: 'iPad Pro 12.9"',
    description: 'Professional tablet with M2 chip. Perfect for mobile productivity and presentations.',
    category: 'MOBILE_DEVICES',
    manufacturer: 'Apple',
    model: 'iPad Pro 12.9" (2024)',
    imageUrl: '/images/catalog/ipad-pro.jpg',
    price: 1299,
    availability: 'IN_STOCK',
    stockQuantity: 22,
    leadTimeDays: 0,
    specifications: {
      'Chip': 'Apple M2',
      'Storage': '256GB',
      'Display': '12.9" Liquid Retina XDR',
      'Connectivity': 'Wi-Fi 6E, 5G optional',
      'Apple Pencil': '2nd generation support',
    },
    tags: ['tablet', 'productivity', 'creative'],
  },
  // Software
  {
    itemId: 'cat-012',
    name: 'Microsoft 365 Business Premium',
    description: 'Complete productivity suite with advanced security. Includes Teams, SharePoint, and more.',
    category: 'SOFTWARE',
    manufacturer: 'Microsoft',
    model: 'Microsoft 365 Business Premium',
    imageUrl: '/images/catalog/microsoft-365.jpg',
    price: 264,
    availability: 'IN_STOCK',
    stockQuantity: 999,
    leadTimeDays: 0,
    specifications: {
      'License': 'Annual subscription',
      'Users': '1 user',
      'Apps': 'Word, Excel, PowerPoint, Teams',
      'Storage': '1TB OneDrive',
      'Security': 'Advanced threat protection',
    },
    tags: ['productivity', 'collaboration', 'security'],
    isPopular: true,
  },
  {
    itemId: 'cat-013',
    name: 'Adobe Creative Cloud',
    description: 'Complete creative suite for designers and content creators. All Adobe apps included.',
    category: 'SOFTWARE',
    manufacturer: 'Adobe',
    model: 'Creative Cloud All Apps',
    imageUrl: '/images/catalog/adobe-cc.jpg',
    price: 659,
    availability: 'IN_STOCK',
    stockQuantity: 999,
    leadTimeDays: 0,
    specifications: {
      'License': 'Annual subscription',
      'Users': '1 user',
      'Apps': 'Photoshop, Illustrator, Premiere Pro, etc.',
      'Storage': '100GB cloud storage',
      'Updates': 'Continuous updates',
    },
    tags: ['creative', 'design', 'video'],
  },
  // Network Equipment
  {
    itemId: 'cat-014',
    name: 'Cisco Meraki MR46',
    description: 'Enterprise-grade Wi-Fi 6 access point with cloud management. High-density deployment ready.',
    category: 'NETWORK_EQUIPMENT',
    manufacturer: 'Cisco',
    model: 'Meraki MR46',
    imageUrl: '/images/catalog/cisco-meraki-mr46.jpg',
    price: 1295,
    availability: 'IN_STOCK',
    stockQuantity: 12,
    leadTimeDays: 0,
    specifications: {
      'Standard': 'Wi-Fi 6 (802.11ax)',
      'Speed': 'Up to 3.5 Gbps',
      'Clients': '200+ concurrent',
      'Management': 'Cloud-managed',
      'PoE': '802.3at required',
    },
    tags: ['wifi6', 'enterprise', 'cloud-managed'],
  },
  {
    itemId: 'cat-015',
    name: 'Ubiquiti UniFi Switch 24 PoE',
    description: '24-port managed PoE switch for enterprise networks. Quiet operation for office environments.',
    category: 'NETWORK_EQUIPMENT',
    manufacturer: 'Ubiquiti',
    model: 'USW-24-POE',
    imageUrl: '/images/catalog/ubiquiti-switch.jpg',
    price: 449,
    availability: 'OUT_OF_STOCK',
    stockQuantity: 0,
    leadTimeDays: 14,
    specifications: {
      'Ports': '24x Gigabit RJ45',
      'PoE': '16x PoE+ (195W total)',
      'SFP': '2x SFP',
      'Management': 'UniFi Controller',
      'Switching': 'Layer 2',
    },
    tags: ['switch', 'poe', 'enterprise'],
  },
  // Accessories
  {
    itemId: 'cat-016',
    name: 'CalDigit TS4 Thunderbolt 4 Dock',
    description: 'Premium Thunderbolt 4 dock with 18 ports. Single cable connection for complete workstation.',
    category: 'ACCESSORIES',
    manufacturer: 'CalDigit',
    model: 'TS4',
    imageUrl: '/images/catalog/caldigit-ts4.jpg',
    price: 399,
    availability: 'IN_STOCK',
    stockQuantity: 25,
    leadTimeDays: 0,
    specifications: {
      'Ports': '18 total',
      'Power Delivery': '98W',
      'Display': 'Dual 4K or Single 8K',
      'Thunderbolt': '3x Thunderbolt 4',
      'USB': '5x USB-A, 3x USB-C',
    },
    tags: ['dock', 'thunderbolt', 'productivity'],
    isPopular: true,
  },
  {
    itemId: 'cat-017',
    name: 'Jabra Evolve2 85',
    description: 'Professional wireless headset with ANC. Certified for Microsoft Teams and Zoom.',
    category: 'ACCESSORIES',
    manufacturer: 'Jabra',
    model: 'Evolve2 85',
    imageUrl: '/images/catalog/jabra-evolve2-85.jpg',
    price: 449,
    availability: 'IN_STOCK',
    stockQuantity: 30,
    leadTimeDays: 0,
    specifications: {
      'Type': 'Over-ear wireless',
      'ANC': 'Advanced Active Noise Cancellation',
      'Battery': '37 hours',
      'Certification': 'MS Teams, Zoom',
      'Connectivity': 'Bluetooth, USB dongle',
    },
    tags: ['headset', 'anc', 'meetings'],
  },
  {
    itemId: 'cat-018',
    name: 'Logitech Brio 4K Webcam',
    description: '4K Ultra HD webcam with HDR and Windows Hello support. Professional video quality.',
    category: 'ACCESSORIES',
    manufacturer: 'Logitech',
    model: 'Brio 4K',
    imageUrl: '/images/catalog/logitech-brio.jpg',
    price: 199,
    availability: 'BACKORDERED',
    stockQuantity: 0,
    leadTimeDays: 7,
    specifications: {
      'Resolution': '4K Ultra HD',
      'HDR': 'Yes',
      'Autofocus': '5x digital zoom',
      'Field of View': '65°, 78°, 90°',
      'Windows Hello': 'Supported',
    },
    tags: ['webcam', '4k', 'video-conferencing'],
  },
];

/**
 * Mock category information
 */
export const mockCategories: CategoryInfo[] = [
  {
    id: 'LAPTOPS',
    name: 'Laptops',
    description: 'Portable computers for mobile productivity',
    icon: 'laptop',
    itemCount: mockCatalogItems.filter(i => i.category === 'LAPTOPS').length,
  },
  {
    id: 'DESKTOPS',
    name: 'Desktops',
    description: 'Desktop workstations and computers',
    icon: 'desktop',
    itemCount: mockCatalogItems.filter(i => i.category === 'DESKTOPS').length,
  },
  {
    id: 'MONITORS',
    name: 'Monitors',
    description: 'Displays and screens',
    icon: 'monitor',
    itemCount: mockCatalogItems.filter(i => i.category === 'MONITORS').length,
  },
  {
    id: 'PERIPHERALS',
    name: 'Peripherals',
    description: 'Keyboards, mice, and input devices',
    icon: 'peripherals',
    itemCount: mockCatalogItems.filter(i => i.category === 'PERIPHERALS').length,
  },
  {
    id: 'MOBILE_DEVICES',
    name: 'Mobile Devices',
    description: 'Phones and tablets',
    icon: 'mobile',
    itemCount: mockCatalogItems.filter(i => i.category === 'MOBILE_DEVICES').length,
  },
  {
    id: 'SOFTWARE',
    name: 'Software',
    description: 'Software licenses and subscriptions',
    icon: 'software',
    itemCount: mockCatalogItems.filter(i => i.category === 'SOFTWARE').length,
  },
  {
    id: 'NETWORK_EQUIPMENT',
    name: 'Network Equipment',
    description: 'Networking hardware and infrastructure',
    icon: 'network',
    itemCount: mockCatalogItems.filter(i => i.category === 'NETWORK_EQUIPMENT').length,
  },
  {
    id: 'ACCESSORIES',
    name: 'Accessories',
    description: 'Docks, headsets, and other accessories',
    icon: 'accessories',
    itemCount: mockCatalogItems.filter(i => i.category === 'ACCESSORIES').length,
  },
];

/**
 * Helper to simulate API loading delay
 */
export function simulateApiDelay<T>(data: T, delayMs = 800): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(data), delayMs);
  });
}

/**
 * Filter catalog items based on filters
 */
export function filterCatalogItems(
  items: CatalogItem[],
  filters: {
    search?: string;
    categories?: string[];
    availability?: string[];
    inStockOnly?: boolean;
    priceMin?: number | null;
    priceMax?: number | null;
  }
): CatalogItem[] {
  return items.filter((item) => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower) ||
        item.manufacturer.toLowerCase().includes(searchLower) ||
        item.model.toLowerCase().includes(searchLower) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(item.category)) return false;
    }

    // Availability filter
    if (filters.availability && filters.availability.length > 0) {
      if (!filters.availability.includes(item.availability)) return false;
    }

    // In stock only filter
    if (filters.inStockOnly && item.availability === 'OUT_OF_STOCK') {
      return false;
    }

    // Price range filter
    if (filters.priceMin !== null && filters.priceMin !== undefined) {
      if (item.price < filters.priceMin) return false;
    }
    if (filters.priceMax !== null && filters.priceMax !== undefined) {
      if (item.price > filters.priceMax) return false;
    }

    return true;
  });
}
