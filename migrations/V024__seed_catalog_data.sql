-- V024: Seed catalog categories and catalog items for the Service Catalog
-- Uses manufacturers and models that match existing seed data

-- ============================================================================
-- 1. Catalog Categories (names match frontend CatalogCategory enum)
-- ============================================================================
INSERT INTO catalog_categories (category_id, name, description, sort_order, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'LAPTOPS', 'Portable computers for business use', 1, true),
  ('a0000000-0000-0000-0000-000000000002', 'DESKTOPS', 'Desktop workstations and towers', 2, true),
  ('a0000000-0000-0000-0000-000000000003', 'MONITORS', 'External displays and monitors', 3, true),
  ('a0000000-0000-0000-0000-000000000004', 'PERIPHERALS', 'Keyboards, mice, docking stations', 4, true),
  ('a0000000-0000-0000-0000-000000000005', 'MOBILE_DEVICES', 'Phones, tablets, and mobile accessories', 5, true),
  ('a0000000-0000-0000-0000-000000000006', 'SOFTWARE', 'Software licenses and subscriptions', 6, true),
  ('a0000000-0000-0000-0000-000000000007', 'NETWORK_EQUIPMENT', 'Routers, switches, access points', 7, true),
  ('a0000000-0000-0000-0000-000000000008', 'ACCESSORIES', 'Cables, adapters, bags, and other accessories', 8, true)
ON CONFLICT (category_id) DO NOTHING;

-- ============================================================================
-- 2. Catalog Items — tied to real manufacturers/models from seed data
-- ============================================================================
INSERT INTO catalog_items (
  item_code, name, description, short_description, item_type,
  category_id, manufacturer, model, unit_price, status,
  is_requestable, requires_approval, approval_threshold,
  lead_time_days, max_quantity_per_request, tags, sort_order,
  specifications
) VALUES
-- === LAPTOPS (category a...001) ===
(
  'CAT-LAP-001', 'Dell Latitude 5540',
  'Business-class laptop with enterprise security features and long battery life. Intel Core i7-1365U, 16GB DDR5, 512GB SSD.',
  'Business laptop with i7, 16GB RAM, 512GB SSD',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000001',
  'Dell Technologies', 'Latitude 5540', 1299.00, 'ACTIVE',
  true, false, NULL, 0, 3,
  ARRAY['business', 'enterprise', 'security'], 1,
  '{"Processor": "Intel Core i7-1365U", "Memory": "16GB DDR5", "Storage": "512GB SSD", "Display": "15.6 inch FHD", "Battery": "Up to 12 hours"}'::jsonb
),
(
  'CAT-LAP-002', 'Dell Latitude 7440',
  'Premium ultrabook with 32GB RAM and 1TB storage. Built for power users who need performance on the go.',
  'Premium ultrabook with i7, 32GB RAM, 1TB SSD',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000001',
  'Dell Technologies', 'Latitude 7440', 1899.00, 'ACTIVE',
  true, true, 1500.00, 3, 2,
  ARRAY['premium', 'ultrabook', 'business'], 2,
  '{"Processor": "Intel Core i7-1365U", "Memory": "32GB LPDDR5", "Storage": "1TB SSD", "Display": "14 inch QHD+", "Weight": "2.8 lbs"}'::jsonb
),
(
  'CAT-LAP-003', 'HP EliteBook 840 G10',
  'Enterprise laptop with HP Wolf Security. Intel Core i7, 16GB RAM, 512GB SSD. MIL-STD-810H tested.',
  'Enterprise laptop with Wolf Security',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000001',
  'HP Inc.', 'EliteBook 840 G10', 1449.00, 'ACTIVE',
  true, false, NULL, 0, 3,
  ARRAY['enterprise', 'security', 'durable'], 3,
  '{"Processor": "Intel Core i7-1365U", "Memory": "16GB DDR5", "Storage": "512GB SSD", "Display": "14 inch FHD", "Security": "HP Wolf Security"}'::jsonb
),
(
  'CAT-LAP-004', 'Lenovo ThinkPad X1 Carbon Gen 11',
  'Ultra-lightweight business laptop with military-grade durability and exceptional keyboard. 32GB RAM, 1TB SSD, 2.8K OLED display.',
  'Ultralight premium laptop with OLED display',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000001',
  'Lenovo', 'ThinkPad X1 Carbon Gen 11', 1849.00, 'ACTIVE',
  true, true, 1500.00, 3, 2,
  ARRAY['ultralight', 'premium', 'oled'], 4,
  '{"Processor": "Intel Core i7-1365U", "Memory": "32GB LPDDR5", "Storage": "1TB SSD", "Display": "14 inch 2.8K OLED", "Weight": "2.48 lbs"}'::jsonb
),
(
  'CAT-LAP-005', 'Lenovo ThinkPad T14 Gen 4',
  'Reliable business laptop with excellent keyboard. Intel Core i5, 16GB RAM, 512GB SSD. Great value for everyday business use.',
  'Reliable business laptop, great value',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000001',
  'Lenovo', 'ThinkPad T14 Gen 4', 1099.00, 'ACTIVE',
  true, false, NULL, 0, 5,
  ARRAY['business', 'value', 'reliable'], 5,
  '{"Processor": "Intel Core i5-1345U", "Memory": "16GB DDR5", "Storage": "512GB SSD", "Display": "14 inch FHD", "Battery": "Up to 13 hours"}'::jsonb
),
(
  'CAT-LAP-006', 'Apple MacBook Pro 14" M3 Pro',
  'High-performance laptop for developers and creative professionals. M3 Pro chip, 18GB unified memory, 512GB SSD.',
  'Pro laptop with M3 Pro chip',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000001',
  'Apple Inc.', 'MacBook Pro 14" M3 Pro', 1999.00, 'ACTIVE',
  true, true, 1500.00, 5, 2,
  ARRAY['developer', 'creative', 'high-performance'], 6,
  '{"Processor": "Apple M3 Pro", "Memory": "18GB Unified", "Storage": "512GB SSD", "Display": "14.2 inch Liquid Retina XDR", "Battery": "Up to 17 hours"}'::jsonb
),
(
  'CAT-LAP-007', 'Apple MacBook Air 15" M3',
  'Thin and light laptop with all-day battery life. M3 chip, 16GB unified memory, 512GB SSD. Fanless design.',
  'Thin and light with M3 chip',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000001',
  'Apple Inc.', 'MacBook Air 15" M3', 1499.00, 'ACTIVE',
  true, false, NULL, 0, 3,
  ARRAY['thin', 'light', 'all-day-battery'], 7,
  '{"Processor": "Apple M3", "Memory": "16GB Unified", "Storage": "512GB SSD", "Display": "15.3 inch Liquid Retina", "Weight": "3.3 lbs"}'::jsonb
),

-- === DESKTOPS (category a...002) ===
(
  'CAT-DT-001', 'Dell OptiPlex 7010',
  'Compact desktop workstation for office productivity. Small form factor saves desk space. Intel Core i5, 16GB RAM.',
  'Compact SFF desktop for office use',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000002',
  'Dell Technologies', 'OptiPlex 7010', 899.00, 'ACTIVE',
  true, false, NULL, 0, 5,
  ARRAY['office', 'compact', 'productivity'], 1,
  '{"Processor": "Intel Core i5-13500", "Memory": "16GB DDR5", "Storage": "512GB SSD", "Form Factor": "Small Form Factor", "Ports": "8x USB, 2x DisplayPort"}'::jsonb
),
(
  'CAT-DT-002', 'HP ProDesk 400 G9',
  'Affordable business desktop with reliable performance. Intel Core i5, 16GB RAM, 256GB SSD.',
  'Affordable business desktop',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000002',
  'HP Inc.', 'ProDesk 400 G9', 749.00, 'ACTIVE',
  true, false, NULL, 0, 5,
  ARRAY['office', 'value', 'business'], 2,
  '{"Processor": "Intel Core i5-12500", "Memory": "16GB DDR4", "Storage": "256GB SSD", "Form Factor": "Small Form Factor"}'::jsonb
),
(
  'CAT-DT-003', 'Lenovo ThinkCentre M70q Gen 4',
  'Tiny desktop that fits behind a monitor. Intel Core i5, 16GB RAM, 512GB SSD. VESA mountable.',
  'Tiny desktop, VESA mountable',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000002',
  'Lenovo', 'ThinkCentre M70q Gen 4', 799.00, 'ACTIVE',
  true, false, NULL, 0, 5,
  ARRAY['tiny', 'vesa', 'space-saving'], 3,
  '{"Processor": "Intel Core i5-13400T", "Memory": "16GB DDR4", "Storage": "512GB SSD", "Form Factor": "Tiny (1L)", "Mount": "VESA compatible"}'::jsonb
),
(
  'CAT-DT-004', 'Apple Mac Mini M2 Pro',
  'Powerful compact desktop with M2 Pro chip. 16GB unified memory, 512GB SSD. Great for development.',
  'Compact powerhouse with M2 Pro',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000002',
  'Apple Inc.', 'Mac Mini M2 Pro', 1399.00, 'ACTIVE',
  true, true, 1000.00, 5, 2,
  ARRAY['compact', 'powerful', 'developer'], 4,
  '{"Processor": "Apple M2 Pro", "Memory": "16GB Unified", "Storage": "512GB SSD", "Ports": "Thunderbolt 4, HDMI, USB-A", "Connectivity": "Wi-Fi 6E, Bluetooth 5.3"}'::jsonb
),

-- === MONITORS (category a...003) ===
(
  'CAT-MON-001', 'Dell UltraSharp U2723QE',
  '27-inch 4K USB-C Hub Monitor with excellent color accuracy. IPS Black panel, 100% sRGB, 98% DCI-P3.',
  '27 inch 4K USB-C monitor',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000003',
  'Dell Technologies', 'UltraSharp U2723QE', 619.00, 'ACTIVE',
  true, false, NULL, 0, 3,
  ARRAY['4k', 'usb-c', 'color-accurate'], 1,
  '{"Resolution": "3840 x 2160 (4K)", "Panel": "IPS Black", "Size": "27 inches", "Connectivity": "USB-C 90W, HDMI, DP", "Color": "100% sRGB, 98% DCI-P3"}'::jsonb
),
(
  'CAT-MON-002', 'Samsung ViewFinity S8 32"',
  '32-inch 4K monitor with USB-C and HDR10. Excellent for productivity and content creation.',
  '32 inch 4K HDR monitor',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000003',
  'Samsung Electronics', 'ViewFinity S8 32"', 549.00, 'ACTIVE',
  true, false, NULL, 0, 3,
  ARRAY['4k', 'hdr', '32-inch'], 2,
  '{"Resolution": "3840 x 2160 (4K)", "Panel": "IPS", "Size": "32 inches", "HDR": "HDR10", "Connectivity": "USB-C 90W, HDMI, DP"}'::jsonb
),

-- === PERIPHERALS (category a...004) ===
(
  'CAT-PER-001', 'Logitech MX Master 3S',
  'Premium wireless mouse with ergonomic design and quiet clicks. 8000 DPI sensor, works on any surface.',
  'Premium ergonomic wireless mouse',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000004',
  'Logitech', 'MX Master 3S', 99.00, 'ACTIVE',
  true, false, NULL, 0, 5,
  ARRAY['ergonomic', 'wireless', 'productivity'], 1,
  '{"Sensor": "8000 DPI", "Battery": "70 days", "Connectivity": "Bluetooth, USB receiver", "Buttons": "7 programmable", "Charging": "USB-C"}'::jsonb
),
(
  'CAT-PER-002', 'Logitech MX Keys S',
  'Premium wireless keyboard with backlit keys and smart illumination. Low-profile keys, multi-device support.',
  'Premium wireless keyboard with backlight',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000004',
  'Logitech', 'MX Keys S', 119.00, 'ACTIVE',
  true, false, NULL, 0, 5,
  ARRAY['wireless', 'backlit', 'productivity'], 2,
  '{"Type": "Low-profile", "Backlight": "Smart illumination", "Battery": "10 days (backlit)", "Connectivity": "Bluetooth, USB receiver", "Layout": "Full-size"}'::jsonb
),
(
  'CAT-PER-003', 'Logitech Rally Bar',
  'All-in-one video conferencing bar for medium to large rooms. 4K camera, AI-powered framing.',
  'Video conferencing bar for meeting rooms',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000004',
  'Logitech', 'Rally Bar', 2999.00, 'ACTIVE',
  true, true, 2000.00, 7, 1,
  ARRAY['video-conferencing', 'meeting-room', 'ai'], 3,
  '{"Camera": "4K Ultra HD", "Audio": "Beamforming mics", "AI": "Auto-framing, speaker tracking", "Connectivity": "USB-C, HDMI, Ethernet", "Room Size": "Medium to Large"}'::jsonb
),

-- === MOBILE DEVICES (category a...005) ===
(
  'CAT-MOB-001', 'Apple iPhone 15 Pro',
  'Latest iPhone with titanium design and A17 Pro chip. Enterprise-ready with advanced security features.',
  'Enterprise smartphone with A17 Pro',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000005',
  'Apple Inc.', 'iPhone 15 Pro', 1199.00, 'ACTIVE',
  true, true, 1000.00, 5, 2,
  ARRAY['mobile', 'enterprise', 'secure'], 1,
  '{"Chip": "A17 Pro", "Storage": "256GB", "Display": "6.1 inch Super Retina XDR", "Camera": "48MP Main", "Material": "Titanium"}'::jsonb
),
(
  'CAT-MOB-002', 'Samsung Galaxy Tab S9+',
  'Premium Android tablet with S Pen included. 12.4-inch AMOLED display, great for field work and presentations.',
  'Premium Android tablet with S Pen',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000005',
  'Samsung Electronics', 'Galaxy Tab S9+', 999.00, 'ACTIVE',
  true, true, 800.00, 5, 2,
  ARRAY['tablet', 'android', 'field-work'], 2,
  '{"Processor": "Snapdragon 8 Gen 2", "Storage": "256GB", "Display": "12.4 inch AMOLED", "S Pen": "Included", "Battery": "10090 mAh"}'::jsonb
),

-- === SOFTWARE (category a...006) ===
(
  'CAT-SW-001', 'Microsoft 365 E3',
  'Complete productivity suite with Teams, SharePoint, OneDrive, and Office apps. Annual per-user subscription.',
  'Office productivity suite (annual)',
  'SOFTWARE', 'a0000000-0000-0000-0000-000000000006',
  'Microsoft Corporation', 'Microsoft 365 E3', 432.00, 'ACTIVE',
  true, false, NULL, 0, 50,
  ARRAY['productivity', 'collaboration', 'office'], 1,
  '{"License": "Annual subscription", "Apps": "Word, Excel, PowerPoint, Teams, SharePoint", "Storage": "1TB OneDrive", "Users": "Per user"}'::jsonb
),
(
  'CAT-SW-002', 'Adobe Creative Cloud',
  'Complete creative suite for designers and content creators. All Adobe apps including Photoshop, Illustrator, Premiere Pro.',
  'Full creative suite (annual)',
  'SOFTWARE', 'a0000000-0000-0000-0000-000000000006',
  'Adobe', 'Creative Cloud All Apps', 659.00, 'ACTIVE',
  true, true, 500.00, 0, 10,
  ARRAY['creative', 'design', 'video'], 2,
  '{"License": "Annual subscription", "Apps": "Photoshop, Illustrator, Premiere Pro, After Effects", "Storage": "100GB cloud storage", "Updates": "Continuous"}'::jsonb
),
(
  'CAT-SW-003', 'JetBrains IntelliJ IDEA Ultimate',
  'Professional Java and Kotlin IDE with advanced refactoring, database tools, and framework support.',
  'Professional Java/Kotlin IDE',
  'SOFTWARE', 'a0000000-0000-0000-0000-000000000006',
  'JetBrains', 'IntelliJ IDEA Ultimate', 599.00, 'ACTIVE',
  true, false, NULL, 0, 20,
  ARRAY['developer', 'ide', 'java'], 3,
  '{"License": "Annual subscription", "Languages": "Java, Kotlin, Scala, Groovy", "Features": "Refactoring, Database tools, Spring support", "Users": "Per user"}'::jsonb
),
(
  'CAT-SW-004', 'GitHub Enterprise',
  'Enterprise source code management with advanced security, compliance, and collaboration features.',
  'Enterprise Git hosting and CI/CD',
  'SOFTWARE', 'a0000000-0000-0000-0000-000000000006',
  'GitHub', 'GitHub Enterprise Cloud', 252.00, 'ACTIVE',
  true, false, NULL, 0, 100,
  ARRAY['developer', 'git', 'ci-cd'], 4,
  '{"License": "Annual subscription", "Features": "Advanced security, SAML SSO, Audit log", "CI/CD": "GitHub Actions included", "Users": "Per user"}'::jsonb
),

-- === NETWORK EQUIPMENT (category a...007) ===
(
  'CAT-NET-001', 'Cisco Catalyst 9200L-24P-4G',
  'Enterprise-grade 24-port PoE+ managed switch. Layer 3 routing, stackable, ideal for access layer.',
  '24-port PoE+ managed switch',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000007',
  'Cisco Systems', 'Catalyst 9200L-24P-4G', 3495.00, 'ACTIVE',
  true, true, 2000.00, 10, 1,
  ARRAY['switch', 'poe', 'enterprise'], 1,
  '{"Ports": "24x Gigabit PoE+", "Uplinks": "4x 1G SFP", "PoE Budget": "370W", "Layer": "Layer 3", "Stacking": "StackWise-160"}'::jsonb
),
(
  'CAT-NET-002', 'Cisco Meraki MR46',
  'Enterprise-grade Wi-Fi 6 access point with cloud management. High-density deployment ready.',
  'Wi-Fi 6 cloud-managed access point',
  'HARDWARE', 'a0000000-0000-0000-0000-000000000007',
  'Cisco Systems', 'Meraki MR46', 1295.00, 'ACTIVE',
  true, true, 1000.00, 5, 5,
  ARRAY['wifi6', 'enterprise', 'cloud-managed'], 2,
  '{"Standard": "Wi-Fi 6 (802.11ax)", "Speed": "Up to 3.5 Gbps", "Clients": "200+ concurrent", "Management": "Cloud-managed", "PoE": "802.3at required"}'::jsonb
),

-- === ACCESSORIES (category a...008) ===
(
  'CAT-ACC-001', 'CalDigit TS4 Thunderbolt 4 Dock',
  'Premium Thunderbolt 4 dock with 18 ports. Single cable connection for complete workstation setup.',
  'Thunderbolt 4 dock with 18 ports',
  'ACCESSORY', 'a0000000-0000-0000-0000-000000000008',
  'CalDigit', 'TS4', 399.00, 'ACTIVE',
  true, false, NULL, 0, 3,
  ARRAY['dock', 'thunderbolt', 'productivity'], 1,
  '{"Ports": "18 total", "Power Delivery": "98W", "Display": "Dual 4K or Single 8K", "Thunderbolt": "3x Thunderbolt 4", "USB": "5x USB-A, 3x USB-C"}'::jsonb
),
(
  'CAT-ACC-002', 'Jabra Evolve2 85 Headset',
  'Professional wireless headset with ANC. Certified for Microsoft Teams and Zoom. 37-hour battery.',
  'Professional ANC headset for meetings',
  'ACCESSORY', 'a0000000-0000-0000-0000-000000000008',
  'Jabra', 'Evolve2 85', 449.00, 'ACTIVE',
  true, false, NULL, 0, 3,
  ARRAY['headset', 'anc', 'meetings'], 2,
  '{"Type": "Over-ear wireless", "ANC": "Advanced Active Noise Cancellation", "Battery": "37 hours", "Certification": "MS Teams, Zoom", "Connectivity": "Bluetooth, USB dongle"}'::jsonb
),
(
  'CAT-ACC-003', 'Dell USB-C Monitor Arm',
  'Adjustable single monitor arm with integrated USB-C cable management. Supports up to 34-inch monitors.',
  'Adjustable monitor arm with USB-C',
  'ACCESSORY', 'a0000000-0000-0000-0000-000000000008',
  'Dell Technologies', 'MSA20', 249.00, 'ACTIVE',
  true, false, NULL, 0, 5,
  ARRAY['monitor-arm', 'ergonomic', 'cable-management'], 3,
  '{"Mount": "VESA 100x100", "Max Size": "34 inches", "Max Weight": "22 lbs", "Cable Management": "Integrated USB-C", "Adjustment": "Height, tilt, swivel, rotate"}'::jsonb
)
ON CONFLICT (item_code) DO NOTHING;
