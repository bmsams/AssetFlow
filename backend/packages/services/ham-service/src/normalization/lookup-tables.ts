/**
 * Normalization Lookup Tables
 *
 * Contains canonical manufacturer and model mappings with common variations.
 * Used by the Normalization Engine to standardize discovery data.
 *
 * Requirement 3.1: Standardize manufacturer names, model numbers, and specifications
 */

/**
 * Manufacturer normalization entry
 */
export interface ManufacturerEntry {
  /** Canonical/normalized name */
  readonly canonical: string;
  /** Display name for UI */
  readonly displayName: string;
  /** Known aliases and variations */
  readonly aliases: readonly string[];
}

/**
 * Model normalization entry
 */
export interface ModelEntry {
  /** Canonical/normalized name */
  readonly canonical: string;
  /** Display name for UI */
  readonly displayName: string;
  /** Manufacturer canonical name */
  readonly manufacturer: string;
  /** Model category */
  readonly category?: string;
  /** Known aliases and variations */
  readonly aliases: readonly string[];
}

/**
 * Manufacturer lookup table with common variations
 *
 * Maps various manufacturer name variations to their canonical forms.
 * The canonical name is used for database storage and matching.
 */
export const MANUFACTURER_LOOKUP: readonly ManufacturerEntry[] = [
  {
    canonical: 'DELL',
    displayName: 'Dell Technologies',
    aliases: [
      'dell',
      'dell inc',
      'dell inc.',
      'dell computer',
      'dell computer corporation',
      'dell emc',
      'dell technologies',
      'dell technologies inc',
      'dell technologies inc.',
    ],
  },
  {
    canonical: 'HP',
    displayName: 'HP Inc.',
    aliases: [
      'hp',
      'hp inc',
      'hp inc.',
      'hewlett-packard',
      'hewlett packard',
      'hewlett-packard company',
      'hewlett packard company',
      'hpq',
    ],
  },
  {
    canonical: 'HPE',
    displayName: 'Hewlett Packard Enterprise',
    aliases: [
      'hpe',
      'hewlett packard enterprise',
      'hewlett-packard enterprise',
      'hp enterprise',
      'hpe inc',
    ],
  },
  {
    canonical: 'LENOVO',
    displayName: 'Lenovo',
    aliases: [
      'lenovo',
      'lenovo group',
      'lenovo group limited',
      'lenovo inc',
      'lenovo ltd',
      'lenovo (beijing) limited',
    ],
  },
  {
    canonical: 'APPLE',
    displayName: 'Apple Inc.',
    aliases: [
      'apple',
      'apple inc',
      'apple inc.',
      'apple computer',
      'apple computer inc',
      'apple computer, inc.',
    ],
  },
  {
    canonical: 'MICROSOFT',
    displayName: 'Microsoft Corporation',
    aliases: [
      'microsoft',
      'microsoft corp',
      'microsoft corporation',
      'msft',
      'microsoft inc',
    ],
  },
  {
    canonical: 'CISCO',
    displayName: 'Cisco Systems',
    aliases: [
      'cisco',
      'cisco systems',
      'cisco systems inc',
      'cisco systems, inc.',
      'cisco systems inc.',
    ],
  },
  {
    canonical: 'IBM',
    displayName: 'IBM',
    aliases: [
      'ibm',
      'ibm corporation',
      'ibm corp',
      'international business machines',
      'international business machines corporation',
    ],
  },
  {
    canonical: 'SAMSUNG',
    displayName: 'Samsung Electronics',
    aliases: [
      'samsung',
      'samsung electronics',
      'samsung electronics co',
      'samsung electronics co ltd',
      'samsung electronics co., ltd.',
    ],
  },
  {
    canonical: 'INTEL',
    displayName: 'Intel Corporation',
    aliases: [
      'intel',
      'intel corp',
      'intel corporation',
      'genuine intel',
    ],
  },
  {
    canonical: 'AMD',
    displayName: 'Advanced Micro Devices',
    aliases: [
      'amd',
      'advanced micro devices',
      'advanced micro devices inc',
      'amd inc',
      'authenticamd',
    ],
  },
  {
    canonical: 'ASUS',
    displayName: 'ASUS',
    aliases: [
      'asus',
      'asustek',
      'asustek computer',
      'asustek computer inc',
      'asus computer',
    ],
  },
  {
    canonical: 'ACER',
    displayName: 'Acer',
    aliases: [
      'acer',
      'acer inc',
      'acer incorporated',
      'acer america',
    ],
  },
  {
    canonical: 'TOSHIBA',
    displayName: 'Toshiba',
    aliases: [
      'toshiba',
      'toshiba corporation',
      'toshiba corp',
      'toshiba america',
    ],
  },
  {
    canonical: 'SONY',
    displayName: 'Sony Corporation',
    aliases: [
      'sony',
      'sony corporation',
      'sony corp',
      'sony electronics',
    ],
  },
  {
    canonical: 'LG',
    displayName: 'LG Electronics',
    aliases: [
      'lg',
      'lg electronics',
      'lg electronics inc',
      'lg corp',
    ],
  },
  {
    canonical: 'NETGEAR',
    displayName: 'NETGEAR',
    aliases: [
      'netgear',
      'netgear inc',
      'netgear incorporated',
    ],
  },
  {
    canonical: 'JUNIPER',
    displayName: 'Juniper Networks',
    aliases: [
      'juniper',
      'juniper networks',
      'juniper networks inc',
    ],
  },
  {
    canonical: 'ARUBA',
    displayName: 'Aruba Networks',
    aliases: [
      'aruba',
      'aruba networks',
      'aruba a hewlett packard enterprise company',
      'hpe aruba',
    ],
  },
  {
    canonical: 'VMWARE',
    displayName: 'VMware',
    aliases: [
      'vmware',
      'vmware inc',
      'vmware, inc.',
    ],
  },
  {
    canonical: 'NVIDIA',
    displayName: 'NVIDIA Corporation',
    aliases: [
      'nvidia',
      'nvidia corporation',
      'nvidia corp',
    ],
  },
  {
    canonical: 'SUPERMICRO',
    displayName: 'Supermicro',
    aliases: [
      'supermicro',
      'super micro',
      'super micro computer',
      'super micro computer inc',
    ],
  },
  {
    canonical: 'FUJITSU',
    displayName: 'Fujitsu',
    aliases: [
      'fujitsu',
      'fujitsu limited',
      'fujitsu ltd',
      'fujitsu america',
    ],
  },
  {
    canonical: 'PANASONIC',
    displayName: 'Panasonic',
    aliases: [
      'panasonic',
      'panasonic corporation',
      'panasonic corp',
      'matsushita',
    ],
  },
  {
    canonical: 'BROTHER',
    displayName: 'Brother Industries',
    aliases: [
      'brother',
      'brother industries',
      'brother industries ltd',
    ],
  },
  {
    canonical: 'EPSON',
    displayName: 'Epson',
    aliases: [
      'epson',
      'seiko epson',
      'seiko epson corporation',
      'epson america',
    ],
  },
  {
    canonical: 'CANON',
    displayName: 'Canon',
    aliases: [
      'canon',
      'canon inc',
      'canon usa',
      'canon u.s.a.',
    ],
  },
  {
    canonical: 'XEROX',
    displayName: 'Xerox',
    aliases: [
      'xerox',
      'xerox corporation',
      'xerox corp',
    ],
  },
  {
    canonical: 'LOGITECH',
    displayName: 'Logitech',
    aliases: [
      'logitech',
      'logitech international',
      'logitech inc',
    ],
  },
  {
    canonical: 'WESTERN_DIGITAL',
    displayName: 'Western Digital',
    aliases: [
      'western digital',
      'wd',
      'western digital corporation',
      'western digital corp',
      'wdc',
    ],
  },
  {
    canonical: 'SEAGATE',
    displayName: 'Seagate Technology',
    aliases: [
      'seagate',
      'seagate technology',
      'seagate technology llc',
    ],
  },
  {
    canonical: 'KINGSTON',
    displayName: 'Kingston Technology',
    aliases: [
      'kingston',
      'kingston technology',
      'kingston technology corp',
    ],
  },
  {
    canonical: 'CRUCIAL',
    displayName: 'Crucial',
    aliases: [
      'crucial',
      'crucial technology',
      'micron crucial',
    ],
  },
  {
    canonical: 'NETAPP',
    displayName: 'NetApp',
    aliases: [
      'netapp',
      'netapp inc',
      'network appliance',
    ],
  },
  {
    canonical: 'EMC',
    displayName: 'EMC Corporation',
    aliases: [
      'emc',
      'emc corporation',
      'emc corp',
      'emc2',
    ],
  },
  {
    canonical: 'PURE_STORAGE',
    displayName: 'Pure Storage',
    aliases: [
      'pure storage',
      'pure storage inc',
      'purestorage',
    ],
  },
];

/**
 * Model lookup table with common variations
 *
 * Maps various model name variations to their canonical forms.
 */
export const MODEL_LOOKUP: readonly ModelEntry[] = [
  // Dell Laptops
  {
    canonical: 'LATITUDE_5520',
    displayName: 'Dell Latitude 5520',
    manufacturer: 'DELL',
    category: 'LAPTOP',
    aliases: ['latitude 5520', 'dell latitude 5520', 'lat 5520', 'latitude5520'],
  },
  {
    canonical: 'LATITUDE_7420',
    displayName: 'Dell Latitude 7420',
    manufacturer: 'DELL',
    category: 'LAPTOP',
    aliases: ['latitude 7420', 'dell latitude 7420', 'lat 7420', 'latitude7420'],
  },
  {
    canonical: 'XPS_15',
    displayName: 'Dell XPS 15',
    manufacturer: 'DELL',
    category: 'LAPTOP',
    aliases: ['xps 15', 'dell xps 15', 'xps15', 'xps 15 9520'],
  },
  {
    canonical: 'PRECISION_5570',
    displayName: 'Dell Precision 5570',
    manufacturer: 'DELL',
    category: 'LAPTOP',
    aliases: ['precision 5570', 'dell precision 5570', 'prec 5570'],
  },
  // Dell Desktops
  {
    canonical: 'OPTIPLEX_7090',
    displayName: 'Dell OptiPlex 7090',
    manufacturer: 'DELL',
    category: 'DESKTOP',
    aliases: ['optiplex 7090', 'dell optiplex 7090', 'opti 7090'],
  },
  // Dell Servers
  {
    canonical: 'POWEREDGE_R750',
    displayName: 'Dell PowerEdge R750',
    manufacturer: 'DELL',
    category: 'SERVER',
    aliases: ['poweredge r750', 'dell poweredge r750', 'pe r750', 'r750'],
  },
  // HP Laptops
  {
    canonical: 'ELITEBOOK_840_G8',
    displayName: 'HP EliteBook 840 G8',
    manufacturer: 'HP',
    category: 'LAPTOP',
    aliases: ['elitebook 840 g8', 'hp elitebook 840 g8', 'elitebook 840', 'eb 840 g8'],
  },
  {
    canonical: 'PROBOOK_450_G8',
    displayName: 'HP ProBook 450 G8',
    manufacturer: 'HP',
    category: 'LAPTOP',
    aliases: ['probook 450 g8', 'hp probook 450 g8', 'probook 450', 'pb 450 g8'],
  },
  {
    canonical: 'ZBOOK_FURY_15_G8',
    displayName: 'HP ZBook Fury 15 G8',
    manufacturer: 'HP',
    category: 'LAPTOP',
    aliases: ['zbook fury 15 g8', 'hp zbook fury 15', 'zbook fury 15'],
  },
  // HP Desktops
  {
    canonical: 'ELITEDESK_800_G6',
    displayName: 'HP EliteDesk 800 G6',
    manufacturer: 'HP',
    category: 'DESKTOP',
    aliases: ['elitedesk 800 g6', 'hp elitedesk 800 g6', 'ed 800 g6'],
  },
  // HPE Servers
  {
    canonical: 'PROLIANT_DL380_GEN10',
    displayName: 'HPE ProLiant DL380 Gen10',
    manufacturer: 'HPE',
    category: 'SERVER',
    aliases: ['proliant dl380 gen10', 'hpe proliant dl380', 'dl380 gen10', 'dl380 g10'],
  },
  // Lenovo Laptops
  {
    canonical: 'THINKPAD_T14_GEN2',
    displayName: 'Lenovo ThinkPad T14 Gen 2',
    manufacturer: 'LENOVO',
    category: 'LAPTOP',
    aliases: ['thinkpad t14 gen 2', 'lenovo thinkpad t14', 't14 gen 2', 'thinkpad t14'],
  },
  {
    canonical: 'THINKPAD_X1_CARBON_GEN9',
    displayName: 'Lenovo ThinkPad X1 Carbon Gen 9',
    manufacturer: 'LENOVO',
    category: 'LAPTOP',
    aliases: ['thinkpad x1 carbon gen 9', 'x1 carbon gen 9', 'x1 carbon', 'thinkpad x1'],
  },
  // Lenovo Desktops
  {
    canonical: 'THINKCENTRE_M920',
    displayName: 'Lenovo ThinkCentre M920',
    manufacturer: 'LENOVO',
    category: 'DESKTOP',
    aliases: ['thinkcentre m920', 'lenovo thinkcentre m920', 'm920'],
  },
  // Apple
  {
    canonical: 'MACBOOK_PRO_14',
    displayName: 'MacBook Pro 14-inch',
    manufacturer: 'APPLE',
    category: 'LAPTOP',
    aliases: ['macbook pro 14', 'macbook pro 14-inch', 'mbp 14', 'macbookpro14'],
  },
  {
    canonical: 'MACBOOK_PRO_16',
    displayName: 'MacBook Pro 16-inch',
    manufacturer: 'APPLE',
    category: 'LAPTOP',
    aliases: ['macbook pro 16', 'macbook pro 16-inch', 'mbp 16', 'macbookpro16'],
  },
  {
    canonical: 'MACBOOK_AIR_M2',
    displayName: 'MacBook Air M2',
    manufacturer: 'APPLE',
    category: 'LAPTOP',
    aliases: ['macbook air m2', 'macbook air', 'mba m2'],
  },
  {
    canonical: 'IMAC_24',
    displayName: 'iMac 24-inch',
    manufacturer: 'APPLE',
    category: 'DESKTOP',
    aliases: ['imac 24', 'imac 24-inch', 'imac 24"'],
  },
  {
    canonical: 'MAC_MINI_M2',
    displayName: 'Mac mini M2',
    manufacturer: 'APPLE',
    category: 'DESKTOP',
    aliases: ['mac mini m2', 'mac mini', 'macmini m2'],
  },
  // Microsoft
  {
    canonical: 'SURFACE_PRO_9',
    displayName: 'Microsoft Surface Pro 9',
    manufacturer: 'MICROSOFT',
    category: 'LAPTOP',
    aliases: ['surface pro 9', 'microsoft surface pro 9', 'surface pro'],
  },
  {
    canonical: 'SURFACE_LAPTOP_5',
    displayName: 'Microsoft Surface Laptop 5',
    manufacturer: 'MICROSOFT',
    category: 'LAPTOP',
    aliases: ['surface laptop 5', 'microsoft surface laptop 5', 'surface laptop'],
  },
  // Cisco Network
  {
    canonical: 'CATALYST_9300',
    displayName: 'Cisco Catalyst 9300',
    manufacturer: 'CISCO',
    category: 'NETWORK',
    aliases: ['catalyst 9300', 'cisco catalyst 9300', 'cat 9300', 'c9300'],
  },
  {
    canonical: 'NEXUS_9000',
    displayName: 'Cisco Nexus 9000',
    manufacturer: 'CISCO',
    category: 'NETWORK',
    aliases: ['nexus 9000', 'cisco nexus 9000', 'n9k', 'nexus 9k'],
  },
];

/**
 * Build a lookup map from manufacturer aliases to canonical names
 */
export function buildManufacturerAliasMap(): Map<string, string> {
  const map = new Map<string, string>();

  for (const entry of MANUFACTURER_LOOKUP) {
    // Add canonical name itself (lowercase)
    map.set(entry.canonical.toLowerCase(), entry.canonical);

    // Add all aliases
    for (const alias of entry.aliases) {
      map.set(alias.toLowerCase(), entry.canonical);
    }
  }

  return map;
}

/**
 * Build a lookup map from model aliases to canonical names (keyed by manufacturer)
 */
export function buildModelAliasMap(): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>();

  for (const entry of MODEL_LOOKUP) {
    let manufacturerMap = map.get(entry.manufacturer);
    if (!manufacturerMap) {
      manufacturerMap = new Map<string, string>();
      map.set(entry.manufacturer, manufacturerMap);
    }

    // Add canonical name itself (lowercase)
    manufacturerMap.set(entry.canonical.toLowerCase(), entry.canonical);

    // Add all aliases
    for (const alias of entry.aliases) {
      manufacturerMap.set(alias.toLowerCase(), entry.canonical);
    }
  }

  return map;
}

/**
 * Get manufacturer entry by canonical name
 */
export function getManufacturerByCanonical(canonical: string): ManufacturerEntry | undefined {
  return MANUFACTURER_LOOKUP.find((entry) => entry.canonical === canonical);
}

/**
 * Get model entry by canonical name and manufacturer
 */
export function getModelByCanonical(
  canonical: string,
  manufacturer: string
): ModelEntry | undefined {
  return MODEL_LOOKUP.find(
    (entry) => entry.canonical === canonical && entry.manufacturer === manufacturer
  );
}
